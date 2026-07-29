"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Crosshair, MapPin, Navigation, Save, Bike } from "lucide-react";

const DeliveryMap = dynamic(
  () => import("@/components/delivery-map").then((m) => m.DeliveryMap),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-label="Loading map"
        className="flex h-72 w-full items-center justify-center rounded-2xl border border-border bg-slate-100 sm:h-96"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
        <span className="sr-only">Loading map…</span>
      </div>
    ),
  },
);

type GeoPoint = { lng: number; lat: number };
type RiderLocation = GeoPoint & {
  bearing?: number;
  updatedAt: string;
  name?: string;
  phone?: string;
};

export type AdminOrderTrackingProps = {
  orderId: string;
  initialDeliveryCoords?: GeoPoint | null;
  initialStoreCoords?: GeoPoint | null;
  initialRider?: RiderLocation | null;
  initialRoutePolyline?: string | null;
  initialEtaMinutes?: number | null;
};

export function AdminOrderTracking({
  orderId,
  initialDeliveryCoords,
  initialStoreCoords,
  initialRider,
  initialRoutePolyline,
  initialEtaMinutes,
}: AdminOrderTrackingProps) {
  const [deliveryCoords] = useState<GeoPoint | null>(initialDeliveryCoords ?? null);
  const [storeCoords] = useState<GeoPoint | null>(initialStoreCoords ?? null);
  const [rider, setRider] = useState<RiderLocation | null>(initialRider ?? null);
  const [routePolyline, setRoutePolyline] = useState<string | null>(
    initialRoutePolyline ?? null,
  );
  const [etaMinutes, setEtaMinutes] = useState<number | null>(
    initialEtaMinutes ?? null,
  );
  const [pinMode, setPinMode] = useState(false);
  const [draftCoords, setDraftCoords] = useState<GeoPoint | null>(null);
  const [riderName, setRiderName] = useState(initialRider?.name ?? "");
  const [riderPhone, setRiderPhone] = useState(initialRider?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const submit = useCallback(
    async (coords: GeoPoint) => {
      setSaving(true);
      setStatus(null);
      try {
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderId)}/location`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lng: coords.lng,
              lat: coords.lat,
              name: riderName.trim() || undefined,
              phone: riderPhone.trim() || undefined,
            }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          riderLocation?: RiderLocation;
          etaMinutes?: number | null;
          routePolyline?: string | null;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "Update failed.");
        }
        if (data.riderLocation) setRider(data.riderLocation);
        setEtaMinutes(data.etaMinutes ?? null);
        if (data.routePolyline) setRoutePolyline(data.routePolyline);
        setStatus({
          kind: "ok",
          text: data.etaMinutes
            ? `Saved — ETA ${data.etaMinutes} min`
            : "Saved",
        });
        setDraftCoords(null);
        setPinMode(false);
      } catch (err) {
        setStatus({
          kind: "err",
          text: err instanceof Error ? err.message : "Update failed.",
        });
      } finally {
        setSaving(false);
      }
    },
    [orderId, riderName, riderPhone],
  );

  function handleUseDeviceGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus({ kind: "err", text: "Geolocation not supported on this device." });
      return;
    }
    setSaving(true);
    setStatus({ kind: "ok", text: "Reading device location…" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void submit({ lng: pos.coords.longitude, lat: pos.coords.latitude });
      },
      (err) => {
        setSaving(false);
        setStatus({
          kind: "err",
          text:
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied."
              : "Could not read device location.",
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }

  // Auto-clear status toast after 4s.
  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(id);
  }, [status]);

  const mapRider = draftCoords
    ? {
        lng: draftCoords.lng,
        lat: draftCoords.lat,
        updatedAt: new Date().toISOString(),
      }
    : rider;

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-brand-200 bg-brand-50/30 p-4">
      <div className="flex items-center gap-2">
        <Bike className="h-4 w-4 text-brand-700" aria-hidden />
        <p className="text-sm font-semibold text-slate-950">Rider tracking</p>
        {etaMinutes != null && (
          <span className="ml-auto rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold text-white">
            ETA {etaMinutes} min
          </span>
        )}
      </div>

      <DeliveryMap
        storeCoords={storeCoords}
        deliveryCoords={deliveryCoords}
        riderLocation={mapRider}
        routePolyline={routePolyline}
        pickable={pinMode}
        onPickLocation={(p) => setDraftCoords(p)}
        className="h-64 sm:h-72"
      />

      {pinMode && draftCoords && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>
            Pin: {draftCoords.lat.toFixed(5)}, {draftCoords.lng.toFixed(5)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDraftCoords(null)}
              className="rounded-full border border-amber-300 px-3 py-1 font-semibold text-amber-800 hover:bg-amber-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => draftCoords && void submit(draftCoords)}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-full bg-brand-700 px-3 py-1 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              <Save className="h-3 w-3" aria-hidden />
              Save pin
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={riderName}
          onChange={(e) => setRiderName(e.target.value)}
          placeholder="Rider name (optional)"
          maxLength={80}
          className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
          aria-label="Rider name"
        />
        <input
          type="tel"
          value={riderPhone}
          onChange={(e) => setRiderPhone(e.target.value)}
          placeholder="Rider phone (optional)"
          maxLength={30}
          inputMode="tel"
          className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
          aria-label="Rider phone"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleUseDeviceGps}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          <Crosshair className="h-3.5 w-3.5" aria-hidden />
          Use device GPS
        </button>
        <button
          type="button"
          onClick={() => {
            setPinMode((v) => !v);
            setDraftCoords(null);
          }}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
            pinMode
              ? "border-amber-300 bg-amber-100 text-amber-900"
              : "border-border bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {pinMode ? "Tap on map to drop pin" : "Drop pin on map"}
        </button>
        {rider && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-2 text-xs text-muted-foreground">
            <Navigation className="h-3.5 w-3.5" aria-hidden />
            Last update {new Date(rider.updatedAt).toLocaleTimeString("en-IN")}
          </span>
        )}
      </div>

      {status && (
        <p
          role={status.kind === "err" ? "alert" : "status"}
          className={`text-xs font-medium ${
            status.kind === "err" ? "text-rose-700" : "text-emerald-700"
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
