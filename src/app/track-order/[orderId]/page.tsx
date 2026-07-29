"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Ban, Bike, MapPin, PackageCheck, PackageSearch, Phone } from "lucide-react";
import { CancelOrderButton } from "@/components/cancel-order-button";
import { MotionItem, MotionSection, MotionStagger } from "@/components/motion-primitives";
import { OrderTimeline } from "@/components/order-timeline";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useIsClient } from "@/lib/use-is-client";
import type { OrderStatus } from "@/lib/types";

// Mapbox is ~200KB — lazy-load so the rest of the page isn't blocked.
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
type OrderItem = { name: string; quantity: number; price: string };
type RiderLocation = GeoPoint & {
  bearing?: number;
  updatedAt?: string;
  name?: string;
  phone?: string;
};

type ResolvedOrder = {
  id: string;
  customer?: string;
  city?: string;
  status: string;
  updatedAt?: string;
  placedAt?: string;
  items: OrderItem[];
  prescription?: boolean;
  address?: string;
  paymentMethod?: string;
  total?: string;
  deliveryCoords?: GeoPoint | null;
  storeCoords?: GeoPoint | null;
  riderLocation?: RiderLocation | null;
  etaMinutes?: number | null;
  routePolyline?: string | null;
  cancelledAt?: string;
  cancelReason?: string;
  cancelledBy?: "customer" | "admin";
};

type LocationSnapshot = {
  id: string;
  status: string;
  updatedAt: string;
  deliveryCoords: GeoPoint | null;
  storeCoords: GeoPoint | null;
  riderLocation: RiderLocation | null;
  etaMinutes: number | null;
  routePolyline: string | null;
};

/**
 * How often we re-poll the location endpoint while the order is active.
 * Quick-commerce platforms typically refresh every 4-8 seconds while
 * "Out for Delivery", and back off when packed/queued.
 */
function pollIntervalMs(status: string): number {
  switch (status) {
    case "Out for Delivery":
      return 6_000;
    case "Packed":
      return 12_000;
    case "Ordered":
      return 20_000;
    default:
      // Delivered, Cancelled, or unknown — terminal, stop polling.
      return 0;
  }
}

function formatEta(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "Estimating…";
  if (minutes <= 1) return "Arriving now";
  if (minutes < 60) return `Arriving in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `Arriving in ${h}h ${m}m`;
}

function relativeFromIso(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  return null;
}

export default function TrackOrderPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const isClient = useIsClient();
  const { isLoaded, isSignedIn, user } = useUser();

  /**
   * Optimistic order data from localStorage — populated post-mount so it
   * doesn't cause an SSR/CSR hydration mismatch and isn't re-parsed on every
   * render. The server fetch below supersedes it once it returns.
   */
  const [localOrder, setLocalOrder] = useState<ResolvedOrder | null>(null);
  useEffect(() => {
    if (!isClient || !user?.id) return;
    try {
      const raw = window.localStorage.getItem(`dawasarthi-orders:${user.id}`);
      if (!raw) return;
      const localOrders = JSON.parse(raw) as ResolvedOrder[];
      const found = localOrders.find((o) => o.id === orderId);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- bootstrapping optimistic UI from localStorage
      if (found) setLocalOrder(found);
    } catch {
      // localStorage unavailable / JSON corrupt — fall back to server fetch.
    }
  }, [isClient, user?.id, orderId]);

  const [lookupMatch, setLookupMatch] = useState<ResolvedOrder | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [liveSnapshot, setLiveSnapshot] = useState<LocationSnapshot | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const order = lookupMatch ?? localOrder;
  const loading = !isClient || !isLoaded;

  // Initial server fetch.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !orderId) return;
    let aborted = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch state
    setLookupBusy(true);
    setLookupError("");
    fetch("/api/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          order?: ResolvedOrder;
        };
        if (aborted) return;
        if (!res.ok) {
          if (res.status !== 404) {
            setLookupError(
              typeof data.error === "string" ? data.error : "Lookup failed.",
            );
          }
          return;
        }
        if (data.order) setLookupMatch(data.order);
      })
      .catch(() => {
        if (!aborted) setLookupError("Could not reach the server. Try again.");
      })
      .finally(() => {
        if (!aborted) setLookupBusy(false);
      });
    return () => {
      aborted = true;
    };
  }, [isLoaded, isSignedIn, orderId]);

  // Live-location polling. Pauses when the tab is hidden, stops on Delivered.
  useEffect(() => {
    if (!isSignedIn || !orderId) return;
    let cancelled = false;

    async function fetchOnce() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/location`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as LocationSnapshot | null;
        if (!cancelled && data) setLiveSnapshot(data);
      } catch {
        // network blip — try again on next tick
      }
    }

    function schedule() {
      const status = liveSnapshot?.status ?? order?.status ?? "Ordered";
      const interval = pollIntervalMs(status);
      if (interval <= 0) return;
      pollTimerRef.current = window.setTimeout(async () => {
        if (document.hidden) {
          schedule();
          return;
        }
        await fetchOnce();
        if (!cancelled) schedule();
      }, interval);
    }

    void fetchOnce();
    schedule();

    function onVisibility() {
      if (!document.hidden) void fetchOnce();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (pollTimerRef.current != null) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Re-arm when sign-in changes or the underlying status changes (so the
    // interval adapts to "Out for Delivery").
  }, [isSignedIn, orderId, liveSnapshot?.status, order?.status]);

  // Merge live snapshot (preferred) with the initial order data.
  const status = liveSnapshot?.status ?? order?.status ?? "Ordered";
  const deliveryCoords =
    liveSnapshot?.deliveryCoords ?? order?.deliveryCoords ?? null;
  const storeCoords = liveSnapshot?.storeCoords ?? order?.storeCoords ?? null;
  const riderLocation =
    liveSnapshot?.riderLocation ?? order?.riderLocation ?? null;
  const routePolyline =
    liveSnapshot?.routePolyline ?? order?.routePolyline ?? null;
  const etaMinutes =
    liveSnapshot?.etaMinutes ?? order?.etaMinutes ?? null;

  const isCancelled = status === "Cancelled";
  const isOnTheWay = status === "Out for Delivery";
  const hasAnyMapData =
    !isCancelled &&
    Boolean(deliveryCoords || storeCoords || riderLocation);
  const cancelReason = order?.cancelReason ?? null;
  const cancelledAt = order?.cancelledAt ?? null;

  // After the customer cancels, optimistically reflect it in state so they
  // don't see a stale status flash before the next poll lands.
  function applyCancellation(info: {
    status: OrderStatus;
    cancelReason?: string;
    cancelledAt?: string;
  }) {
    if (!order) return;
    const next: ResolvedOrder = {
      ...order,
      status: info.status,
      cancelReason: info.cancelReason,
      cancelledAt: info.cancelledAt,
    };
    setLookupMatch(next);
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div
            role="status"
            aria-label="Loading order"
            className="flex items-center justify-center py-24"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
            <span className="sr-only">Loading…</span>
          </div>
        ) : order === null ? (
          <MotionSection className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <PackageSearch className="h-8 w-8" aria-hidden />
            </div>
            <h1 className="text-2xl font-bold text-slate-950">Order not found</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              We could not find order{" "}
              <strong className="text-slate-900">{orderId}</strong>. Please check
              the order ID or contact support.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/account"
                className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
              >
                View My Orders
              </Link>
              <a
                href="tel:+919354360049"
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Call Support
              </a>
            </div>

            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-slate-50 p-5 text-left">
              <p className="text-sm font-semibold text-slate-950">
                Look up from our records
              </p>
              {isLoaded && !isSignedIn ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sign in with the account you used at checkout to see this order.
                  </p>
                  <Link
                    href={`/sign-in?redirect_url=${encodeURIComponent(`/track-order/${orderId}`)}`}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800"
                  >
                    Sign in to view order
                  </Link>
                </>
              ) : lookupBusy ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Looking up your order…
                </p>
              ) : (
                <p
                  role="alert"
                  className="mt-2 text-xs text-muted-foreground"
                >
                  {lookupError ||
                    "We could not find an order with this ID on your account. Please contact support if you placed an order recently."}
                </p>
              )}
            </div>
          </MotionSection>
        ) : (
          <MotionSection className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
                  Order tracking
                </p>
                <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
                  {order.id}
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {order.city ? `Delivery to ${order.city}. ` : ""}
                  {order.placedAt
                    ? `Placed on ${order.placedAt}.`
                    : order.updatedAt
                      ? `Last updated ${order.updatedAt}.`
                      : ""}
                </p>
              </div>
              <div
                className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                  isCancelled
                    ? "bg-rose-50 text-rose-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {isCancelled ? (
                  <Ban className="h-4 w-4" aria-hidden />
                ) : (
                  <PackageCheck className="h-4 w-4" aria-hidden />
                )}
                {status}
              </div>
            </div>

            {/* ── Cancellation banner ── */}
            {isCancelled && (
              <div
                role="status"
                className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900"
              >
                <p className="text-sm font-semibold">This order was cancelled.</p>
                {cancelReason && (
                  <p className="mt-1 text-sm">Reason: {cancelReason}</p>
                )}
                {cancelledAt && (
                  <p className="mt-1 text-xs text-rose-800/80">
                    Cancelled {new Date(cancelledAt).toLocaleString("en-IN")}
                  </p>
                )}
                <p className="mt-3 text-xs text-rose-800/80">
                  Any reserved items have been returned to stock. No payment was taken
                  since this is a Cash-on-Delivery order.
                </p>
              </div>
            )}

            {/* ── Live ETA pill — Zepto/Blinkit style ── */}
            {!isCancelled && (isOnTheWay || etaMinutes != null) && hasAnyMapData && (
              <div className="mt-6 flex flex-col gap-3 rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <Bike className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-100">
                      Live tracking
                    </p>
                    <p className="text-xl font-bold">
                      {formatEta(etaMinutes)}
                    </p>
                    {riderLocation?.updatedAt && (
                      <p className="text-xs text-brand-100/80">
                        Updated {relativeFromIso(riderLocation.updatedAt) ?? "just now"}
                      </p>
                    )}
                  </div>
                </div>
                {riderLocation?.phone && (
                  <a
                    href={`tel:${riderLocation.phone.replace(/\s/g, "")}`}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
                  >
                    <Phone className="h-4 w-4" aria-hidden />
                    Call {riderLocation.name?.split(" ")[0] ?? "rider"}
                  </a>
                )}
              </div>
            )}

            {/* ── Live map ── */}
            {hasAnyMapData ? (
              <div className="mt-6">
                <DeliveryMap
                  storeCoords={storeCoords}
                  deliveryCoords={deliveryCoords}
                  riderLocation={riderLocation}
                  routePolyline={routePolyline}
                />
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {riderLocation
                    ? "Your rider is on the way. Map refreshes every few seconds."
                    : deliveryCoords
                      ? "Order accepted. The rider will appear on the map once dispatched."
                      : "Map will appear once the address is geocoded."}
                </p>
              </div>
            ) : null}

            <div className="mt-8">
              <OrderTimeline currentStatus={status} />
            </div>

            <MotionStagger className="mt-8 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
              <MotionItem>
                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-950">
                    Order summary
                  </p>
                  <div className="mt-4 space-y-3">
                    {order.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 truncate text-muted-foreground">
                          {item.name} × {item.quantity}
                        </span>
                        <span className="shrink-0 font-medium text-slate-950">
                          {item.price}
                        </span>
                      </div>
                    ))}
                  </div>
                  {order.total && (
                    <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-bold text-slate-950">
                      <span>Total</span>
                      <span>{order.total}</span>
                    </div>
                  )}
                  {order.paymentMethod && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {order.paymentMethod}
                    </p>
                  )}
                </div>
              </MotionItem>
              <MotionItem>
                <div className="rounded-2xl bg-brand-50 p-5">
                  <p className="text-sm font-semibold text-brand-900">
                    Need help?
                  </p>
                  <p className="mt-3 text-sm leading-6 text-brand-900/80">
                    For any query about your order, call our 24x7 helpline at{" "}
                    <a
                      href="tel:+919354360049"
                      className="font-semibold underline"
                    >
                      +91 9354360049
                    </a>
                    .
                  </p>
                </div>
              </MotionItem>
            </MotionStagger>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/medicines"
                className="inline-flex rounded-2xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Order more medicines
              </Link>
              <CancelOrderButton
                orderId={order.id}
                status={(status as OrderStatus) ?? "Ordered"}
                variant="danger"
                size="md"
                onCancelled={applyCancellation}
              />
            </div>
          </MotionSection>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
