/**
 * Mapbox server-side helpers — geocoding, Directions API, ETA calculation.
 *
 * The browser-facing token (`NEXT_PUBLIC_MAPBOX_TOKEN`) is fine to expose,
 * but should be URL-restricted in the Mapbox dashboard. For high-volume
 * server work you can issue a separate token with stricter scopes via
 * `MAPBOX_SERVER_TOKEN`.
 */

export type GeoPoint = { lng: number; lat: number };

const MAPBOX_API = "https://api.mapbox.com";

/**
 * Dawasarthi dispatch origin. Matches `serviceLocations[0]` in src/lib/data.tsx
 * (Dibiyapur). Update this — and the seed coordinates in `data.tsx` — if you
 * open additional dark stores.
 */
export const STORE_COORDS: GeoPoint = { lng: 79.573333, lat: 26.635833 };

/**
 * Maximum delivery radius from `STORE_COORDS`, in kilometres. Addresses
 * geocoded beyond this distance are rejected at order placement and
 * highlighted to the customer at checkout.
 *
 * Bump this if we open a second store or extend coverage by hire-bike.
 */
export const MAX_DELIVERY_KM = 6;

function getServerToken(): string | null {
  const token =
    process.env.MAPBOX_SERVER_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  return token || null;
}

/**
 * Forward-geocode a free-text address. Biased to India and to ~50 km around
 * the Dibiyapur store so a vague "near temple road" still resolves locally.
 *
 * Returns null on any failure — callers should treat missing coords as a
 * non-fatal degradation (the order still places, the map shows the store +
 * a "location pending" pill).
 */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const token = getServerToken();
  const query = address.trim().slice(0, 256);
  if (!token || !query) return null;

  const url = new URL(
    `${MAPBOX_API}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "in");
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", "address,poi,locality,place,neighborhood");
  // Bias to a bounding box around the store (~0.5° ≈ 55 km).
  const { lng, lat } = STORE_COORDS;
  url.searchParams.set(
    "bbox",
    `${lng - 0.5},${lat - 0.5},${lng + 0.5},${lat + 0.5}`,
  );
  url.searchParams.set("proximity", `${lng},${lat}`);

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ center?: [number, number] }>;
    };
    const center = data.features?.[0]?.center;
    if (!center || center.length !== 2) return null;
    const [foundLng, foundLat] = center;
    if (!Number.isFinite(foundLng) || !Number.isFinite(foundLat)) return null;
    return { lng: foundLng, lat: foundLat };
  } catch (err) {
    console.error(
      "[dawasarthi] geocodeAddress failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export type DirectionsResult = {
  /** Encoded polyline (precision 6 — Mapbox default). */
  polyline: string;
  /** Total route distance in metres. */
  distanceMeters: number;
  /** Total route duration in seconds (driving). */
  durationSeconds: number;
  /** Rounded ETA in minutes, with a 1-minute floor. */
  etaMinutes: number;
};

/**
 * Mapbox Directions API — driving profile with traffic, geometry, and
 * step-free response (we only want the polyline + total).
 */
export async function fetchDirections(
  from: GeoPoint,
  to: GeoPoint,
): Promise<DirectionsResult | null> {
  const token = getServerToken();
  if (!token) return null;

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = new URL(
    `${MAPBOX_API}/directions/v5/mapbox/driving-traffic/${coords}`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "polyline6");
  url.searchParams.set("steps", "false");
  url.searchParams.set("alternatives", "false");

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{
        geometry?: string;
        distance?: number;
        duration?: number;
      }>;
    };
    const route = data.routes?.[0];
    if (!route?.geometry) return null;

    const distanceMeters = Number(route.distance ?? 0);
    const durationSeconds = Number(route.duration ?? 0);
    const etaMinutes = Math.max(
      1,
      Math.round(durationSeconds / 60),
    );

    return {
      polyline: route.geometry,
      distanceMeters,
      durationSeconds,
      etaMinutes,
    };
  } catch (err) {
    console.error(
      "[dawasarthi] fetchDirections failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Decode a Mapbox `polyline6` string into an array of `[lng, lat]`.
 * Implementation follows the Google polyline algorithm at precision 6.
 */
export function decodePolyline6(encoded: string): Array<[number, number]> {
  const factor = 1e6;
  const coords: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const len = encoded.length;
  while (index < len) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lng / factor, lat / factor]);
  }
  return coords;
}

/**
 * Haversine distance in metres between two points. Used as a cheap fallback
 * ETA when the Directions API is unavailable.
 */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Initial bearing (forward azimuth) from `a` to `b`, in degrees 0-360.
 */
export function bearingDegrees(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const λ1 = toRad(a.lng);
  const λ2 = toRad(b.lng);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Cheap-ETA fallback: assume 22 km/h average urban delivery speed +
 * a 2-minute handoff buffer. Used when Directions API is rate-limited or
 * the device is offline.
 */
export function fallbackEtaMinutes(from: GeoPoint, to: GeoPoint): number {
  const distanceKm = haversineMeters(from, to) / 1000;
  return Math.max(1, Math.round((distanceKm / 22) * 60) + 2);
}
