-- Dawasarthi Postgres schema (Supabase-compatible).
--
-- One source of truth for all tables. Idempotent (CREATE TABLE IF NOT EXISTS).
-- Run via `npm run db:migrate` (see scripts/run-migration.mjs).
--
-- Design notes:
--   * Business IDs are kept as TEXT primary keys (matches existing API surface).
--   * Embedded Mongo arrays normalized into proper join tables (order_items).
--   * Embedded sub-documents (GeoPoint, RiderLocation, application Doc) flattened
--     into columns or stored as JSONB where shape varies.
--   * `updated_at` triggers auto-update on UPDATE.

-- Helper trigger function to bump updated_at automatically.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── medicines ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medicines (
  id                     TEXT PRIMARY KEY,
  slug                   TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  category               TEXT NOT NULL,
  manufacturer           TEXT NOT NULL,
  image                  TEXT NOT NULL,
  pack_size              TEXT NOT NULL,
  price                  NUMERIC(12,2) NOT NULL,
  mrp                    NUMERIC(12,2) NOT NULL,
  discount               NUMERIC(6,2) NOT NULL DEFAULT 0,
  stock_status           TEXT NOT NULL,
  stock_on_hand          INTEGER, -- NULL means untracked
  requires_prescription  BOOLEAN NOT NULL DEFAULT FALSE,
  rating                 NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count           INTEGER NOT NULL DEFAULT 0,
  delivery_text          TEXT NOT NULL DEFAULT '',
  short_description      TEXT NOT NULL DEFAULT '',
  description            TEXT NOT NULL DEFAULT '',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS medicines_category_idx ON medicines (category);
CREATE INDEX IF NOT EXISTS medicines_updated_idx ON medicines (updated_at DESC);

DROP TRIGGER IF EXISTS medicines_updated_at ON medicines;
CREATE TRIGGER medicines_updated_at BEFORE UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── orders ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                TEXT PRIMARY KEY,
  user_id           TEXT,
  user_email        TEXT,
  customer          TEXT NOT NULL,
  city              TEXT NOT NULL DEFAULT '—',
  phone             TEXT,
  address           TEXT,
  status            TEXT NOT NULL CHECK (status IN ('Ordered','Packed','Out for Delivery','Delivered','Cancelled')),
  status_updated_at TEXT, -- preserves the formatted "en-IN" string used in old API
  cancelled_at      TEXT,
  cancel_reason     TEXT,
  cancelled_by      TEXT CHECK (cancelled_by IN ('customer','admin')),
  prescription      BOOLEAN NOT NULL DEFAULT FALSE,
  prescription_id   TEXT,
  total             TEXT,
  placed_at         TEXT,
  coupon            TEXT,
  payment_method    TEXT,
  -- Map / tracking fields
  delivery_lng      NUMERIC(9,6),
  delivery_lat      NUMERIC(9,6),
  store_lng         NUMERIC(9,6),
  store_lat         NUMERIC(9,6),
  rider_lng         NUMERIC(9,6),
  rider_lat         NUMERIC(9,6),
  rider_bearing     NUMERIC(6,2),
  rider_updated_at  TEXT,
  rider_name        TEXT,
  rider_phone       TEXT,
  eta_minutes       INTEGER,
  route_polyline    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
-- Composite index for the per-user order history query
-- (`listUserOrders`: WHERE user_id = ? ORDER BY created_at DESC LIMIT n).
-- Lets Postgres satisfy both the filter and sort from one index scan instead
-- of scanning + sorting.
CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders (user_id, created_at DESC);

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── order_items ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id           BIGSERIAL PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  medicine_id  TEXT,
  name         TEXT NOT NULL,
  quantity     INTEGER NOT NULL,
  price        TEXT NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

-- ── prescription_uploads ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescription_uploads (
  id             TEXT PRIMARY KEY, -- 24-char hex string (replaces Mongo ObjectId)
  user_id        TEXT NOT NULL,
  user_email     TEXT,
  filename       TEXT NOT NULL,
  content_type   TEXT NOT NULL,
  size           INTEGER NOT NULL,
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blob_url       TEXT,
  blob_pathname  TEXT,
  -- Inline fallback bytes for local dev when BLOB_READ_WRITE_TOKEN absent.
  data           BYTEA
);
CREATE INDEX IF NOT EXISTS prescriptions_user_idx ON prescription_uploads (user_id);
CREATE INDEX IF NOT EXISTS prescriptions_uploaded_idx ON prescription_uploads (uploaded_at DESC);
-- Composite for `countUserPrescriptionsToday` (per-user rolling-24h count).
-- A single-column user_id index works for the WHERE but Postgres still has to
-- check uploaded_at for each match; the composite lets it stop early.
CREATE INDEX IF NOT EXISTS prescriptions_user_uploaded_idx
  ON prescription_uploads (user_id, uploaded_at DESC);

-- ── rider_applications ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rider_applications (
  id                       TEXT PRIMARY KEY,
  phone                    TEXT NOT NULL UNIQUE,
  full_name                TEXT NOT NULL,
  dob                      TEXT NOT NULL,
  gender                   TEXT CHECK (gender IN ('male','female','other')),
  current_address          TEXT NOT NULL,
  emergency_contact_name   TEXT,
  emergency_contact_phone  TEXT,
  vehicle_type             TEXT NOT NULL CHECK (vehicle_type IN ('bike','scooter','e-scooter','cycle')),
  vehicle_number           TEXT NOT NULL,
  aadhaar_last4            TEXT NOT NULL,
  upi_id                   TEXT,
  availability             TEXT NOT NULL,
  preferred_shift          TEXT NOT NULL,
  hours_per_week           INTEGER,
  source                   TEXT,
  status                   TEXT NOT NULL DEFAULT 'submitted'
                           CHECK (status IN ('submitted','under_review','on_hold','approved','rejected')),
  rejection_reason         TEXT,
  reviewer_notes           TEXT,
  reviewed_by              TEXT,
  reviewed_at              TEXT,
  -- Each doc is stored as JSONB: { blobUrl, blobPathname, contentType, size }
  docs                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at             TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rider_applications_status_idx ON rider_applications (status);
-- Note: no separate index on `phone` — the UNIQUE constraint above already
-- creates one. Dropped previous explicit `rider_applications_phone_idx`.
DROP INDEX IF EXISTS rider_applications_phone_idx;

DROP TRIGGER IF EXISTS rider_applications_updated_at ON rider_applications;
CREATE TRIGGER rider_applications_updated_at BEFORE UPDATE ON rider_applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── verified_phones ──────────────────────────────────────────────────────
-- CURRENTLY UNUSED. Was populated by the MSG91 OTP flow, which has been
-- removed from the app (May 2026). Kept so any recorded verifications
-- survive if/when phone OTP is re-introduced. Safe to DROP if it never is.
CREATE TABLE IF NOT EXISTS verified_phones (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  phone       TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, phone)
);
CREATE INDEX IF NOT EXISTS verified_phones_user_idx ON verified_phones (user_id);

-- ── rate_limit_buckets ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limit_expires_idx ON rate_limit_buckets (expires_at);

-- (No automatic cleanup function; expired rows are overwritten when a new
-- window starts. A pg_cron cleanup could be added later if the table grows.)
