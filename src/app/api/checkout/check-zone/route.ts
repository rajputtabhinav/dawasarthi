import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { assertRateLimitJson } from "@/lib/server-rate-limit";
import {
  MAX_DELIVERY_KM,
  STORE_COORDS,
  geocodeAddress,
  haversineMeters,
} from "@/lib/mapbox";

/**
 * Pre-flight delivery-zone check for the checkout page.
 *
 * Takes the four address fields, runs the same geocode the order POST will
 * do, and tells the client whether the address lies inside the delivery
 * radius. The client uses this to surface a calm "out of zone" notice
 * *before* submit, so the customer isn't surprised when the order POST
 * rejects them.
 *
 * The order POST does its own check independently — this endpoint is a UX
 * aid, not a security boundary.
 */

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tight cap — this fires on every address keystroke (debounced), and the
  // body is the smallest valid JSON. 60/min is generous.
  const limited = await assertRateLimitJson(
    request,
    "post_check_zone",
    60,
    { userId },
  );
  if (limited) return limited;

  const raw = (await request.json().catch(() => null)) as
    | { address?: unknown; city?: unknown }
    | null;
  if (!raw) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const address = typeof raw.address === "string" ? raw.address.trim() : "";
  const city = typeof raw.city === "string" ? raw.city.trim() : "";

  if (address.length < 8) {
    // Not enough to geocode meaningfully — tell the client to wait, not
    // a real "out of zone".
    return NextResponse.json(
      { ready: false, reason: "address_too_short" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const fullAddress = [address, city, "India"].filter(Boolean).join(", ");
  const coords = await geocodeAddress(fullAddress);
  if (!coords) {
    return NextResponse.json(
      { ready: false, reason: "geocode_failed" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const distanceKm = haversineMeters(STORE_COORDS, coords) / 1000;
  const inZone = distanceKm <= MAX_DELIVERY_KM;

  return NextResponse.json(
    {
      ready: true,
      inZone,
      distanceKm: Number(distanceKm.toFixed(1)),
      maxDeliveryKm: MAX_DELIVERY_KM,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
