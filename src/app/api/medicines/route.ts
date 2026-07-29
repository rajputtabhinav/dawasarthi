import { NextResponse } from "next/server";
import { requireAdminJson } from "@/lib/admin-auth";
import { invalidateMedicineCatalog } from "@/lib/catalog-invalidate";
import {
  BODY_LIMIT_JSON_LARGE,
  enforceContentLength,
  enforceSameOrigin,
} from "@/lib/request-limits";
import {
  countMedicinesInDb,
  createMedicineInDb,
  medicineIdOrSlugTaken,
  parseMedicinePayload,
} from "@/lib/server-medicines";
import { loadMedicinesFromDb } from "@/lib/server-medicines-catalog";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit") ?? 60)),
    200,
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  // Full rows (including possibly-large data-URL images) require admin auth.
  const wantsFull = url.searchParams.get("full") === "1";
  let isAdmin = false;
  if (wantsFull) {
    const forbidden = await requireAdminJson();
    if (forbidden) return forbidden;
    isAdmin = true;
  }

  const all = await loadMedicinesFromDb();
  const count = await countMedicinesInDb();
  const page = all.slice(offset, offset + limit).map((m) => {
    if (isAdmin) return m;
    // Strip the (potentially large data-URL) image + long description from
    // the public list response. Detail pages fetch the full row via the
    // `/medicines/[slug]` server component.
    const lean = { ...m };
    delete (lean as { image?: unknown }).image;
    delete (lean as { description?: unknown }).description;
    return lean;
  });
  return NextResponse.json(
    { medicines: page, count, limit, offset },
    {
      headers: {
        "Cache-Control": isAdmin
          ? "private, no-store"
          : "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}

export async function POST(request: Request) {
  const csrfRejected = enforceSameOrigin(request);
  if (csrfRejected) return csrfRejected;

  const tooBig = enforceContentLength(request, BODY_LIMIT_JSON_LARGE);
  if (tooBig) return tooBig;

  const forbidden = await requireAdminJson();
  if (forbidden) return forbidden;

  try {
    const body = (await request.json().catch(() => null)) as unknown;
    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const parsed = parseMedicinePayload(body);
    if (!parsed.ok) {
      return NextResponse.json({ errors: parsed.errors }, { status: 400 });
    }

    const taken = await medicineIdOrSlugTaken(parsed.medicine.id, parsed.medicine.slug);
    if (taken) {
      return NextResponse.json(
        { error: "A medicine with this id or slug already exists." },
        { status: 409 },
      );
    }

    await createMedicineInDb(parsed.medicine);
    invalidateMedicineCatalog();
    return NextResponse.json({ medicine: parsed.medicine }, { status: 201 });
  } catch (e) {
    console.error(
      "[dawasarthi] POST /api/medicines failed:",
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json(
      { error: "Could not create medicine." },
      { status: 500 },
    );
  }
}
