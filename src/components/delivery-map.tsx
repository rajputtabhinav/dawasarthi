"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type GeoPoint = { lng: number; lat: number };

type RiderLocation = GeoPoint & {
  bearing?: number;
  updatedAt?: string;
};

export type DeliveryMapProps = {
  storeCoords: GeoPoint | null;
  deliveryCoords: GeoPoint | null;
  riderLocation: RiderLocation | null;
  /** Mapbox-encoded polyline (precision 6) from the Directions API. */
  routePolyline: string | null;
  /** Optional className applied to the map container. */
  className?: string;
  /**
   * When true, allow tap-to-drop a pin (admin location updater).
   * Calls `onPickLocation` with the chosen coords.
   */
  pickable?: boolean;
  onPickLocation?: (p: GeoPoint) => void;
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const ROUTE_SOURCE_ID = "dawasarthi-route";
const ROUTE_LAYER_BG_ID = "dawasarthi-route-bg";
const ROUTE_LAYER_ID = "dawasarthi-route-line";

/** Mapbox polyline6 decoder. Matches the encoder in src/lib/mapbox.ts. */
function decodePolyline6(encoded: string): Array<[number, number]> {
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

function makeStoreEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Pharmacy");
  el.style.cssText = `
    width: 36px; height: 36px; border-radius: 50%;
    background: #fff; border: 2px solid #0e7490;
    box-shadow: 0 6px 14px -4px rgba(15,118,110,0.45);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
  `;
  el.textContent = "🏥";
  return el;
}

function makeDeliveryEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Delivery address");
  el.style.cssText = `
    width: 36px; height: 36px; border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    background: #ef4444; border: 2px solid #fff;
    box-shadow: 0 6px 14px -4px rgba(220,38,38,0.55);
    display: flex; align-items: center; justify-content: center;
  `;
  const inner = document.createElement("div");
  inner.style.cssText = "transform: rotate(45deg); font-size: 16px;";
  inner.textContent = "📍";
  el.appendChild(inner);
  return el;
}

function makeRiderEl(): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.setAttribute("aria-label", "Rider");
  wrap.style.cssText = `
    width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  `;
  // Pulsing halo for "live" feel — same idea Zepto / Blinkit use.
  const halo = document.createElement("div");
  halo.style.cssText = `
    position: absolute; width: 44px; height: 44px; border-radius: 50%;
    background: rgba(14, 165, 233, 0.35);
    animation: dawasarthi-rider-pulse 1.6s ease-out infinite;
  `;
  const dot = document.createElement("div");
  dot.style.cssText = `
    position: relative; width: 28px; height: 28px; border-radius: 50%;
    background: #0ea5e9; border: 3px solid #fff;
    box-shadow: 0 4px 10px -2px rgba(2,132,199,0.6);
    display: flex; align-items: center; justify-content: center; font-size: 14px;
  `;
  dot.textContent = "🛵";
  wrap.appendChild(halo);
  wrap.appendChild(dot);
  return wrap;
}

/**
 * Inject the rider-halo keyframes once at module load. We avoid styled-jsx /
 * Tailwind here because Mapbox markers are appended directly to the DOM
 * outside React's tree.
 */
function ensureMarkerKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById("dawasarthi-rider-pulse-css")) return;
  const style = document.createElement("style");
  style.id = "dawasarthi-rider-pulse-css";
  style.textContent = `
    @keyframes dawasarthi-rider-pulse {
      0%   { transform: scale(0.6); opacity: 0.7; }
      80%  { transform: scale(1.6); opacity: 0; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export function DeliveryMap({
  storeCoords,
  deliveryCoords,
  riderLocation,
  routePolyline,
  className,
  pickable,
  onPickLocation,
}: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const storeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const deliveryMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const riderMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeAppliedRef = useRef<string | null>(null);

  const routeCoords = useMemo(() => {
    if (!routePolyline) return null;
    try {
      return decodePolyline6(routePolyline);
    } catch {
      return null;
    }
  }, [routePolyline]);

  // Initialise map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) {
      console.warn("[DeliveryMap] NEXT_PUBLIC_MAPBOX_TOKEN is not set.");
      return;
    }
    ensureMarkerKeyframes();

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const initialCenter: [number, number] =
      riderLocation
        ? [riderLocation.lng, riderLocation.lat]
        : deliveryCoords
          ? [deliveryCoords.lng, deliveryCoords.lat]
          : storeCoords
            ? [storeCoords.lng, storeCoords.lat]
            : [79.573333, 26.635833];

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: initialCenter,
      zoom: 13,
      attributionControl: false,
      cooperativeGestures: false,
    });

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      storeMarkerRef.current = null;
      deliveryMarkerRef.current = null;
      riderMarkerRef.current = null;
      routeAppliedRef.current = null;
    };
    // We intentionally do not include props in deps — the map should mount
    // once and react to prop changes through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Store marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!storeCoords) {
      storeMarkerRef.current?.remove();
      storeMarkerRef.current = null;
      return;
    }
    if (!storeMarkerRef.current) {
      storeMarkerRef.current = new mapboxgl.Marker({ element: makeStoreEl() })
        .setLngLat([storeCoords.lng, storeCoords.lat])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setText("Pharmacy"))
        .addTo(map);
    } else {
      storeMarkerRef.current.setLngLat([storeCoords.lng, storeCoords.lat]);
    }
  }, [storeCoords]);

  // Delivery marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!deliveryCoords) {
      deliveryMarkerRef.current?.remove();
      deliveryMarkerRef.current = null;
      return;
    }
    if (!deliveryMarkerRef.current) {
      deliveryMarkerRef.current = new mapboxgl.Marker({
        element: makeDeliveryEl(),
        anchor: "bottom",
      })
        .setLngLat([deliveryCoords.lng, deliveryCoords.lat])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setText("Delivery"))
        .addTo(map);
    } else {
      deliveryMarkerRef.current.setLngLat([deliveryCoords.lng, deliveryCoords.lat]);
    }
  }, [deliveryCoords]);

  // Rider marker — smooth move + bearing rotation.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!riderLocation) {
      riderMarkerRef.current?.remove();
      riderMarkerRef.current = null;
      return;
    }
    const lngLat: [number, number] = [riderLocation.lng, riderLocation.lat];
    if (!riderMarkerRef.current) {
      riderMarkerRef.current = new mapboxgl.Marker({
        element: makeRiderEl(),
        rotationAlignment: "viewport",
      })
        .setLngLat(lngLat)
        .addTo(map);
    } else {
      riderMarkerRef.current.setLngLat(lngLat);
    }
    if (typeof riderLocation.bearing === "number") {
      riderMarkerRef.current.setRotation(riderLocation.bearing);
    }
  }, [riderLocation]);

  // Route polyline.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function apply() {
      if (!map) return;
      // Remove previous layer/source if route changed (or cleared).
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getLayer(ROUTE_LAYER_BG_ID)) map.removeLayer(ROUTE_LAYER_BG_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
      if (!routeCoords || routeCoords.length < 2) return;

      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: routeCoords },
        },
      });
      // Soft outline + brand-coloured route line for contrast.
      map.addLayer({
        id: ROUTE_LAYER_BG_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 8,
          "line-opacity": 0.9,
        },
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#0e7490",
          "line-width": 5,
        },
      });
      routeAppliedRef.current = routePolyline ?? null;
    }

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [routeCoords, routePolyline]);

  // Auto-fit camera to all known points whenever they change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points: GeoPoint[] = [];
    if (storeCoords) points.push(storeCoords);
    if (deliveryCoords) points.push(deliveryCoords);
    if (riderLocation) points.push(riderLocation);
    if (routeCoords) {
      for (const [lng, lat] of routeCoords) points.push({ lng, lat });
    }
    if (points.length === 0) return;
    if (points.length === 1) {
      map.easeTo({
        center: [points[0]!.lng, points[0]!.lat],
        zoom: 14,
        duration: 600,
      });
      return;
    }
    const bounds = points.reduce(
      (b, p) => b.extend([p.lng, p.lat]),
      new mapboxgl.LngLatBounds(),
    );
    map.fitBounds(bounds, {
      padding: { top: 60, right: 40, bottom: 60, left: 40 },
      maxZoom: 15.5,
      duration: 700,
    });
  }, [storeCoords, deliveryCoords, riderLocation, routeCoords]);

  // Tap-to-drop pin (admin mode).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickable || !onPickLocation) return;
    function onClick(e: mapboxgl.MapMouseEvent) {
      onPickLocation?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    }
    map.on("click", onClick);
    map.getCanvas().style.cursor = "crosshair";
    return () => {
      map.off("click", onClick);
      if (map.getCanvas()) map.getCanvas().style.cursor = "";
    };
  }, [pickable, onPickLocation]);

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-border bg-slate-50 p-6 text-center text-sm text-muted-foreground ${className ?? ""}`}
      >
        Map unavailable — set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in env.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-72 w-full overflow-hidden rounded-2xl border border-border bg-slate-100 sm:h-96 ${className ?? ""}`}
      role="application"
      aria-label="Order tracking map"
    />
  );
}
