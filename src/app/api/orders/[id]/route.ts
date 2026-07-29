import { NextResponse } from "next/server";
import { requireAdminJson } from "@/lib/admin-auth";
import {
  BODY_LIMIT_JSON_SMALL,
  enforceContentLength,
  enforceSameOrigin,
} from "@/lib/request-limits";
import { updateOrderStatus } from "@/lib/server-orders";
import type { OrderStatus } from "@/lib/types";

/**
 * Forward-flow statuses only. `Cancelled` is NOT accepted here on purpose —
 * cancellation must go through `/api/orders/[id]/cancel` so reserved stock
 * is released atomically.
 */
const STATUSES: OrderStatus[] = [
  "Ordered",
  "Packed",
  "Out for Delivery",
  "Delivered",
];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrfRejected = enforceSameOrigin(request);
  if (csrfRejected) return csrfRejected;

  const tooBig = enforceContentLength(request, BODY_LIMIT_JSON_SMALL);
  if (tooBig) return tooBig;

  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId).trim();

  if (!/^ORD[A-Z0-9]{4,32}$/.test(id)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  const forbidden = await requireAdminJson();
  if (forbidden) return forbidden;

  const body = (await request.json().catch(() => ({}))) as { status?: unknown };
  const status =
    typeof body?.status === "string" ? (body.status as OrderStatus) : undefined;
  if (!status || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await updateOrderStatus(id, status);
  if (!updated) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order: updated });
}
