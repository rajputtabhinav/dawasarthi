import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { ServerOrder } from "@/lib/server-orders";
import { findUserOrderById } from "@/lib/server-orders";
import { assertRateLimitJson } from "@/lib/server-rate-limit";
import {
  BODY_LIMIT_JSON_SMALL,
  enforceContentLength,
  enforceSameOrigin,
} from "@/lib/request-limits";

function serializePublicOrder(o: ServerOrder) {
  return {
    id: o.id,
    customer: o.customer,
    city: o.city,
    status: o.status,
    updatedAt: o.updatedAt,
    placedAt: o.placedAt,
    items: o.items,
    prescription: o.prescription,
    address: o.address,
    paymentMethod: o.paymentMethod,
    total: o.total,
    coupon: o.coupon,
    deliveryCoords: o.deliveryCoords ?? null,
    storeCoords: o.storeCoords ?? null,
    riderLocation: o.riderLocation ?? null,
    etaMinutes: o.etaMinutes ?? null,
    routePolyline: o.routePolyline ?? null,
  };
}

/**
 * Lookup a single order by ID. Requires Clerk auth and returns only orders
 * owned by the current user — the previous "phone-last-10-digits" path was
 * removed because order IDs are no longer client-predictable and phone numbers
 * are not secrets.
 */
export async function POST(request: Request) {
  const csrfRejected = enforceSameOrigin(request);
  if (csrfRejected) return csrfRejected;

  const tooBig = enforceContentLength(request, BODY_LIMIT_JSON_SMALL);
  if (tooBig) return tooBig;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to look up your order." },
      { status: 401 },
    );
  }

  const limited = await assertRateLimitJson(request, "post_orders_lookup", 30, {
    userId,
  });
  if (limited) return limited;

  const body = (await request.json().catch(() => ({}))) as {
    orderId?: unknown;
  };
  const orderId = String(body.orderId ?? "").trim();
  if (!orderId || !/^ORD[A-Z0-9]{4,32}$/.test(orderId)) {
    return NextResponse.json(
      { error: "Enter a valid order ID." },
      { status: 400 },
    );
  }

  const hit = await findUserOrderById(userId, orderId);
  if (!hit) {
    return NextResponse.json(
      { error: "No order matched those details." },
      { status: 404 },
    );
  }

  return NextResponse.json({ order: serializePublicOrder(hit) });
}
