"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Ban,
  CheckCircle,
  Clock,
  MapPin,
  Package,
  Phone,
  Printer,
  Search,
  Truck,
  X,
} from "lucide-react";
import { AdminOrderTracking } from "@/components/admin-order-tracking";
import { CancelOrderButton } from "@/components/cancel-order-button";
import type { OrderStatus } from "@/lib/types";

type GeoPoint = { lng: number; lat: number };
type RiderLocation = GeoPoint & {
  bearing?: number;
  updatedAt: string;
  name?: string;
  phone?: string;
};

type Order = {
  id: string;
  customer: string;
  city: string;
  status: OrderStatus;
  updatedAt: string;
  prescription: boolean;
  items: Array<{ name: string; quantity: number; price: string }>;
  phone?: string;
  address?: string;
  deliveryCoords?: GeoPoint | null;
  storeCoords?: GeoPoint | null;
  riderLocation?: RiderLocation | null;
  etaMinutes?: number | null;
  routePolyline?: string | null;
};

const STATUS_FLOW: OrderStatus[] = [
  "Ordered",
  "Packed",
  "Out for Delivery",
  "Delivered",
];

const STATUS_META: Record<
  OrderStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  Ordered: { label: "Ordered", color: "bg-slate-100 text-slate-700", icon: Clock },
  Packed: { label: "Packed", color: "bg-blue-100 text-blue-700", icon: Package },
  "Out for Delivery": {
    label: "Out for Delivery",
    color: "bg-amber-100 text-amber-700",
    icon: Truck,
  },
  Delivered: {
    label: "Delivered",
    color: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle,
  },
  Cancelled: {
    label: "Cancelled",
    color: "bg-rose-100 text-rose-700",
    icon: Ban,
  },
};

const FILTER_TABS = ["All", ...STATUS_FLOW, "Cancelled"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [newOrderAlerts, setNewOrderAlerts] = useState<
    Array<{ id: string; customer: string }>
  >([]);

  const isFirstRefresh = useRef(true);
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function refreshOrders() {
      if (document.hidden) return; // pause polling while tab is backgrounded
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setLoadError("Could not load orders. Check the server and try again.");
            setLoading(false);
          }
          return;
        }
        const data = (await res.json()) as { orders: Order[] };
        const list = data.orders;

        const isPolling = !isFirstRefresh.current;
        if (isPolling) {
          const fresh: Array<{ id: string; customer: string }> = [];
          for (const o of list) {
            if (!knownIdsRef.current.has(o.id)) {
              knownIdsRef.current.add(o.id);
              fresh.push({ id: o.id, customer: o.customer });
              if (
                typeof window !== "undefined" &&
                "Notification" in window &&
                Notification.permission === "granted"
              ) {
                new Notification("New order placed", {
                  body: `${o.id} — ${o.customer}`,
                  tag: o.id,
                });
              }
            }
          }
          if (fresh.length > 0 && !cancelled) {
            // Append, deduped — every new order gets a visible toast in order.
            setNewOrderAlerts((curr) => {
              const seen = new Set(curr.map((a) => a.id));
              return [
                ...curr,
                ...fresh.filter((a) => !seen.has(a.id)),
              ].slice(-5);
            });
          }
        }

        for (const o of list) {
          knownIdsRef.current.add(o.id);
        }
        isFirstRefresh.current = false;

        if (!cancelled) {
          setOrders(list);
          setLoadError("");
        }
      } catch {
        if (!cancelled) {
          setLoadError("Could not load orders. Check the server and try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void refreshOrders();
    const interval = setInterval(() => void refreshOrders(), 10_000);
    const onVisibility = () => {
      if (!document.hidden) void refreshOrders();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const tabMatch = activeTab === "All" || o.status === activeTab;
      const searchMatch =
        search.trim() === "" ||
        o.id.toLowerCase().includes(search.toLowerCase()) ||
        o.customer.toLowerCase().includes(search.toLowerCase()) ||
        o.city.toLowerCase().includes(search.toLowerCase()) ||
        (o.phone?.toLowerCase().includes(search.toLowerCase()) ?? false);
      return tabMatch && searchMatch;
    });
  }, [orders, activeTab, search]);

  const countByStatus = useMemo(() => {
    const map: Record<string, number> = { All: orders.length };
    STATUS_FLOW.forEach((s) => {
      map[s] = orders.filter((o) => o.status === s).length;
    });
    return map;
  }, [orders]);

  async function updateStatus(orderId: string, newStatus: OrderStatus) {
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { order: Order };
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...data.order } : o)),
      );
    } catch {
      // keep UI unchanged on failure
    }
  }

  return (
    <div className="space-y-5">
      {newOrderAlerts.length > 0 && (
        <div role="status" aria-live="polite" className="space-y-2">
          {newOrderAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950 shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-200/80">
                  <Bell className="h-5 w-5 text-emerald-900" aria-hidden />
                </span>
                <p className="text-sm font-semibold leading-snug">
                  New order: <span className="font-bold">{alert.id}</span>
                  <span className="font-normal text-emerald-800">
                    {" "}
                    — {alert.customer}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setNewOrderAlerts((curr) =>
                    curr.filter((a) => a.id !== alert.id),
                  )
                }
                aria-label="Dismiss notification"
                className="shrink-0 rounded-lg p-1.5 text-emerald-800 hover:bg-emerald-100"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
            Orders
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Order Management
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, customer, city…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 sm:w-64"
          />
        </div>
      </div>

      {loadError && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {loadError}
        </p>
      )}

      {/* Status filter tabs */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab
                ? "bg-brand-700 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab}
            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                activeTab === tab ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {countByStatus[tab] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-white py-16 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700" />
          <p className="mt-4 text-sm text-muted-foreground">Loading orders…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white py-16 text-center">
          <p className="font-semibold text-slate-900">No orders found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different filter or search term.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => {
            const meta = STATUS_META[order.status];
            const StatusIcon = meta.icon;
            const currentIdx = STATUS_FLOW.indexOf(order.status);

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                {/* Order header */}
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 rounded-full p-2 ${meta.color.split(" ")[0]}`}
                    >
                      <StatusIcon
                        className={`h-4 w-4 ${meta.color.split(" ")[1]}`}
                      />
                    </div>
                    <div>
                      <p className="font-bold text-slate-950">{order.id}</p>
                      <p className="text-sm text-slate-600">
                        {order.customer} · {order.city}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.updatedAt}
                        {order.prescription && (
                          <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                            Rx attached
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Contact button */}
                  <div className="flex items-center gap-2">
                  <a
                    href={`https://wa.me/${order.phone?.replace(/\D/g, "") || "919354360049"}?text=${encodeURIComponent(`Regarding order ${order.id}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    WhatsApp
                  </a>
                    <a
                      href={order.phone ? `tel:${order.phone.replace(/\s/g, "")}` : "tel:+919354360049"}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Phone className="h-3 w-3" /> Call
                    </a>
                    <Link
                      href={`/track-order/${order.id}`}
                      className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      View
                    </Link>
                  </div>
                </div>

                {/* Items */}
                <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {order.items.map((item, itemIdx) => (
                    <div
                      key={`${order.id}-${itemIdx}-${item.name}`}
                      className="rounded-xl bg-slate-50 px-3 py-2.5"
                    >
                      <p className="text-sm font-semibold text-slate-900 leading-snug">
                        {item.name}
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Qty {item.quantity}
                        </p>
                        <p className="text-xs font-semibold text-slate-900">
                          {item.price}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Status pipeline */}
                <div className="border-t border-slate-100 px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Update Status
                    </p>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/orders/${encodeURIComponent(order.id)}/print`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-900"
                      >
                        <Printer className="h-3.5 w-3.5" aria-hidden />
                        Print slip
                      </Link>
                      <CancelOrderButton
                        orderId={order.id}
                        status={order.status}
                        isAdmin
                        variant="linkRed"
                        size="sm"
                        onCancelled={(info) =>
                          setOrders((curr) =>
                            curr.map((o) =>
                              o.id === order.id
                                ? { ...o, status: info.status }
                                : o,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_FLOW.map((status, idx) => {
                      const isActive = status === order.status;
                      const isDone = idx < currentIdx;
                      const orderTerminal =
                        order.status === "Cancelled" ||
                        order.status === "Delivered";

                      return (
                        <button
                          key={status}
                          onClick={() => updateStatus(order.id, status)}
                          disabled={orderTerminal}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            isActive
                              ? "bg-brand-700 text-white"
                              : isDone
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          } ${orderTerminal ? "pointer-events-none opacity-50" : ""}`}
                        >
                          {isActive && "→ "}
                          {status}
                        </button>
                      );
                    })}
                  </div>
                  {order.status === "Cancelled" && (
                    <p className="mt-2 text-xs text-rose-700">
                      This order is cancelled.
                    </p>
                  )}
                </div>

                {/* Live rider tracking (collapsible). Show by default for
                    Out for Delivery; admin can also expand earlier. Hidden
                    entirely on Cancelled / Delivered. */}
                {order.status !== "Cancelled" && order.status !== "Delivered" && (
                <details
                  className="border-t border-slate-100 px-4 py-3"
                  open={order.status === "Out for Delivery"}
                >
                  <summary className="cursor-pointer list-none">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-brand-700" aria-hidden />
                      Live tracking
                      {order.etaMinutes != null && (
                        <span className="ml-1 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold text-white">
                          ETA {order.etaMinutes} min
                        </span>
                      )}
                    </span>
                  </summary>
                  <div className="mt-3">
                    <AdminOrderTracking
                      orderId={order.id}
                      initialDeliveryCoords={order.deliveryCoords ?? null}
                      initialStoreCoords={order.storeCoords ?? null}
                      initialRider={order.riderLocation ?? null}
                      initialRoutePolyline={order.routePolyline ?? null}
                      initialEtaMinutes={order.etaMinutes ?? null}
                    />
                  </div>
                </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
