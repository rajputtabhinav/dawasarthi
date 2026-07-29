import { del, put } from "@vercel/blob";
import { getSql, isDatabaseConfigured } from "@/lib/db";
import {
  AVAILABILITY_OPTIONS,
  PREFERRED_SHIFTS,
  RIDER_APP_DOC_KINDS,
  RIDER_APP_STATUSES,
  VEHICLE_TYPES,
  type Availability,
  type PreferredShift,
  type RiderApplication,
  type RiderAppDocKind,
  type RiderApplicationDoc,
  type RiderApplicationStatus,
  type VehicleType,
} from "@/lib/types";

/* ── Upload helpers ──────────────────────────────────────────────────────── */

const MAX_BYTES_PER_DOC = 4 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const EXT_FOR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function detectMimeFromBytes(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  ) return "application/pdf";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) return "image/webp";
  return null;
}

async function uploadDoc(
  applicationId: string,
  kind: RiderAppDocKind,
  file: File,
): Promise<RiderApplicationDoc | null> {
  if (!file || !(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_BYTES_PER_DOC) {
    throw new Error(`${kind}: file is larger than 4 MB.`);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`${kind}: only JPG, PNG, WebP, or PDF files are allowed.`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = detectMimeFromBytes(buf);
  if (!sniffed || !ALLOWED_TYPES.has(sniffed)) {
    throw new Error(`${kind}: file is not a recognised image or PDF.`);
  }
  if (sniffed !== file.type) {
    throw new Error(`${kind}: file type does not match its contents.`);
  }
  const ext = EXT_FOR_MIME[sniffed] ?? "bin";

  if (!isBlobConfigured()) {
    throw new Error("Document storage is not configured on the server.");
  }

  const result = await put(
    `rider-applications/${applicationId}/${kind}.${ext}`,
    buf,
    {
      access: "public",
      addRandomSuffix: true,
      contentType: sniffed,
      cacheControlMaxAge: 0,
    },
  );
  return {
    blobUrl: result.url,
    blobPathname: result.pathname,
    contentType: sniffed,
    size: buf.byteLength,
  };
}

/* ── Public surface ──────────────────────────────────────────────────────── */

export type CreateApplicationInput = {
  phone: string;
  fullName: string;
  dob: string;
  gender?: "male" | "female" | "other";
  currentAddress: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  aadhaarLast4: string;
  upiId?: string;
  availability: Availability;
  preferredShift: PreferredShift;
  hoursPerWeek?: number;
  source?: string;
  files: Partial<Record<RiderAppDocKind, File>>;
};

export type CreateApplicationResult =
  | { ok: true; id: string; status: RiderApplicationStatus }
  | { ok: false; status: 400 | 409 | 503; error: string; field?: string };

function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  return digits.slice(-10);
}

function isAdult(dob: string): boolean {
  const t = new Date(dob).getTime();
  if (!Number.isFinite(t)) return false;
  const ageMs = Date.now() - t;
  const years = ageMs / (1000 * 60 * 60 * 24 * 365.25);
  return years >= 18 && years <= 70;
}

/**
 * Validate + persist a new rider application. Documents are uploaded to
 * Vercel Blob with an `addRandomSuffix` path so URLs are unguessable; the
 * URLs are still admin-only (the GET endpoint streams them through our
 * server).
 *
 * Returns a structured error result so the route handler can map to HTTP
 * status codes without leaking internals.
 */
export async function createRiderApplication(
  input: CreateApplicationInput,
): Promise<CreateApplicationResult> {
  if (!isDatabaseConfigured()) {
    return { ok: false, status: 503, error: "Application service is not configured." };
  }

  // ── Field validation ─────────────────────────────────────────────────────
  const phone = normalisePhone(input.phone);
  if (!phone) {
    return { ok: false, status: 400, error: "Please enter a valid phone number.", field: "phone" };
  }
  const fullName = input.fullName.trim();
  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, status: 400, error: "Please enter your full name.", field: "fullName" };
  }
  if (!isAdult(input.dob)) {
    return { ok: false, status: 400, error: "You must be 18 or older to apply.", field: "dob" };
  }
  const currentAddress = input.currentAddress.trim();
  if (currentAddress.length < 10) {
    return { ok: false, status: 400, error: "Please enter your full current address.", field: "currentAddress" };
  }
  if (!VEHICLE_TYPES.includes(input.vehicleType)) {
    return { ok: false, status: 400, error: "Select a valid vehicle type.", field: "vehicleType" };
  }
  const vehicleNumber = input.vehicleNumber.trim().toUpperCase();
  if (!/^[A-Z0-9 -]{4,20}$/.test(vehicleNumber)) {
    return { ok: false, status: 400, error: "Vehicle number looks invalid.", field: "vehicleNumber" };
  }
  if (!/^\d{4}$/.test(input.aadhaarLast4)) {
    return { ok: false, status: 400, error: "Enter the last 4 digits of your Aadhaar.", field: "aadhaarLast4" };
  }
  if (!AVAILABILITY_OPTIONS.includes(input.availability)) {
    return { ok: false, status: 400, error: "Select your availability.", field: "availability" };
  }
  if (!PREFERRED_SHIFTS.includes(input.preferredShift)) {
    return { ok: false, status: 400, error: "Select a preferred shift.", field: "preferredShift" };
  }
  const requiredFiles: RiderAppDocKind[] = [
    "photo",
    "aadhaarFront",
    "aadhaarBack",
    "licence",
    "rc",
  ];
  for (const kind of requiredFiles) {
    const f = input.files[kind];
    if (!f || !(f instanceof File) || f.size === 0) {
      return { ok: false, status: 400, error: `Please upload your ${kind}.`, field: kind };
    }
  }

  // ── Dedup ───────────────────────────────────────────────────────────────
  const sql = getSql();
  if (!sql) {
    return { ok: false, status: 503, error: "Application service is temporarily unavailable." };
  }
  const existing = await sql<{ id: string; status: RiderApplicationStatus }[]>`
    SELECT id, status FROM rider_applications WHERE phone = ${phone} LIMIT 1
  `;
  if (existing.length > 0) {
    const existingDoc = existing[0]!;
    return {
      ok: false,
      status: 409,
      error:
        existingDoc.status === "rejected"
          ? "An earlier application from this phone was not approved. Please contact support."
          : "We already have an application from this phone number.",
    };
  }

  // ── Upload docs to Blob ─────────────────────────────────────────────────
  // Application IDs were previously time-prefixed with only ~10 bits of
  // randomness (Math.random * 1296). An attacker who knew the rough submission
  // window could brute-force the tail. Use 80 bits of crypto-random instead
  // — the regex on the status endpoint still accepts up to 30 base36 chars.
  const id = `RA${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const uploaded: Partial<Record<RiderAppDocKind, RiderApplicationDoc>> = {};
  const uploadedPathnames: string[] = [];

  try {
    for (const kind of RIDER_APP_DOC_KINDS) {
      const file = input.files[kind];
      if (!file) continue;
      const doc = await uploadDoc(id, kind, file);
      if (doc) {
        uploaded[kind] = doc;
        uploadedPathnames.push(doc.blobPathname);
      }
    }
  } catch (err) {
    // Clean up anything we already uploaded so we don't orphan blobs.
    for (const path of uploadedPathnames) {
      try {
        await del(path);
      } catch {
        /* ignore */
      }
    }
    return {
      ok: false,
      status: 400,
      error: err instanceof Error ? err.message : "Could not upload documents.",
    };
  }

  // ── Persist ─────────────────────────────────────────────────────────────
  const nowIso = new Date().toISOString();
  try {
    await sql`
      INSERT INTO rider_applications (
        id, phone, full_name, dob, gender, current_address,
        emergency_contact_name, emergency_contact_phone,
        vehicle_type, vehicle_number, aadhaar_last4, upi_id,
        availability, preferred_shift, hours_per_week, source,
        status, docs, submitted_at
      ) VALUES (
        ${id},
        ${phone},
        ${fullName},
        ${input.dob},
        ${input.gender ?? null},
        ${currentAddress},
        ${input.emergencyContactName?.trim() || null},
        ${input.emergencyContactPhone?.trim() || null},
        ${input.vehicleType},
        ${vehicleNumber},
        ${input.aadhaarLast4},
        ${input.upiId?.trim() || null},
        ${input.availability},
        ${input.preferredShift},
        ${input.hoursPerWeek ?? null},
        ${input.source?.trim() || null},
        ${"submitted"},
        ${sql.json(uploaded as Record<string, RiderApplicationDoc>)},
        ${nowIso}
      )
    `;
  } catch (err) {
    // Rollback uploaded blobs on DB failure.
    for (const path of uploadedPathnames) {
      try {
        await del(path);
      } catch {
        /* ignore */
      }
    }
    console.error(
      "[dawasarthi] rider application save failed:",
      err instanceof Error ? err.message : err,
    );
    return {
      ok: false,
      status: 503,
      error: "Could not save your application. Please try again.",
    };
  }

  return { ok: true, id, status: "submitted" };
}

/** Lightweight status lookup — public, phone + id required so randoms can't enumerate. */
export async function getApplicationStatus(
  applicationId: string,
  phone: string,
): Promise<
  | {
      ok: true;
      id: string;
      status: RiderApplicationStatus;
      submittedAt: string;
      rejectionReason?: string;
    }
  | { ok: false }
> {
  const sql = getSql();
  if (!sql) return { ok: false };
  const phoneNorm = normalisePhone(phone);
  if (!phoneNorm) return { ok: false };
  if (!/^RA[A-Z0-9]{4,30}$/.test(applicationId)) return { ok: false };
  try {
    const rows = await sql<
      {
        id: string;
        status: RiderApplicationStatus;
        submittedAt: string;
        rejectionReason: string | null;
      }[]
    >`
      SELECT id, status, submitted_at, rejection_reason
      FROM rider_applications
      WHERE id = ${applicationId} AND phone = ${phoneNorm}
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) return { ok: false };
    return {
      ok: true,
      id: r.id,
      status: r.status,
      submittedAt: r.submittedAt,
      rejectionReason: r.rejectionReason ?? undefined,
    };
  } catch {
    return { ok: false };
  }
}

/* ── Admin surface ───────────────────────────────────────────────────────── */

type ApplicationRow = {
  id: string;
  phone: string;
  fullName: string;
  dob: string;
  gender: string | null;
  currentAddress: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  vehicleType: string;
  vehicleNumber: string;
  aadhaarLast4: string;
  upiId: string | null;
  availability: string;
  preferredShift: string;
  hoursPerWeek: number | null;
  source: string | null;
  status: string;
  rejectionReason: string | null;
  reviewerNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  docs: Record<string, unknown> | null;
  submittedAt: string;
  updatedAt: Date | string | null;
};

const APPLICATION_COLUMNS = `
  id, phone, full_name, dob, gender, current_address,
  emergency_contact_name, emergency_contact_phone,
  vehicle_type, vehicle_number, aadhaar_last4, upi_id,
  availability, preferred_shift, hours_per_week, source,
  status, rejection_reason, reviewer_notes, reviewed_by, reviewed_at,
  docs, submitted_at, updated_at
`;

function rowToApplication(row: ApplicationRow): RiderApplication {
  const docsMap = (row.docs ?? {}) as Record<string, unknown>;
  function toDoc(value: unknown): RiderApplicationDoc | undefined {
    if (!value || typeof value !== "object") return undefined;
    const v = value as Record<string, unknown>;
    if (typeof v.blobUrl !== "string" || typeof v.blobPathname !== "string") {
      return undefined;
    }
    return {
      blobUrl: v.blobUrl,
      blobPathname: v.blobPathname,
      contentType: typeof v.contentType === "string" ? v.contentType : "",
      size: typeof v.size === "number" ? v.size : 0,
    };
  }
  const safeDocs: Partial<Record<RiderAppDocKind, RiderApplicationDoc>> = {};
  for (const kind of RIDER_APP_DOC_KINDS) {
    const entry = toDoc(docsMap[kind]);
    if (entry) safeDocs[kind] = entry;
  }

  const updatedAt =
    row.updatedAt instanceof Date
      ? row.updatedAt.toISOString()
      : typeof row.updatedAt === "string"
        ? row.updatedAt
        : "";

  return {
    id: row.id,
    phone: row.phone,
    fullName: row.fullName,
    dob: row.dob,
    gender:
      row.gender === "male" || row.gender === "female" || row.gender === "other"
        ? row.gender
        : undefined,
    currentAddress: row.currentAddress,
    emergencyContactName: row.emergencyContactName ?? undefined,
    emergencyContactPhone: row.emergencyContactPhone ?? undefined,
    vehicleType: (VEHICLE_TYPES.includes(row.vehicleType as VehicleType)
      ? row.vehicleType
      : "bike") as VehicleType,
    vehicleNumber: row.vehicleNumber,
    aadhaarLast4: row.aadhaarLast4,
    upiId: row.upiId ?? undefined,
    availability: (AVAILABILITY_OPTIONS.includes(row.availability as Availability)
      ? row.availability
      : "Part time") as Availability,
    preferredShift: (PREFERRED_SHIFTS.includes(row.preferredShift as PreferredShift)
      ? row.preferredShift
      : "Flexible") as PreferredShift,
    hoursPerWeek:
      typeof row.hoursPerWeek === "number" ? row.hoursPerWeek : undefined,
    source: row.source ?? undefined,
    status: (RIDER_APP_STATUSES.includes(row.status as RiderApplicationStatus)
      ? row.status
      : "submitted") as RiderApplicationStatus,
    rejectionReason: row.rejectionReason ?? undefined,
    reviewerNotes: row.reviewerNotes ?? undefined,
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedAt: row.reviewedAt ?? undefined,
    docs: safeDocs,
    submittedAt: row.submittedAt,
    updatedAt,
  };
}

export async function listRiderApplications(
  filter?: RiderApplicationStatus,
  limit = 200,
): Promise<RiderApplication[]> {
  const sql = getSql();
  if (!sql) return [];
  const cap = Math.min(Math.max(1, limit), 500);
  try {
    const rows = filter
      ? await sql<ApplicationRow[]>`
          SELECT ${sql.unsafe(APPLICATION_COLUMNS)}
          FROM rider_applications
          WHERE status = ${filter}
          ORDER BY submitted_at DESC
          LIMIT ${cap}
        `
      : await sql<ApplicationRow[]>`
          SELECT ${sql.unsafe(APPLICATION_COLUMNS)}
          FROM rider_applications
          ORDER BY submitted_at DESC
          LIMIT ${cap}
        `;
    return rows.map((r) => rowToApplication(r));
  } catch (err) {
    console.error(
      "[dawasarthi] listRiderApplications failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function getRiderApplicationForAdmin(
  id: string,
): Promise<RiderApplication | null> {
  if (!/^RA[A-Z0-9]{4,30}$/.test(id)) return null;
  const sql = getSql();
  if (!sql) return null;
  try {
    const rows = await sql<ApplicationRow[]>`
      SELECT ${sql.unsafe(APPLICATION_COLUMNS)}
      FROM rider_applications WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    return row ? rowToApplication(row) : null;
  } catch {
    return null;
  }
}

export async function updateRiderApplicationStatus(input: {
  id: string;
  nextStatus: RiderApplicationStatus;
  reason?: string;
  reviewerNotes?: string;
  reviewerId: string;
}): Promise<RiderApplication | null> {
  const sql = getSql();
  if (!sql) return null;
  const reviewedAt = new Date().toISOString();
  const rejectionReason =
    input.nextStatus === "rejected" && input.reason
      ? input.reason.slice(0, 400)
      : null;
  const reviewerNotes =
    input.reviewerNotes !== undefined ? input.reviewerNotes.slice(0, 1000) : null;
  try {
    // COALESCE pattern: only overwrite when caller supplied a value, else
    // leave the existing column intact.
    const rows = await sql<ApplicationRow[]>`
      UPDATE rider_applications SET
        status           = ${input.nextStatus},
        reviewed_by      = ${input.reviewerId},
        reviewed_at      = ${reviewedAt},
        rejection_reason = CASE
          WHEN ${input.nextStatus} = 'rejected' THEN ${rejectionReason}
          ELSE rejection_reason
        END,
        reviewer_notes   = COALESCE(${reviewerNotes}, reviewer_notes)
      WHERE id = ${input.id}
      RETURNING ${sql.unsafe(APPLICATION_COLUMNS)}
    `;
    const row = rows[0];
    return row ? rowToApplication(row) : null;
  } catch (err) {
    console.error(
      "[dawasarthi] updateRiderApplicationStatus failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Admin-only: fetch a single document for streaming. */
export async function getApplicationDoc(
  applicationId: string,
  kind: RiderAppDocKind,
): Promise<RiderApplicationDoc | null> {
  const app = await getRiderApplicationForAdmin(applicationId);
  if (!app) return null;
  return app.docs[kind] ?? null;
}
