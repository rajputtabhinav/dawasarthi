import { NextResponse } from "next/server";
import { requireAdminJson } from "@/lib/admin-auth";
import {
  RIDER_APP_DOC_KINDS,
  type RiderAppDocKind,
} from "@/lib/types";
import { getApplicationDoc } from "@/lib/server-rider-applications";

type RouteContext = { params: Promise<{ id: string; kind: string }> };

const APP_ID_RE = /^RA[A-Z0-9]{4,30}$/;

function safeFilename(name: string): string {
  return (
    name
      .replace(/["\r\n\x00-\x1f\x7f]/g, "")
      .slice(0, 120)
      .trim() || "document"
  );
}

/**
 * Admin-only streaming download of a rider application document. The Blob
 * URL is never exposed to the admin's browser — we fetch it server-side and
 * pipe the bytes through this route. Same pattern as prescriptions.
 */
export async function GET(_request: Request, context: RouteContext) {
  const forbidden = await requireAdminJson();
  if (forbidden) return forbidden;

  const { id, kind } = await context.params;
  if (!APP_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  if (!(RIDER_APP_DOC_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "Unknown document." }, { status: 400 });
  }

  const doc = await getApplicationDoc(id, kind as RiderAppDocKind);
  if (!doc) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const filename = safeFilename(`${kind}-${id}`);

  try {
    const blobResp = await fetch(doc.blobUrl, { cache: "no-store" });
    if (!blobResp.ok || !blobResp.body) {
      return NextResponse.json(
        { error: "Stored file is unavailable." },
        { status: 502 },
      );
    }
    return new Response(blobResp.body, {
      headers: {
        "Content-Type": doc.contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        // Same as the prescriptions route — sandboxes the rendered document
        // so polyglot files can't execute JS in the admin origin.
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch (err) {
    console.error(
      "[dawasarthi] rider application doc stream failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Could not fetch the file." },
      { status: 502 },
    );
  }
}
