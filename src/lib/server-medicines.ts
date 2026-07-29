import type { Medicine } from "@/lib/types";
import { getSql, isDatabaseConfigured } from "@/lib/db";

/* ── Row → domain mapping ─────────────────────────────────────────────────── */

type MedicineRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  manufacturer: string;
  image: string;
  packSize: string;
  price: string | number;
  mrp: string | number;
  discount: string | number;
  stockStatus: string;
  stockOnHand: number | null;
  requiresPrescription: boolean;
  rating: string | number;
  reviewCount: number;
  deliveryText: string;
  shortDescription: string;
  description: string;
  updatedAt?: Date | string | null;
};

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function docToMedicine(row: Record<string, unknown>): Medicine {
  const stockRaw = row.stockOnHand;
  const stockOnHand =
    typeof stockRaw === "number" && Number.isFinite(stockRaw)
      ? Math.max(0, Math.floor(stockRaw))
      : undefined;
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    category: String(row.category ?? ""),
    manufacturer: String(row.manufacturer ?? ""),
    image: String(row.image ?? ""),
    packSize: String(row.packSize ?? ""),
    price: toNumber(row.price),
    mrp: toNumber(row.mrp),
    discount: toNumber(row.discount),
    stockStatus: String(row.stockStatus ?? ""),
    stockOnHand,
    requiresPrescription: Boolean(row.requiresPrescription),
    rating: toNumber(row.rating),
    reviewCount: toNumber(row.reviewCount),
    deliveryText: String(row.deliveryText ?? ""),
    shortDescription: String(row.shortDescription ?? ""),
    description: String(row.description ?? ""),
  };
}

/* ── Validation helpers (framework-agnostic, kept as before) ──────────────── */

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

const MAX_IMAGE_LEN = 1_200_000;
const MAX_IMAGE_DATA_BYTES = 700 * 1024;
const ALLOWED_IMAGE_DATA_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  // svg+xml intentionally excluded.
]);

export function validateMedicineImage(image: string): string | null {
  if (!image) return "image is required.";
  if (image.length > MAX_IMAGE_LEN) return "image is too large.";
  if (image.startsWith("/")) {
    if (image.includes("..")) return "image path is invalid.";
    return null;
  }
  if (image.startsWith("https://")) {
    try {
      const url = new URL(image);
      const allowedHosts = new Set([
        "img.clerk.com",
        "res.cloudinary.com",
        "dawasarthi.com",
        "www.dawasarthi.com",
      ]);
      if (!allowedHosts.has(url.hostname)) {
        return `image host '${url.hostname}' is not allowed.`;
      }
      return null;
    } catch {
      return "image URL is invalid.";
    }
  }
  if (image.startsWith("data:")) {
    const match = /^data:([^;,]+)(;base64)?,(.*)$/.exec(image);
    if (!match) return "image data URL is malformed.";
    const mime = match[1]?.toLowerCase() ?? "";
    if (!ALLOWED_IMAGE_DATA_MIME.has(mime)) {
      return `image MIME '${mime}' is not allowed.`;
    }
    const isBase64 = Boolean(match[2]);
    const payload = match[3] ?? "";
    const approxBytes = isBase64
      ? Math.floor((payload.length * 3) / 4)
      : payload.length;
    if (approxBytes > MAX_IMAGE_DATA_BYTES) {
      return "image is larger than 700 KB.";
    }
    return null;
  }
  return "image must be a path, https URL, or data: URL.";
}

export function parseMedicinePayload(payload: unknown): {
  ok: true;
  medicine: Medicine;
} | {
  ok: false;
  errors: string[];
} {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["Invalid JSON body."] };
  }
  const p = payload as Record<string, unknown>;
  const errors: string[] = [];

  const id = String(p.id ?? "").trim();
  const slug = String(p.slug ?? "").trim();
  const name = String(p.name ?? "").trim();
  const category = String(p.category ?? "").trim();
  const manufacturer = String(p.manufacturer ?? "").trim();
  const image = String(p.image ?? "").trim();
  const packSize = String(p.packSize ?? "").trim();
  const stockStatus = String(p.stockStatus ?? "").trim();
  const deliveryText = String(p.deliveryText ?? "").trim();
  const shortDescription = String(p.shortDescription ?? "").trim();
  const description = String(p.description ?? "").trim();

  const price = Number(p.price);
  const mrp = Number(p.mrp);
  const discount = Number(p.discount);
  const rating = Number(p.rating);
  const reviewCount = Number(p.reviewCount);

  if (!id) errors.push("id is required.");
  if (!slug) errors.push("slug is required.");
  if (!name) errors.push("name is required.");
  if (!category) errors.push("category is required.");
  if (!manufacturer) errors.push("manufacturer is required.");
  const imageError = validateMedicineImage(image);
  if (imageError) errors.push(imageError);
  if (!packSize) errors.push("packSize is required.");
  if (!stockStatus) errors.push("stockStatus is required.");
  if (!deliveryText) errors.push("deliveryText is required.");
  if (!shortDescription) errors.push("shortDescription is required.");
  if (!description) errors.push("description is required.");

  if (!isFiniteNonNegative(price)) errors.push("price must be a non-negative number.");
  if (!isFiniteNonNegative(mrp)) errors.push("mrp must be a non-negative number.");
  if (!Number.isFinite(discount)) errors.push("discount must be a number.");
  if (!Number.isFinite(rating)) errors.push("rating must be a number.");
  if (!Number.isFinite(reviewCount) || reviewCount < 0)
    errors.push("reviewCount must be a non-negative number.");
  if (typeof p.requiresPrescription !== "boolean") {
    errors.push("requiresPrescription must be boolean.");
  }

  let stockOnHand: number | undefined;
  if (p.stockOnHand !== undefined && p.stockOnHand !== null && p.stockOnHand !== "") {
    const n = Number(p.stockOnHand);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
      errors.push("stockOnHand must be a non-negative integer.");
    } else {
      stockOnHand = Math.floor(n);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const medicine: Medicine = {
    id,
    slug,
    name,
    category,
    manufacturer,
    image,
    packSize,
    price,
    mrp,
    discount,
    stockStatus,
    stockOnHand,
    requiresPrescription: p.requiresPrescription as boolean,
    rating,
    reviewCount,
    deliveryText,
    shortDescription,
    description,
  };

  return { ok: true, medicine };
}

export function mergeMedicinePatch(
  existing: Medicine,
  patch: Record<string, unknown>,
): { ok: true; medicine: Medicine } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const next: Medicine = {
    ...existing,
    slug:
      patch.slug !== undefined ? String(patch.slug).trim() : existing.slug,
    name:
      patch.name !== undefined ? String(patch.name).trim() : existing.name,
    category:
      patch.category !== undefined
        ? String(patch.category).trim()
        : existing.category,
    manufacturer:
      patch.manufacturer !== undefined
        ? String(patch.manufacturer).trim()
        : existing.manufacturer,
    image:
      patch.image !== undefined ? String(patch.image).trim() : existing.image,
    packSize:
      patch.packSize !== undefined
        ? String(patch.packSize).trim()
        : existing.packSize,
    stockStatus:
      patch.stockStatus !== undefined
        ? String(patch.stockStatus).trim()
        : existing.stockStatus,
    deliveryText:
      patch.deliveryText !== undefined
        ? String(patch.deliveryText).trim()
        : existing.deliveryText,
    shortDescription:
      patch.shortDescription !== undefined
        ? String(patch.shortDescription).trim()
        : existing.shortDescription,
    description:
      patch.description !== undefined
        ? String(patch.description).trim()
        : existing.description,
    price: patch.price !== undefined ? Number(patch.price) : existing.price,
    mrp: patch.mrp !== undefined ? Number(patch.mrp) : existing.mrp,
    discount:
      patch.discount !== undefined ? Number(patch.discount) : existing.discount,
    rating: patch.rating !== undefined ? Number(patch.rating) : existing.rating,
    reviewCount:
      patch.reviewCount !== undefined
        ? Number(patch.reviewCount)
        : existing.reviewCount,
    requiresPrescription:
      patch.requiresPrescription !== undefined
        ? Boolean(patch.requiresPrescription)
        : existing.requiresPrescription,
    stockOnHand:
      patch.stockOnHand !== undefined
        ? (() => {
            if (patch.stockOnHand === null || patch.stockOnHand === "") return undefined;
            const n = Number(patch.stockOnHand);
            if (!Number.isFinite(n) || n < 0) {
              errors.push("stockOnHand must be a non-negative integer.");
              return existing.stockOnHand;
            }
            return Math.floor(n);
          })()
        : existing.stockOnHand,
  };

  if (!next.slug) errors.push("slug cannot be empty.");
  if (!next.name) errors.push("name cannot be empty.");
  if (!next.category) errors.push("category cannot be empty.");
  if (!isFiniteNonNegative(next.price))
    errors.push("price must be non-negative.");
  if (!isFiniteNonNegative(next.mrp))
    errors.push("mrp must be non-negative.");
  if (patch.image !== undefined) {
    const imageError = validateMedicineImage(next.image);
    if (imageError) errors.push(imageError);
  }

  if (errors.length) return { ok: false, errors };

  return { ok: true, medicine: next };
}

/* ── Postgres read paths ──────────────────────────────────────────────────── */

const MEDICINE_COLUMNS = `
  id, slug, name, category, manufacturer, image, pack_size, price, mrp,
  discount, stock_status, stock_on_hand, requires_prescription, rating,
  review_count, delivery_text, short_description, description, updated_at
`;

export async function loadMedicinesFromDb(): Promise<Medicine[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql<MedicineRow[]>`
      SELECT ${sql.unsafe(MEDICINE_COLUMNS)}
      FROM medicines
      ORDER BY updated_at DESC NULLS LAST, name ASC
    `;
    return rows.map((r) => docToMedicine(r as unknown as Record<string, unknown>));
  } catch (err) {
    console.error(
      "[dawasarthi] loadMedicinesFromDb failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function countMedicinesInDb(): Promise<number> {
  const sql = getSql();
  if (!sql) return 0;
  try {
    const rows = await sql<{ n: string }[]>`SELECT COUNT(*)::text AS n FROM medicines`;
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

export async function findMedicineBySlug(slug: string): Promise<Medicine | null> {
  const sql = getSql();
  if (!sql || !slug) return null;
  try {
    const rows = await sql<MedicineRow[]>`
      SELECT ${sql.unsafe(MEDICINE_COLUMNS)}
      FROM medicines WHERE slug = ${slug} LIMIT 1
    `;
    return rows[0] ? docToMedicine(rows[0] as unknown as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function findMedicineById(id: string): Promise<Medicine | null> {
  const sql = getSql();
  if (!sql || !id) return null;
  try {
    const rows = await sql<MedicineRow[]>`
      SELECT ${sql.unsafe(MEDICINE_COLUMNS)}
      FROM medicines WHERE id = ${id} LIMIT 1
    `;
    return rows[0] ? docToMedicine(rows[0] as unknown as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Resolve a medicine by its business `id` (the slug-friendly Postgres PK). */
export async function findMedicineByRouteParam(
  param: string,
): Promise<Medicine | null> {
  return findMedicineById(param);
}

export async function listMedicineSlugs(): Promise<string[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql<{ slug: string }[]>`SELECT slug FROM medicines`;
    return rows.map((r) => r.slug).filter(Boolean);
  } catch {
    return [];
  }
}

export type MedicineSitemapEntry = {
  slug: string;
  updatedAt: Date | null;
};

export async function listMedicineSitemapEntries(): Promise<MedicineSitemapEntry[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql<{ slug: string; updatedAt: Date | null }[]>`
      SELECT slug, updated_at
      FROM medicines
      ORDER BY updated_at DESC NULLS LAST
    `;
    return rows
      .filter((r) => Boolean(r.slug))
      .map((r) => ({
        slug: r.slug,
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt : null,
      }));
  } catch {
    return [];
  }
}

export async function medicineIdOrSlugTaken(
  id: string,
  slug: string,
): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  try {
    const rows = await sql<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM medicines WHERE id = ${id} OR slug = ${slug}) AS exists
    `;
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

export async function slugTakenByOtherMedicine(
  slug: string,
  excludeBusinessId: string,
): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  try {
    const rows = await sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM medicines WHERE slug = ${slug} AND id <> ${excludeBusinessId}
      ) AS exists
    `;
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

/* ── Postgres write paths ─────────────────────────────────────────────────── */

export async function createMedicineInDb(m: Medicine): Promise<Medicine> {
  const sql = getSql();
  if (!sql) throw new Error("Database unavailable.");
  await sql`
    INSERT INTO medicines (
      id, slug, name, category, manufacturer, image, pack_size, price, mrp,
      discount, stock_status, stock_on_hand, requires_prescription, rating,
      review_count, delivery_text, short_description, description
    ) VALUES (
      ${m.id}, ${m.slug}, ${m.name}, ${m.category}, ${m.manufacturer},
      ${m.image}, ${m.packSize}, ${m.price}, ${m.mrp}, ${m.discount},
      ${m.stockStatus}, ${m.stockOnHand ?? null}, ${m.requiresPrescription},
      ${m.rating}, ${m.reviewCount}, ${m.deliveryText}, ${m.shortDescription},
      ${m.description}
    )
  `;
  return m;
}

export async function updateMedicineInDb(
  id: string,
  medicine: Medicine,
): Promise<Medicine | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const rows = await sql<MedicineRow[]>`
      UPDATE medicines SET
        slug = ${medicine.slug},
        name = ${medicine.name},
        category = ${medicine.category},
        manufacturer = ${medicine.manufacturer},
        image = ${medicine.image},
        pack_size = ${medicine.packSize},
        price = ${medicine.price},
        mrp = ${medicine.mrp},
        discount = ${medicine.discount},
        stock_status = ${medicine.stockStatus},
        stock_on_hand = ${medicine.stockOnHand ?? null},
        requires_prescription = ${medicine.requiresPrescription},
        rating = ${medicine.rating},
        review_count = ${medicine.reviewCount},
        delivery_text = ${medicine.deliveryText},
        short_description = ${medicine.shortDescription},
        description = ${medicine.description}
      WHERE id = ${id}
      RETURNING ${sql.unsafe(MEDICINE_COLUMNS)}
    `;
    return rows[0]
      ? docToMedicine(rows[0] as unknown as Record<string, unknown>)
      : null;
  } catch (err) {
    console.error(
      "[dawasarthi] updateMedicineInDb failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function deleteMedicineFromDb(id: string): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  try {
    const rows = await sql`DELETE FROM medicines WHERE id = ${id} RETURNING id`;
    return rows.length === 1;
  } catch {
    return false;
  }
}

/* ── Stock reservation (atomic) ───────────────────────────────────────────── */

export type StockReservationItem = { medicineId: string; quantity: number };

/**
 * Atomically decrement stock for each requested line. Rows where
 * `stock_on_hand IS NULL` are treated as untracked (unlimited) — the row is
 * left untouched. If any item is short of stock, all previously-decremented
 * lines are rolled back inside the same transaction.
 */
export async function reserveStock(
  items: StockReservationItem[],
): Promise<{ ok: true } | { ok: false; outOfStock: string[] }> {
  if (items.length === 0) return { ok: true };
  const sql = getSql();
  if (!sql) return { ok: true };

  try {
    return await sql.begin(async (tx) => {
      const outOfStock: string[] = [];
      for (const item of items) {
        const updated = await tx<{ stockOnHand: number | null }[]>`
          UPDATE medicines
          SET stock_on_hand = CASE
            WHEN stock_on_hand IS NULL THEN NULL
            ELSE stock_on_hand - ${item.quantity}
          END
          WHERE id = ${item.medicineId}
            AND (stock_on_hand IS NULL OR stock_on_hand >= ${item.quantity})
          RETURNING stock_on_hand
        `;
        if (updated.length === 0) {
          outOfStock.push(item.medicineId);
        }
      }
      if (outOfStock.length > 0) {
        // Throw to roll back the transaction.
        throw new RollbackForOutOfStock(outOfStock);
      }
      return { ok: true } as const;
    });
  } catch (err) {
    if (err instanceof RollbackForOutOfStock) {
      return { ok: false, outOfStock: err.ids };
    }
    throw err;
  }
}

class RollbackForOutOfStock extends Error {
  ids: string[];
  constructor(ids: string[]) {
    super("Out of stock");
    this.ids = ids;
  }
}

/** Return previously-reserved stock to the catalogue (e.g. on cancelled order). */
export async function releaseStock(
  items: StockReservationItem[],
): Promise<void> {
  if (items.length === 0) return;
  const sql = getSql();
  if (!sql) return;
  for (const item of items) {
    try {
      await sql`
        UPDATE medicines
        SET stock_on_hand = stock_on_hand + ${item.quantity}
        WHERE id = ${item.medicineId} AND stock_on_hand IS NOT NULL
      `;
    } catch {
      /* ignore per-row failure; release is best-effort */
    }
  }
}

/* ── Backwards-compat shim ────────────────────────────────────────────────── */

/** Old callers used `process.env.MONGODB_URI` as a "is DB configured?" check. */
export function isCatalogConfigured(): boolean {
  return isDatabaseConfigured();
}
