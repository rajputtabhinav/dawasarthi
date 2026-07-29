import { NextResponse } from "next/server";
import { requireAdminJson } from "@/lib/admin-auth";
import { getPrescriptionForAdmin } from "@/lib/server-prescriptions";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Sanitise a filename for use in `Content-Disposition`. Strips `"`, CR/LF, and
 * other control characters so the filename can't inject extra headers.
 */
function safeFilename(name: string): string {
  return name
    .replace(/["\r\n\x00-\x1f\x7f]/g, "")
    .slice(0, 120)
    .trim() || "prescription";
}

/**
 * Admin-only download of a prescription file.
 *
 * Critically, even for Blob-stored files we STREAM the bytes through the
 * server rather than redirecting to the Blob URL. This keeps the URL inside
 * our process — it never enters the admin's browser history, the Referer
 * header of any subsequent click, or Vercel access logs from third parties.
 */
export async function GET(_request: Request, context: RouteContext) {
  const forbidden = await requireAdminJson();
  if (forbidden) return forbidden;

  const { id } = await context.params;
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const file = await getPrescriptionForAdmin(id);
  if (!file) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const filename = safeFilename(file.filename);
  const baseHeaders = {
    "Content-Type": file.contentType,
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    // Sandbox the rendered file so an attacker who slips a polyglot PDF/SVG
    // past the magic-byte check cannot execute JS in the admin's origin.
    "Content-Security-Policy": "sandbox; default-src 'none'",
  };

  if (file.blobUrl) {
    try {
      const blobResp = await fetch(file.blobUrl, { cache: "no-store" });
      if (!blobResp.ok || !blobResp.body) {
        return NextResponse.json(
          { error: "Stored file is unavailable." },
          { status: 502 },
        );
      }
      return new Response(blobResp.body, { headers: baseHeaders });
    } catch (err) {
      console.error(
        "[dawasarthi] failed to stream prescription blob:",
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json(
        { error: "Could not fetch the file." },
        { status: 502 },
      );
    }
  }

  if (!file.bytes) {
    return NextResponse.json({ error: "File not available." }, { status: 410 });
  }

  // Local-dev inline fallback. Copy into a fresh ArrayBuffer so the response
  // stream owns the bytes.
  const ab = new ArrayBuffer(file.bytes.byteLength);
  new Uint8Array(ab).set(new Uint8Array(file.bytes));
  return new Response(ab, { headers: baseHeaders });
}
