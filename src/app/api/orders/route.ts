import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { requireAdminJson } from "@/lib/admin-auth";
import { assertRateLimitJson } from "@/lib/server-rate-limit";
import {
  BODY_LIMIT_JSON_SMALL,
  enforceContentLength,
  enforceSameOrigin,
} from "@/lib/request-limits";
import {
  buildTrustedTotals,
  validateCheckoutShipment,
} from "@/lib/server-order-pricing";
import { loadMedicinesFromDb } from "@/lib/server-medicines-catalog";
import { releaseStock, reserveStock } from "@/lib/server-medicines";
import { prescriptionBelongsToUser } from "@/lib/server-prescriptions";
import {
  escapeTelegramHtml,
  isTelegramConfigured,
  sendAdminTelegramMessage,
} from "@/lib/telegram";
import {
  MAX_DELIVERY_KM,
  STORE_COORDS,
  fetchDirections,
  geocodeAddress,
  haversineMeters,
} from "@/lib/mapbox";
import {
  buildServerOrder,
  getMergedOrders,
  listUserOrders,
  persistOrder,
} from "@/lib/server-orders";

export async function GET(request: Request) {
  // If the caller is an admin, return the merged list; otherwise return only their orders.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminBlock = await requireAdminJson();
  if (!adminBlock) {
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(1, Number(url.searchParams.get("limit") ?? 200)),
      500,
    );
    const orders = await getMergedOrders(limit);
    return NextResponse.json({ orders });
  }

  // Non-admin authenticated user — return only their orders.
  const orders = await listUserOrders(userId, 50);
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const csrfRejected = enforceSameOrigin(request);
  if (csrfRejected) return csrfRejected;

  const tooBig = enforceContentLength(request, BODY_LIMIT_JSON_SMALL);
  if (tooBig) return tooBig;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to place an order." },
      { status: 401 },
    );
  }

  const limited = await assertRateLimitJson(request, "post_orders", 10, {
    userId,
  });
  if (limited) return limited;

  try {
    const raw = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!raw) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const shipment = validateCheckoutShipment(raw);
    const catalogue = await loadMedicinesFromDb();
    if (catalogue.length === 0) {
      return NextResponse.json(
        { error: "Catalogue is temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }

    const trusted = buildTrustedTotals(raw.items, raw.coupon, catalogue);

    // If the cart contains a prescription medicine, require a server-verified
    // prescriptionId that belongs to the same user (defence against client-submitted flag spoofing).
    const prescriptionIdRaw =
      typeof raw.prescriptionId === "string" ? raw.prescriptionId.trim() : "";
    if (trusted.requiresPrescription) {
      if (!prescriptionIdRaw) {
        return NextResponse.json(
          {
            error:
              "This order contains prescription medicines. Please upload a valid prescription first.",
          },
          { status: 400 },
        );
      }
      // Verify ownership in the DB — prevents a customer from passing someone
      // else's prescription id as proof for their Rx-flagged order.
      const owned = await prescriptionBelongsToUser(prescriptionIdRaw, userId);
      if (!owned) {
        return NextResponse.json(
          {
            error:
              "Prescription not found. Please upload a fresh prescription and retry.",
          },
          { status: 400 },
        );
      }
    }

    const user = await currentUser();
    const userEmail =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses?.[0]?.emailAddress;

    // Geocode + delivery-zone check happens BEFORE stock reservation so we
    // fail fast on out-of-zone orders without touching inventory.
    //
    // Geocoding itself is best-effort — if Mapbox returns nothing we let the
    // order through (rider can manually pin the customer later). We only
    // reject when we *can* place the address and it's measurably beyond the
    // delivery radius.
    const fullAddressForGeocode = [shipment.address, shipment.city, "India"]
      .filter(Boolean)
      .join(", ");
    const deliveryCoords =
      (await geocodeAddress(fullAddressForGeocode)) ?? undefined;

    if (deliveryCoords) {
      const distanceKm =
        haversineMeters(STORE_COORDS, deliveryCoords) / 1000;
      if (distanceKm > MAX_DELIVERY_KM) {
        return NextResponse.json(
          {
            error: `We currently deliver only within ${MAX_DELIVERY_KM} km of Dibiyapur. Your address is ${distanceKm.toFixed(1)} km away. Please call +91 93543 60049 if you'd like us to consider expanding.`,
            code: "outside_delivery_zone",
            distanceKm: Number(distanceKm.toFixed(1)),
            maxDeliveryKm: MAX_DELIVERY_KM,
          },
          { status: 400 },
        );
      }
    }

    // Atomically reserve stock for each line. If any item is short, fail fast
    // and roll back the previously-decremented lines.
    const stockReservations = trusted.items.map((line) => ({
      medicineId: line.medicineId,
      quantity: line.quantity,
    }));

    try {
      const reservation = await reserveStock(stockReservations);
      if (!reservation.ok) {
        // Map oosIds back to names for a helpful error.
        const oosNames = trusted.items
          .filter((line) => reservation.outOfStock.includes(line.medicineId))
          .map((line) => line.name);
        return NextResponse.json(
          {
            error:
              oosNames.length > 0
                ? `Out of stock: ${oosNames.join(", ")}. Please reduce the quantity or remove these items.`
                : "Some items are out of stock. Please review your cart.",
          },
          { status: 409 },
        );
      }
    } catch (err) {
      console.error(
        "[dawasarthi] stock reservation failed:",
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json(
        { error: "Inventory service is temporarily unavailable." },
        { status: 503 },
      );
    }

    // deliveryCoords was already computed above (zone check). Reuse it.
    let order = buildServerOrder({
      userId,
      userEmail: userEmail ?? undefined,
      customer: shipment.customer,
      phone: shipment.phone,
      address: shipment.address,
      city: shipment.city,
      items: trusted.items,
      total: trusted.totalFormatted,
      coupon: trusted.couponCode,
      prescription: trusted.requiresPrescription,
      prescriptionId: trusted.requiresPrescription
        ? prescriptionIdRaw
        : undefined,
      paymentMethod: "Cash on Delivery",
      deliveryCoords,
      storeCoords: STORE_COORDS,
    });

    // Pre-compute the store → delivery route + ETA so the customer sees
    // a real polyline + "Arriving in N min" pill immediately on the track page.
    if (deliveryCoords) {
      const directions = await fetchDirections(STORE_COORDS, deliveryCoords);
      if (directions) {
        order = {
          ...order,
          routePolyline: directions.polyline,
          etaMinutes: directions.etaMinutes,
        };
      }
    }

    try {
      await persistOrder(order);
    } catch (err) {
      // Order persist failed — release the stock we just reserved.
      try {
        await releaseStock(stockReservations);
      } catch {
        /* ignore */
      }
      console.error(
        "[dawasarthi] order persist failed:",
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json(
        { error: "We could not save your order. Please try again." },
        { status: 503 },
      );
    }

    // Fire-and-forget Telegram ping to the admin chat. `after()` runs
    // post-response on Vercel — keeps the customer's perceived order-place
    // latency unaffected. If Telegram is unconfigured or down, the helper
    // logs and returns false; the order is already durable in Postgres.
    if (isTelegramConfigured()) {
      const itemCount = order.items.reduce(
        (s, it) => s + Math.max(1, it.quantity),
        0,
      );
      const lines: string[] = [];
      lines.push(`🔔 <b>New order ${escapeTelegramHtml(order.id)}</b>`);
      lines.push(
        `${escapeTelegramHtml(order.customer)} · ${escapeTelegramHtml(order.phone ?? "")}`.trim(),
      );
      if (order.total) lines.push(`<b>${escapeTelegramHtml(order.total)}</b> · ${escapeTelegramHtml(order.paymentMethod ?? "COD")}`);
      lines.push(
        `${escapeTelegramHtml(order.city ?? "—")} · ${itemCount} ${itemCount === 1 ? "item" : "items"}`,
      );
      if (order.prescription) lines.push(`⚠ Rx — verify before dispatch`);
      lines.push(
        `<a href="https://dawasarthi.com/admin/orders">Open in admin</a>`,
      );
      const message = lines.join("\n");
      after(async () => {
        await sendAdminTelegramMessage(message);
      });
    }

    return NextResponse.json(
      {
        message: "Order created successfully.",
        order,
      },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
