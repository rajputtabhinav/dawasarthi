import type { OrderStatus } from "@/lib/types";
import { getSql, isDatabaseConfigured } from "@/lib/db";
import { releaseStock } from "@/lib/server-medicines";

export type GeoPoint = { lng: number; lat: number };

export type RiderLocation = {
  lng: number;
  lat: number;
  /** Bearing in degrees 0-360 — used to rotate the rider marker. */
  bearing?: number;
  /** ISO timestamp of the last update. */
  updatedAt: string;
  /** Optional rider display name (Zepto-style "Aarav is on the way"). */
  name?: string;
  /** Optional rider phone for in-app call CTA. */
  phone?: string;
};

export type ServerOrder = {
  id: string;
  userId?: string;
  userEmail?: string;
  customer: string;
  city: string;
  status: OrderStatus;
  updatedAt: string;
  prescription: boolean;
  prescriptionId?: string;
  /** ISO timestamp when the order was cancelled (if any). */
  cancelledAt?: string;
  /** Free-text reason set by whoever cancelled. */
  cancelReason?: string;
  /** `customer` or `admin` — used for analytics + audit. */
  cancelledBy?: "customer" | "admin";
  items: Array<{
    medicineId?: string;
    name: string;
    quantity: number;
    price: string;
  }>;
  phone?: string;
  address?: string;
  total?: string;
  placedAt?: string;
  coupon?: string | null;
  paymentMethod?: string;
  /** Geocoded delivery point — set at order creation when available. */
  deliveryCoords?: GeoPoint;
  /** Snapshot of the dispatch origin (pharmacy / dark-store coords) at placement. */
  storeCoords?: GeoPoint;
  /** Live rider location — updated by admin / rider app while Out for Delivery. */
  riderLocation?: RiderLocation;
  /** Estimated minutes to delivery from the last directions calculation. */
  etaMinutes?: number;
  /** Cached encoded polyline (Mapbox geometry) — replayable without re-hitting Directions API. */
  routePolyline?: string;
};

const ALLOWED_PAYMENT_METHODS = new Set(["Cash on Delivery"]);

/**
 * Forward delivery flow. `Cancelled` is a terminal sibling state, not part of
 * the flow — admin or customer can transition INTO `Cancelled` from any
 * non-terminal status via the dedicated cancel route.
 */
const STATUS_FLOW: OrderStatus[] = [
  "Ordered",
  "Packed",
  "Out for Delivery",
  "Delivered",
];

const TERMINAL_STATUSES = new Set<OrderStatus>(["Delivered", "Cancelled"]);

/** Cryptographically random order ID. */
export function generateServerOrderId(): string {
  return `ORD${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

function parseCityFromAddress(address: string): string {
  const t = address.trim();
  if (!t) return "—";
  const parts = t.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1] ?? t;
  return t.length > 48 ? `${t.slice(0, 45)}…` : t;
}

function normalizeStatus(s: unknown): OrderStatus {
  if (s === "Confirmed") return "Ordered";
  if (
    s === "Ordered" ||
    s === "Packed" ||
    s === "Out for Delivery" ||
    s === "Delivered" ||
    s === "Cancelled"
  ) {
    return s;
  }
  return "Ordered";
}

function toFiniteNumber(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Build a trusted ServerOrder from server-controlled fields.
 * Note: all values here must already have been validated and authorized server-side.
 */
export function buildServerOrder(input: {
  userId?: string;
  userEmail?: string;
  customer: string;
  phone: string;
  address: string;
  city?: string;
  items: Array<{ name: string; quantity: number; price: string }>;
  total: string;
  coupon: string | null;
  prescription: boolean;
  prescriptionId?: string;
  paymentMethod: string;
  deliveryCoords?: GeoPoint;
  storeCoords?: GeoPoint;
}): ServerOrder {
  const placed = new Date().toLocaleString("en-IN");
  return {
    id: generateServerOrderId(),
    userId: input.userId,
    userEmail: input.userEmail,
    customer: input.customer || "Customer",
    city: input.city?.trim() || parseCityFromAddress(input.address),
    phone: input.phone || undefined,
    address: input.address || undefined,
    status: "Ordered",
    updatedAt: placed,
    prescription: input.prescription,
    prescriptionId: input.prescriptionId,
    items: input.items,
    total: input.total,
    placedAt: placed,
    coupon: input.coupon,
    paymentMethod: ALLOWED_PAYMENT_METHODS.has(input.paymentMethod)
      ? input.paymentMethod
      : "Cash on Delivery",
    deliveryCoords: input.deliveryCoords,
    storeCoords: input.storeCoords,
  };
}

/* ── Row → domain mapping ─────────────────────────────────────────────────── */

/**
 * Shape of a row returned by SELECT * FROM orders, after the `postgres.camel`
 * transform has converted snake_case columns to camelCase property names.
 *
 * Note: `updatedAt` here refers to the `status_updated_at` column (the
 * formatted en-IN string used in the API surface) — NOT the `updated_at`
 * trigger timestamp column. We always SELECT `status_updated_at AS updated_at`
 * to keep the domain shape stable.
 */
type OrderRow = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  customer: string;
  city: string;
  phone: string | null;
  address: string | null;
  status: string;
  updatedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  prescription: boolean;
  prescriptionId: string | null;
  total: string | null;
  placedAt: string | null;
  coupon: string | null;
  paymentMethod: string | null;
  deliveryLng: string | number | null;
  deliveryLat: string | number | null;
  storeLng: string | number | null;
  storeLat: string | number | null;
  riderLng: string | number | null;
  riderLat: string | number | null;
  riderBearing: string | number | null;
  riderUpdatedAt: string | null;
  riderName: string | null;
  riderPhone: string | null;
  etaMinutes: number | null;
  routePolyline: string | null;
};

type OrderItemRow = {
  medicineId: string | null;
  name: string;
  quantity: number;
  price: string;
};

/**
 * Columns we always SELECT for orders. Note the `status_updated_at AS
 * updated_at` alias — keeps the domain field name `updatedAt` while leaving
 * the trigger-managed `updated_at` column out of the result set.
 */
const ORDER_COLUMNS = `
  id, user_id, user_email, customer, city, phone, address, status,
  status_updated_at AS updated_at, cancelled_at, cancel_reason, cancelled_by,
  prescription, prescription_id, total, placed_at, coupon, payment_method,
  delivery_lng, delivery_lat, store_lng, store_lat, rider_lng, rider_lat,
  rider_bearing, rider_updated_at, rider_name, rider_phone, eta_minutes,
  route_polyline
`;

function rowToServerOrder(
  row: OrderRow,
  items: OrderItemRow[],
): ServerOrder {
  const deliveryLng = toFiniteNumber(row.deliveryLng);
  const deliveryLat = toFiniteNumber(row.deliveryLat);
  const storeLng = toFiniteNumber(row.storeLng);
  const storeLat = toFiniteNumber(row.storeLat);
  const riderLng = toFiniteNumber(row.riderLng);
  const riderLat = toFiniteNumber(row.riderLat);
  const riderBearing = toFiniteNumber(row.riderBearing);

  const deliveryCoords =
    deliveryLng !== undefined && deliveryLat !== undefined
      ? { lng: deliveryLng, lat: deliveryLat }
      : undefined;
  const storeCoords =
    storeLng !== undefined && storeLat !== undefined
      ? { lng: storeLng, lat: storeLat }
      : undefined;
  const riderLocation =
    riderLng !== undefined && riderLat !== undefined
      ? {
          lng: riderLng,
          lat: riderLat,
          bearing:
            riderBearing !== undefined &&
            riderBearing >= 0 &&
            riderBearing <= 360
              ? riderBearing
              : undefined,
          updatedAt: row.riderUpdatedAt ?? new Date().toISOString(),
          name: row.riderName ?? undefined,
          phone: row.riderPhone ?? undefined,
        }
      : undefined;

  return {
    id: row.id,
    userId: row.userId ?? undefined,
    userEmail: row.userEmail ?? undefined,
    customer: row.customer,
    city: row.city ?? "—",
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    status: normalizeStatus(row.status),
    updatedAt: row.updatedAt ?? "",
    cancelledAt: row.cancelledAt ?? undefined,
    cancelReason: row.cancelReason ?? undefined,
    cancelledBy:
      row.cancelledBy === "admin" || row.cancelledBy === "customer"
        ? row.cancelledBy
        : undefined,
    prescription: Boolean(row.prescription),
    prescriptionId: row.prescriptionId ?? undefined,
    items: items.map((it) => ({
      medicineId: it.medicineId ?? undefined,
      name: it.name,
      quantity: Math.max(1, Number(it.quantity) || 1),
      price: it.price,
    })),
    total: row.total ?? undefined,
    placedAt: row.placedAt ?? undefined,
    coupon: row.coupon ?? null,
    paymentMethod: row.paymentMethod ?? undefined,
    deliveryCoords,
    storeCoords,
    riderLocation,
    etaMinutes:
      typeof row.etaMinutes === "number" && Number.isFinite(row.etaMinutes)
        ? row.etaMinutes
        : undefined,
    routePolyline: row.routePolyline ?? undefined,
  };
}

/* ── Persistence ──────────────────────────────────────────────────────────── */

/**
 * Persist an order durably. Throws if the database is unavailable so the caller
 * surfaces a 503 to the client (preventing "phantom" orders that exist only in
 * per-lambda memory and disappear on cold start).
 */
export async function persistOrder(order: ServerOrder): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error("Order storage is not configured.");
  }
  const sql = getSql();
  if (!sql) throw new Error("Order storage is temporarily unavailable.");

  try {
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO orders (
          id, user_id, user_email, customer, city, phone, address, status,
          status_updated_at, cancelled_at, cancel_reason, cancelled_by,
          prescription, prescription_id, total, placed_at, coupon,
          payment_method, delivery_lng, delivery_lat, store_lng, store_lat,
          rider_lng, rider_lat, rider_bearing, rider_updated_at, rider_name,
          rider_phone, eta_minutes, route_polyline
        ) VALUES (
          ${order.id},
          ${order.userId ?? null},
          ${order.userEmail ?? null},
          ${order.customer},
          ${order.city},
          ${order.phone ?? null},
          ${order.address ?? null},
          ${order.status},
          ${order.updatedAt ?? null},
          ${order.cancelledAt ?? null},
          ${order.cancelReason ?? null},
          ${order.cancelledBy ?? null},
          ${order.prescription},
          ${order.prescriptionId ?? null},
          ${order.total ?? null},
          ${order.placedAt ?? null},
          ${order.coupon ?? null},
          ${order.paymentMethod ?? null},
          ${order.deliveryCoords?.lng ?? null},
          ${order.deliveryCoords?.lat ?? null},
          ${order.storeCoords?.lng ?? null},
          ${order.storeCoords?.lat ?? null},
          ${order.riderLocation?.lng ?? null},
          ${order.riderLocation?.lat ?? null},
          ${order.riderLocation?.bearing ?? null},
          ${order.riderLocation?.updatedAt ?? null},
          ${order.riderLocation?.name ?? null},
          ${order.riderLocation?.phone ?? null},
          ${order.etaMinutes ?? null},
          ${order.routePolyline ?? null}
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          user_email = EXCLUDED.user_email,
          customer = EXCLUDED.customer,
          city = EXCLUDED.city,
          phone = EXCLUDED.phone,
          address = EXCLUDED.address,
          status = EXCLUDED.status,
          status_updated_at = EXCLUDED.status_updated_at,
          cancelled_at = EXCLUDED.cancelled_at,
          cancel_reason = EXCLUDED.cancel_reason,
          cancelled_by = EXCLUDED.cancelled_by,
          prescription = EXCLUDED.prescription,
          prescription_id = EXCLUDED.prescription_id,
          total = EXCLUDED.total,
          placed_at = EXCLUDED.placed_at,
          coupon = EXCLUDED.coupon,
          payment_method = EXCLUDED.payment_method,
          delivery_lng = EXCLUDED.delivery_lng,
          delivery_lat = EXCLUDED.delivery_lat,
          store_lng = EXCLUDED.store_lng,
          store_lat = EXCLUDED.store_lat,
          rider_lng = EXCLUDED.rider_lng,
          rider_lat = EXCLUDED.rider_lat,
          rider_bearing = EXCLUDED.rider_bearing,
          rider_updated_at = EXCLUDED.rider_updated_at,
          rider_name = EXCLUDED.rider_name,
          rider_phone = EXCLUDED.rider_phone,
          eta_minutes = EXCLUDED.eta_minutes,
          route_polyline = EXCLUDED.route_polyline
      `;

      // Replace items wholesale — order_items has ON DELETE CASCADE so a
      // clean re-insert per upsert keeps the join table consistent.
      await tx`DELETE FROM order_items WHERE order_id = ${order.id}`;
      for (let i = 0; i < order.items.length; i++) {
        const it = order.items[i];
        if (!it) continue;
        await tx`
          INSERT INTO order_items (order_id, medicine_id, name, quantity, price, position)
          VALUES (
            ${order.id},
            ${it.medicineId ?? null},
            ${it.name},
            ${Math.max(1, Number(it.quantity) || 1)},
            ${it.price},
            ${i}
          )
        `;
      }
    });
  } catch (err) {
    console.error(
      "[dawasarthi] Postgres order persist failed:",
      err instanceof Error ? err.message : err,
    );
    throw new Error("Order storage is temporarily unavailable.");
  }
}

/** Load up to `limit` orders (most recent first) with their items. */
async function loadOrdersFromDb(limit = 200): Promise<ServerOrder[]> {
  const sql = getSql();
  if (!sql) return [];

  const cap = Math.min(Math.max(1, limit), 500);

  try {
    const orderRows = await sql<OrderRow[]>`
      SELECT ${sql.unsafe(ORDER_COLUMNS)}
      FROM orders
      ORDER BY created_at DESC
      LIMIT ${cap}
    `;
    if (orderRows.length === 0) return [];

    const ids = orderRows.map((r) => r.id);
    const itemRows = await sql<
      (OrderItemRow & { orderId: string; position: number })[]
    >`
      SELECT order_id, medicine_id, name, quantity, price, position
      FROM order_items
      WHERE order_id IN ${sql(ids)}
      ORDER BY order_id, position
    `;

    const byOrder = new Map<string, OrderItemRow[]>();
    for (const row of itemRows) {
      const list = byOrder.get(row.orderId) ?? [];
      list.push({
        medicineId: row.medicineId,
        name: row.name,
        quantity: row.quantity,
        price: row.price,
      });
      byOrder.set(row.orderId, list);
    }

    return orderRows.map((r) => rowToServerOrder(r, byOrder.get(r.id) ?? []));
  } catch (err) {
    console.error(
      "[dawasarthi] loadOrdersFromDb failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/** Orders from Postgres, newest first. Capped for admin dashboards. */
export async function getMergedOrders(limit = 200): Promise<ServerOrder[]> {
  return loadOrdersFromDb(limit);
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<ServerOrder | null> {
  const sql = getSql();
  if (!sql) return null;

  const stamp = new Date().toLocaleString("en-IN");
  const nextIdx = STATUS_FLOW.indexOf(status);
  if (nextIdx < 0) return null;

  // Idempotent forward-only: include the target status itself in the allowed
  // prior states so a repeat PATCH is a no-op rather than an error.
  const allowedPrev = STATUS_FLOW.slice(0, nextIdx + 1);

  try {
    // Atomic conditional UPDATE: two concurrent PATCHes from the same
    // baseline can't both move the order forward.
    const updated = await sql<OrderRow[]>`
      UPDATE orders
      SET status = ${status}, status_updated_at = ${stamp}
      WHERE id = ${id} AND status IN ${sql(allowedPrev)}
      RETURNING ${sql.unsafe(ORDER_COLUMNS)}
    `;

    if (updated.length > 0) {
      const row = updated[0]!;
      const items = await sql<OrderItemRow[]>`
        SELECT medicine_id, name, quantity, price
        FROM order_items WHERE order_id = ${row.id}
        ORDER BY position
      `;
      return rowToServerOrder(row, items);
    }

    // No row matched — either the order doesn't exist or its status is
    // already ahead of `status`. Return the current state so the caller
    // can render reality.
    return findOrderById(id);
  } catch (err) {
    console.error(
      "[dawasarthi] updateOrderStatus failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Look up a single order with items, ignoring ownership. Internal use plus
 * exported for admin-only routes (the caller is responsible for the
 * admin-auth check before invoking this).
 */
export async function findOrderForAdmin(id: string): Promise<ServerOrder | null> {
  return findOrderById(id);
}

/** Look up a single order with items, ignoring ownership. */
async function findOrderById(id: string): Promise<ServerOrder | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const rows = await sql<OrderRow[]>`
      SELECT ${sql.unsafe(ORDER_COLUMNS)} FROM orders WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    const items = await sql<OrderItemRow[]>`
      SELECT medicine_id, name, quantity, price
      FROM order_items WHERE order_id = ${id}
      ORDER BY position
    `;
    return rowToServerOrder(row, items);
  } catch {
    return null;
  }
}

export type CancelOrderInput = {
  orderId: string;
  /** Who initiated the cancellation. */
  actor: "customer" | "admin";
  /** Clerk userId of the customer — required when `actor === "customer"`. */
  userId?: string;
  /** Free-text reason; falls back to a default. */
  reason?: string;
};

export type CancelOrderResult =
  | { ok: true; order: ServerOrder }
  | { ok: false; status: 400 | 403 | 404 | 409 | 503; error: string };

/**
 * Cancel an order and release its reserved stock atomically.
 *
 * Authorisation rules:
 *  • Customers can cancel only their own orders, and only while the status
 *    is `Ordered` or `Packed`. Once the rider is dispatched the customer
 *    must phone support.
 *  • Admins can cancel any non-terminal order.
 *
 * Uses a single conditional UPDATE to defeat the obvious race where two
 * cancel requests (or a cancel + an admin "Out for Delivery") land
 * concurrently — only one transition wins. Stock is released afterwards via
 * `releaseStock`, which is idempotent against untracked rows.
 */
export async function cancelOrder(
  input: CancelOrderInput,
): Promise<CancelOrderResult> {
  const orderId = input.orderId?.trim();
  if (!orderId) {
    return { ok: false, status: 400, error: "Missing order id." };
  }
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      status: 503,
      error: "Order storage is not configured.",
    };
  }
  const sql = getSql();
  if (!sql) {
    return {
      ok: false,
      status: 503,
      error: "Order storage is temporarily unavailable.",
    };
  }

  // Pre-fetch so we can return a helpful 403/404/409 before the conditional
  // update.
  const existing = await findOrderById(orderId);
  if (!existing) {
    return { ok: false, status: 404, error: "Order not found." };
  }

  if (input.actor === "customer") {
    if (!input.userId || existing.userId !== input.userId) {
      return { ok: false, status: 404, error: "Order not found." };
    }
    if (existing.status !== "Ordered" && existing.status !== "Packed") {
      return {
        ok: false,
        status: 409,
        error:
          existing.status === "Out for Delivery"
            ? "This order is already out for delivery. Please call support."
            : existing.status === "Delivered"
              ? "This order is already delivered."
              : "This order is already cancelled.",
      };
    }
  } else {
    if (TERMINAL_STATUSES.has(existing.status)) {
      return {
        ok: false,
        status: 409,
        error: `Order is already ${existing.status}.`,
      };
    }
  }

  const reason =
    (input.reason ?? "").trim().slice(0, 200) ||
    (input.actor === "customer"
      ? "Cancelled by customer"
      : "Cancelled by admin");
  const stamp = new Date().toLocaleString("en-IN");
  const isoStamp = new Date().toISOString();

  const allowedFromStatuses: OrderStatus[] =
    input.actor === "customer"
      ? ["Ordered", "Packed"]
      : ["Ordered", "Packed", "Out for Delivery"];

  try {
    // Defence-in-depth: include user_id in the WHERE for customer-actor
    // cancellations. The JS-level ownership check above already gates this,
    // but pushing the same predicate into SQL means a bug or future refactor
    // can't accidentally let a customer cancel someone else's order.
    const updated =
      input.actor === "customer"
        ? await sql<OrderRow[]>`
            UPDATE orders SET
              status = 'Cancelled',
              status_updated_at = ${stamp},
              cancelled_at = ${isoStamp},
              cancel_reason = ${reason},
              cancelled_by = ${input.actor}
            WHERE id = ${orderId}
              AND user_id = ${input.userId ?? ""}
              AND status IN ${sql(allowedFromStatuses)}
            RETURNING ${sql.unsafe(ORDER_COLUMNS)}
          `
        : await sql<OrderRow[]>`
            UPDATE orders SET
              status = 'Cancelled',
              status_updated_at = ${stamp},
              cancelled_at = ${isoStamp},
              cancel_reason = ${reason},
              cancelled_by = ${input.actor}
            WHERE id = ${orderId} AND status IN ${sql(allowedFromStatuses)}
            RETURNING ${sql.unsafe(ORDER_COLUMNS)}
          `;

    if (updated.length === 0) {
      // Someone beat us to it. 409 — caller can refetch.
      const stillThere = await findOrderById(orderId);
      if (!stillThere) {
        return { ok: false, status: 404, error: "Order not found." };
      }
      return {
        ok: false,
        status: 409,
        error: "Order state changed before cancellation could be applied.",
      };
    }

    const row = updated[0]!;
    const items = await sql<OrderItemRow[]>`
      SELECT medicine_id, name, quantity, price
      FROM order_items WHERE order_id = ${orderId}
      ORDER BY position
    `;
    const cancelled = rowToServerOrder(row, items);

    // Release reserved stock — best-effort. The cancellation is already
    // durable; failing to release shouldn't reverse it.
    try {
      const releaseItems = cancelled.items
        .filter((it): it is typeof it & { medicineId: string } =>
          typeof it.medicineId === "string" && it.medicineId.length > 0,
        )
        .map((it) => ({ medicineId: it.medicineId, quantity: it.quantity }));
      if (releaseItems.length > 0) {
        await releaseStock(releaseItems);
      }
    } catch (err) {
      console.error(
        "[dawasarthi] cancelOrder: stock release failed:",
        err instanceof Error ? err.message : err,
      );
    }

    return { ok: true, order: cancelled };
  } catch (err) {
    console.error(
      "[dawasarthi] cancelOrder failed:",
      err instanceof Error ? err.message : err,
    );
    return {
      ok: false,
      status: 503,
      error: "Order storage is temporarily unavailable.",
    };
  }
}

/** Lookup a single order by ID for the authenticated user. */
export async function findUserOrderById(
  userId: string,
  orderId: string,
): Promise<ServerOrder | null> {
  if (!userId || !orderId) return null;
  const sql = getSql();
  if (!sql) return null;
  try {
    const rows = await sql<OrderRow[]>`
      SELECT ${sql.unsafe(ORDER_COLUMNS)}
      FROM orders WHERE id = ${orderId} AND user_id = ${userId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    const items = await sql<OrderItemRow[]>`
      SELECT medicine_id, name, quantity, price
      FROM order_items WHERE order_id = ${orderId}
      ORDER BY position
    `;
    return rowToServerOrder(row, items);
  } catch {
    return null;
  }
}

/** List a user's own orders. */
export async function listUserOrders(
  userId: string,
  limit = 50,
): Promise<ServerOrder[]> {
  if (!userId) return [];
  const sql = getSql();
  if (!sql) return [];
  const cap = Math.min(Math.max(1, limit), 200);
  try {
    const orderRows = await sql<OrderRow[]>`
      SELECT ${sql.unsafe(ORDER_COLUMNS)}
      FROM orders WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${cap}
    `;
    if (orderRows.length === 0) return [];

    const ids = orderRows.map((r) => r.id);
    const itemRows = await sql<
      (OrderItemRow & { orderId: string; position: number })[]
    >`
      SELECT order_id, medicine_id, name, quantity, price, position
      FROM order_items
      WHERE order_id IN ${sql(ids)}
      ORDER BY order_id, position
    `;
    const byOrder = new Map<string, OrderItemRow[]>();
    for (const row of itemRows) {
      const list = byOrder.get(row.orderId) ?? [];
      list.push({
        medicineId: row.medicineId,
        name: row.name,
        quantity: row.quantity,
        price: row.price,
      });
      byOrder.set(row.orderId, list);
    }

    return orderRows.map((r) => rowToServerOrder(r, byOrder.get(r.id) ?? []));
  } catch {
    return [];
  }
}
