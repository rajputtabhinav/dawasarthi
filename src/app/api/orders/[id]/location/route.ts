import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requireAdminJson } from "@/lib/admin-auth";
import { getSql, isDatabaseConfigured } from "@/lib/db";
import {
  bearingDegrees,
  fallbackEtaMinutes,
  fetchDirections,
  type GeoPoint,
} from "@/lib/mapbox";
import {
  BODY_LIMIT_JSON_SMALL,
  enforceContentLength,
  enforceSameOrigin,
} from "@/lib/request-limits";
import { assertRateLimitJson } from "@/lib/server-rate-limit";
import { findUserOrderById } from "@/lib/server-orders";

type RouteContext = { params: Promise<{ id: string }> };

const ORDER_ID_RE = /^ORD[A-Z0-9]{4,32}$/;

function publicOrder(order: {
  id: string;
  status: string;
  updatedAt: string;
  deliveryCoords?: GeoPoint;
  storeCoords?: GeoPoint;
  riderLocation?: {
    lng: number;
    lat: number;
    bearing?: number;
    updatedAt: string;
    name?: string;
    phone?: string;
  };
  etaMinutes?: number;
  routePolyline?: string;
}) {
  return {
    id: order.id,
    status: order.status,
    updatedAt: order.updatedAt,
    deliveryCoords: order.deliveryCoords ?? null,
    storeCoords: order.storeCoords ?? null,
    riderLocation: order.riderLocation ?? null,
    etaMinutes: order.etaMinutes ?? null,
    routePolyline: order.routePolyline ?? null,
  };
}

/**
 * Customer-facing poll endpoint. Returns only location + status + ETA fields
 * (no full address / items / customer name) — small payload, safe to refresh
 * every few seconds from the tracking page.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId).trim();
  if (!ORDER_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
  }

  const order = await findUserOrderById(userId, id);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json(publicOrder(order), {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * Admin / rider live-location update. Recomputes ETA from rider → delivery via
 * the Mapbox Directions API. Body shape:
 *
 *   { lng: number, lat: number, name?: string, phone?: string }
 */
export async function PATCH(request: Request, context: RouteContext) {
  const csrfRejected = enforceSameOrigin(request);
  if (csrfRejected) return csrfRejected;

  const tooBig = enforceContentLength(request, BODY_LIMIT_JSON_SMALL);
  if (tooBig) return tooBig;

  const forbidden = await requireAdminJson();
  if (forbidden) return forbidden;

  const limited = await assertRateLimitJson(request, "patch_order_location", 60);
  if (limited) return limited;

  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId).trim();
  if (!ORDER_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
  }

  const raw = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!raw) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const lng = Number(raw.lng);
  const lat = Number(raw.lat);
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return NextResponse.json(
      { error: "lng/lat are required numbers." },
      { status: 400 },
    );
  }

  const name =
    typeof raw.name === "string" ? raw.name.trim().slice(0, 80) : undefined;
  const phone =
    typeof raw.phone === "string" ? raw.phone.trim().slice(0, 30) : undefined;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Order storage is not configured." },
      { status: 503 },
    );
  }
  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { error: "Order storage is temporarily unavailable." },
      { status: 503 },
    );
  }

  // Fetch the previous rider position + delivery coords so we can compute
  // bearing-relative-to-previous and ETA.
  const existing = await sql<
    {
      deliveryLng: string | number | null;
      deliveryLat: string | number | null;
      riderLng: string | number | null;
      riderLat: string | number | null;
    }[]
  >`
    SELECT delivery_lng, delivery_lat, rider_lng, rider_lat
    FROM orders WHERE id = ${id} LIMIT 1
  `;
  const row = existing[0];
  if (!row) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const newRider: GeoPoint = { lng, lat };

  // Bearing — direction the rider is heading. Prefer the previous rider
  // position so the icon rotates as they move; fall back to bearing-to-delivery
  // when this is the first update.
  let bearing: number | undefined;
  const prevLng =
    row.riderLng != null ? Number(row.riderLng) : null;
  const prevLat =
    row.riderLat != null ? Number(row.riderLat) : null;
  const deliveryLng =
    row.deliveryLng != null ? Number(row.deliveryLng) : null;
  const deliveryLat =
    row.deliveryLat != null ? Number(row.deliveryLat) : null;

  if (
    prevLng != null &&
    prevLat != null &&
    Number.isFinite(prevLng) &&
    Number.isFinite(prevLat)
  ) {
    bearing = bearingDegrees({ lng: prevLng, lat: prevLat }, newRider);
  } else if (
    deliveryLng != null &&
    deliveryLat != null &&
    Number.isFinite(deliveryLng) &&
    Number.isFinite(deliveryLat)
  ) {
    bearing = bearingDegrees(newRider, { lng: deliveryLng, lat: deliveryLat });
  }

  // Recompute ETA (rider → delivery). Cheap fallback if Directions API fails.
  let etaMinutes: number | null = null;
  let routePolyline: string | null = null;
  if (
    deliveryLng != null &&
    deliveryLat != null &&
    Number.isFinite(deliveryLng) &&
    Number.isFinite(deliveryLat)
  ) {
    const delivery: GeoPoint = { lng: deliveryLng, lat: deliveryLat };
    const directions = await fetchDirections(newRider, delivery);
    if (directions) {
      etaMinutes = directions.etaMinutes;
      routePolyline = directions.polyline;
    } else {
      etaMinutes = fallbackEtaMinutes(newRider, delivery);
    }
  }

  const updatedAtIso = new Date().toISOString();
  const riderUpdate = {
    lng,
    lat,
    bearing,
    updatedAt: updatedAtIso,
    name,
    phone,
  };

  try {
    await sql`
      UPDATE orders SET
        rider_lng        = ${lng},
        rider_lat        = ${lat},
        rider_bearing    = ${bearing ?? null},
        rider_updated_at = ${updatedAtIso},
        rider_name       = ${name ?? null},
        rider_phone      = ${phone ?? null},
        eta_minutes      = COALESCE(${etaMinutes}, eta_minutes),
        route_polyline   = COALESCE(${routePolyline}, route_polyline)
      WHERE id = ${id}
    `;
  } catch (err) {
    console.error(
      "[dawasarthi] PATCH order location failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Could not update order location." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    riderLocation: riderUpdate,
    etaMinutes,
    routePolyline,
  });
}
