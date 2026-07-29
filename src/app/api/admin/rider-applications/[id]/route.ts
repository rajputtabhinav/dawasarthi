import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requireAdminJson } from "@/lib/admin-auth";
import {
  BODY_LIMIT_JSON_SMALL,
  enforceContentLength,
  enforceSameOrigin,
} from "@/lib/request-limits";
import {
  RIDER_APP_STATUSES,
  type RiderApplicationStatus,
} from "@/lib/types";
import {
  getRiderApplicationForAdmin,
  updateRiderApplicationStatus,
} from "@/lib/server-rider-applications";

type RouteContext = { params: Promise<{ id: string }> };

const APP_ID_RE = /^RA[A-Z0-9]{4,30}$/;

export async function GET(_request: Request, context: RouteContext) {
  const forbidden = await requireAdminJson();
  if (forbidden) return forbidden;
  const { id } = await context.params;
  if (!APP_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const app = await getRiderApplicationForAdmin(id);
  if (!app) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Strip blob URLs — admin downloads via the streaming /doc/[kind] endpoint.
  const safeDocs: Record<string, { contentType: string; size: number }> = {};
  for (const [kind, entry] of Object.entries(app.docs)) {
    if (entry) {
      safeDocs[kind] = { contentType: entry.contentType, size: entry.size };
    }
  }
  return NextResponse.json(
    {
      application: { ...app, docs: safeDocs },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const csrfRejected = enforceSameOrigin(request);
  if (csrfRejected) return csrfRejected;

  const tooBig = enforceContentLength(request, BODY_LIMIT_JSON_SMALL);
  if (tooBig) return tooBig;

  const forbidden = await requireAdminJson();
  if (forbidden) return forbidden;

  const { id } = await context.params;
  if (!APP_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
    reason?: unknown;
    notes?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const nextStatus = typeof body.status === "string" ? body.status : "";
  if (!(RIDER_APP_STATUSES as readonly string[]).includes(nextStatus)) {
    return NextResponse.json(
      { error: "Invalid status." },
      { status: 400 },
    );
  }

  const reason = typeof body.reason === "string" ? body.reason : undefined;
  const notes = typeof body.notes === "string" ? body.notes : undefined;

  const { userId } = await auth();
  const updated = await updateRiderApplicationStatus({
    id,
    nextStatus: nextStatus as RiderApplicationStatus,
    reason,
    reviewerNotes: notes,
    reviewerId: userId ?? "unknown",
  });
  if (!updated) {
    return NextResponse.json({ error: "Update failed." }, { status: 400 });
  }

  // Same as GET — don't leak blob URLs.
  const safeDocs: Record<string, { contentType: string; size: number }> = {};
  for (const [kind, entry] of Object.entries(updated.docs)) {
    if (entry) {
      safeDocs[kind] = { contentType: entry.contentType, size: entry.size };
    }
  }
  return NextResponse.json({ application: { ...updated, docs: safeDocs } });
}
