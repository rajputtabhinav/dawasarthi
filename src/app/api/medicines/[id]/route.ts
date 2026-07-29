import { NextResponse } from "next/server";
import { requireAdminJson } from "@/lib/admin-auth";
import { invalidateMedicineCatalog } from "@/lib/catalog-invalidate";
import {
  BODY_LIMIT_JSON_LARGE,
  enforceContentLength,
  enforceSameOrigin,
} from "@/lib/request-limits";
import {
  deleteMedicineFromDb,
  findMedicineByRouteParam,
  mergeMedicinePatch,
  slugTakenByOtherMedicine,
  updateMedicineInDb,
} from "@/lib/server-medicines";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const csrfRejected = enforceSameOrigin(request);
  if (csrfRejected) return csrfRejected;

  const tooBig = enforceContentLength(request, BODY_LIMIT_JSON_LARGE);
  if (tooBig) return tooBig;

  const forbidden = await requireAdminJson();
  if (forbidden) return forbidden;

  const { id: param } = await context.params;
  const existing = await findMedicineByRouteParam(param);
  if (!existing) {
    return NextResponse.json({ error: "Medicine not found." }, { status: 404 });
  }

  try {
    const patch = (await request.json()) as Record<string, unknown>;
    const merged = mergeMedicinePatch(existing, patch);
    if (!merged.ok) {
      return NextResponse.json({ errors: merged.errors }, { status: 400 });
    }

    if (
      merged.medicine.slug !== existing.slug &&
      (await slugTakenByOtherMedicine(merged.medicine.slug, merged.medicine.id))
    ) {
      return NextResponse.json(
        { error: "Another medicine already uses this slug." },
        { status: 409 },
      );
    }

    const updated = await updateMedicineInDb(existing.id, merged.medicine);
    if (!updated) {
      return NextResponse.json({ error: "Could not update medicine." }, { status: 400 });
    }

    invalidateMedicineCatalog();
    return NextResponse.json({ medicine: updated });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const csrfRejected = enforceSameOrigin(request);
  if (csrfRejected) return csrfRejected;

  const forbidden = await requireAdminJson();
  if (forbidden) return forbidden;

  const { id: param } = await context.params;
  const existing = await findMedicineByRouteParam(param);
  if (!existing) {
    return NextResponse.json({ error: "Medicine not found." }, { status: 404 });
  }

  const ok = await deleteMedicineFromDb(existing.id);
  if (!ok) {
    return NextResponse.json({ error: "Could not delete medicine." }, { status: 400 });
  }

  invalidateMedicineCatalog();
  return NextResponse.json({ ok: true });
}
