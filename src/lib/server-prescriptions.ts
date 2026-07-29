import { randomBytes } from "node:crypto";
import { del, head, put } from "@vercel/blob";
import { getSql, isDatabaseConfigured } from "@/lib/db";

/**
 * Prescription metadata. Files live in Vercel Blob storage when
 * `BLOB_READ_WRITE_TOKEN` is configured; we keep only the URL + pathname here.
 * When the Blob token is absent (local dev), the buffer is stored inline in
 * Postgres as a fallback.
 *
 * IDs are 24-char lowercase hex strings (12 random bytes) — matches the legacy
 * shape used by the admin route validator (`^[a-f0-9]{24}$`).
 */

const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXT_FOR_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function newPrescriptionId(): string {
  return randomBytes(12).toString("hex");
}

const PRESCRIPTION_ID_RE = /^[a-f0-9]{24}$/;

/** Filename sanitiser — strip path separators / control chars / overlong values. */
function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[ -<>:"/\\|?*]/g, "_")
    .replace(/\.{2,}/g, "_")
    .trim();
  const limited = cleaned.slice(0, 120) || "prescription";
  return limited;
}

/**
 * Magic-byte sniff: ensures the declared contentType matches the actual bytes,
 * defeating an attacker who claims a .exe is an image/pdf.
 */
function detectMimeFromBytes(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  ) {
    return "application/pdf";
  }
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
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
  ) {
    return "image/webp";
  }
  return null;
}

export async function persistPrescriptionFile(params: {
  userId: string;
  userEmail?: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
}): Promise<{ id: string }> {
  if (!isDatabaseConfigured()) {
    throw new Error("Upload service is not configured.");
  }

  if (!params.userId) {
    throw new Error("Sign in to upload prescriptions.");
  }

  if (params.buffer.byteLength > MAX_BYTES) {
    throw new Error("File too large (max 5 MB).");
  }

  if (!ALLOWED_TYPES.has(params.contentType)) {
    throw new Error("Only PDF or image uploads are allowed.");
  }

  const sniffed = detectMimeFromBytes(params.buffer);
  if (!sniffed || !ALLOWED_TYPES.has(sniffed)) {
    throw new Error("Uploaded file is not a recognized prescription.");
  }
  if (sniffed !== params.contentType) {
    throw new Error("File type does not match its contents.");
  }

  const sql = getSql();
  if (!sql) throw new Error("Upload service is temporarily unavailable.");

  const cleanName = sanitizeFilename(params.filename);

  let blobUrl: string | undefined;
  let blobPathname: string | undefined;
  let inlineData: Buffer | undefined;

  if (isBlobConfigured()) {
    // Unguessable path — userId is server-trusted, random suffix is appended
    // by Vercel Blob, plus we add 128 bits of our own randomness.
    const ext = EXT_FOR_MIME[sniffed] ?? "bin";
    const randomPart = crypto.randomUUID().replace(/-/g, "");
    const blobPath = `prescriptions/${params.userId}/${Date.now()}-${randomPart}.${ext}`;
    const result = await put(blobPath, params.buffer, {
      access: "public", // Required by @vercel/blob; we never expose the URL.
      addRandomSuffix: true,
      contentType: sniffed,
      cacheControlMaxAge: 0,
    });
    blobUrl = result.url;
    blobPathname = result.pathname;
  } else {
    // Local dev / staging without Blob token — keep bytes inline.
    inlineData = params.buffer;
  }

  const id = newPrescriptionId();

  try {
    await sql`
      INSERT INTO prescription_uploads (
        id, user_id, user_email, filename, content_type, size,
        blob_url, blob_pathname, data
      ) VALUES (
        ${id},
        ${params.userId},
        ${params.userEmail ?? null},
        ${cleanName},
        ${sniffed},
        ${params.buffer.byteLength},
        ${blobUrl ?? null},
        ${blobPathname ?? null},
        ${inlineData ?? null}
      )
    `;
    return { id };
  } catch (err) {
    // If DB save fails after Blob upload, clean up the blob to avoid orphans.
    if (blobPathname && isBlobConfigured()) {
      try {
        await del(blobPathname);
      } catch {
        /* ignore cleanup failure */
      }
    }
    throw err;
  }
}

/**
 * Confirm a prescription belongs to the given user. Used by the orders POST
 * route to prevent customers from claiming somebody else's prescription as
 * proof for their own Rx-flagged order.
 */
export async function prescriptionBelongsToUser(
  id: string,
  userId: string,
): Promise<boolean> {
  if (!id || !userId || !PRESCRIPTION_ID_RE.test(id)) return false;
  const sql = getSql();
  if (!sql) return false;
  try {
    const rows = await sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM prescription_uploads
        WHERE id = ${id} AND user_id = ${userId}
      ) AS exists
    `;
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

/** Count today's uploads from a user for per-user quota enforcement. */
export async function countUserPrescriptionsToday(
  userId: string,
): Promise<number> {
  if (!userId) return 0;
  const sql = getSql();
  if (!sql) return 0;
  try {
    const rows = await sql<{ n: string }[]>`
      SELECT COUNT(*)::text AS n
      FROM prescription_uploads
      WHERE user_id = ${userId}
        AND uploaded_at >= NOW() - INTERVAL '24 hours'
    `;
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

export type PrescriptionRecord = {
  id: string;
  userId: string;
  userEmail?: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  /** Internal — admin-only via download endpoint. */
  hasBlob: boolean;
  blobPathname?: string;
};

type PrescriptionListRow = {
  id: string;
  userId: string;
  userEmail: string | null;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: Date | string;
  blobPathname: string | null;
};

/** Admin listing of recent prescription uploads (no file bytes, no blob URLs). */
export async function listRecentPrescriptions(
  limit = 100,
): Promise<PrescriptionRecord[]> {
  const sql = getSql();
  if (!sql) return [];
  const cap = Math.min(Math.max(1, limit), 500);
  try {
    const rows = await sql<PrescriptionListRow[]>`
      SELECT id, user_id, user_email, filename, content_type, size,
             uploaded_at, blob_pathname
      FROM prescription_uploads
      ORDER BY uploaded_at DESC
      LIMIT ${cap}
    `;
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.userEmail ?? undefined,
      filename: r.filename,
      contentType: r.contentType,
      size: Number(r.size ?? 0),
      uploadedAt:
        r.uploadedAt instanceof Date
          ? r.uploadedAt.toISOString()
          : new Date(r.uploadedAt).toISOString(),
      hasBlob:
        typeof r.blobPathname === "string" && r.blobPathname.length > 0,
      blobPathname:
        typeof r.blobPathname === "string" ? r.blobPathname : undefined,
    }));
  } catch (err) {
    console.error(
      "[dawasarthi] listRecentPrescriptions failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export type PrescriptionFile = {
  filename: string;
  contentType: string;
  bytes?: Buffer;
  blobUrl?: string;
};

type PrescriptionFileRow = {
  filename: string;
  contentType: string;
  blobUrl: string | null;
  data: Buffer | Uint8Array | null;
};

/**
 * Fetch a prescription record by id. Returns either the Blob URL (preferred)
 * or the inline buffer (fallback). Caller MUST be authenticated as admin.
 */
export async function getPrescriptionForAdmin(
  id: string,
): Promise<PrescriptionFile | null> {
  if (!id || !PRESCRIPTION_ID_RE.test(id)) return null;
  const sql = getSql();
  if (!sql) return null;

  try {
    const rows = await sql<PrescriptionFileRow[]>`
      SELECT filename, content_type, blob_url, data
      FROM prescription_uploads WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;

    const filename = row.filename || "prescription";
    const contentType = row.contentType || "application/octet-stream";

    if (typeof row.blobUrl === "string" && row.blobUrl.length > 0) {
      // Verify the blob still exists; head() throws if missing.
      try {
        if (isBlobConfigured()) {
          await head(row.blobUrl);
        }
      } catch {
        return null;
      }
      return { filename, contentType, blobUrl: row.blobUrl };
    }

    if (row.data) {
      const bytes =
        row.data instanceof Buffer ? row.data : Buffer.from(row.data);
      return { filename, contentType, bytes };
    }
    return null;
  } catch {
    return null;
  }
}
