import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  IndianRupee,
  Package,
  Phone,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { AdminRevenueChart } from "@/components/admin-revenue-chart";
import { AdminTopSellersChart } from "@/components/admin-top-sellers-chart";
import {
  loadDailyRevenue,
  loadTopSellers,
  summariseRevenue,
} from "@/lib/admin-analytics";
import { loadMedicinesFromDb } from "@/lib/server-medicines-catalog";
import { getMergedOrders } from "@/lib/server-orders";

export default async function AdminDashboardPage() {
  // All four data sources fetched in parallel — keeps the cold load fast.
  const [medicines, orders, revenueSeries, topSellers] = await Promise.all([
    loadMedicinesFromDb(),
    getMergedOrders(),
    loadDailyRevenue(30),
    loadTopSellers(30, 8),
  ]);

  const revenueSummary = summariseRevenue(revenueSeries);
  const totalRevenue = revenueSummary.totalRevenue;
  const revenueDelta = revenueSummary.pctChangeVsPrev;

  const rxMedicines = medicines.filter((m) => m.requiresPrescription).length;
  const prescriptionOrders = orders.filter((o) => o.prescription).length;

  const packed = orders.filter((o) => o.status === "Packed").length;
  const outForDelivery = orders.filter((o) => o.status === "Out for Delivery").length;
  const delivered = orders.filter((o) => o.status === "Delivered").length;
  const ordered = orders.filter((o) => o.status === "Ordered").length;

  const metrics = [
    {
      label: "Total Orders",
      value: String(orders.length),
      sub: "Live from Postgres",
      icon: ShoppingBag,
      trend: "neutral" as const,
      href: "/admin/orders",
    },
    {
      label: "Revenue (15d)",
      value: totalRevenue > 0
        ? `₹${Math.round(totalRevenue).toLocaleString("en-IN")}`
        : "—",
      sub:
        revenueDelta === null
          ? "Last 15 days"
          : `${revenueDelta >= 0 ? "+" : ""}${revenueDelta}% vs prev 15d`,
      icon: IndianRupee,
      trend:
        revenueDelta === null
          ? ("neutral" as const)
          : revenueDelta >= 0
            ? ("up" as const)
            : ("down" as const),
      href: "/admin/orders",
    },
    {
      label: "Customers",
      value: "—",
      sub: "List Clerk users or CRM when ready",
      icon: Users,
      trend: "neutral" as const,
      href: "/admin/users",
    },
    {
      label: "Medicines Live",
      value: String(medicines.length),
      sub: `${rxMedicines} Rx items`,
      icon: Activity,
      trend: "neutral" as const,
      href: "/admin/medicines",
    },
  ];

  const todayStats = [
    { label: "Ordered", value: String(ordered), color: "bg-slate-50 text-slate-700" },
    { label: "Packed", value: String(packed), color: "bg-blue-50 text-blue-700" },
    { label: "Out for Delivery", value: String(outForDelivery), color: "bg-amber-50 text-amber-700" },
    { label: "Delivered", value: String(delivered), color: "bg-emerald-50 text-emerald-700" },
    { label: "Rx orders (flag)", value: String(prescriptionOrders), color: "bg-purple-50 text-purple-700" },
    { label: "COD / analytics", value: "—", color: "bg-brand-50 text-brand-700" },
  ];

  const recentOrders = orders.slice(0, 5);

  /**
   * Low-stock list — medicines with a tracked stock count ≤ 10. Sorted by
   * remaining quantity ascending so the most urgent (out-of-stock) sit at
   * the top. Untracked items (stockOnHand undefined) are intentionally
   * skipped — those are "infinite supply" categories like bandages.
   */
  const LOW_STOCK_THRESHOLD = 10;
  const lowStockMedicines = medicines
    .filter(
      (m) =>
        typeof m.stockOnHand === "number" && m.stockOnHand <= LOW_STOCK_THRESHOLD,
    )
    .sort((a, b) => (a.stockOnHand ?? 0) - (b.stockOnHand ?? 0))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
          Dashboard
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
          Operations Overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Today —{" "}
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => {
          const TrendIcon =
            m.trend === "up"
              ? TrendingUp
              : m.trend === "down"
                ? TrendingDown
                : null;
          const trendColour =
            m.trend === "up"
              ? "text-emerald-700"
              : m.trend === "down"
                ? "text-rose-700"
                : "text-muted-foreground";
          return (
            <Link
              key={m.label}
              href={m.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-brand-50 p-2.5 text-brand-700">
                  <m.icon className="h-5 w-5" />
                </div>
                {TrendIcon && (
                  <span className={`flex items-center gap-0.5 text-xs font-semibold ${trendColour}`}>
                    <TrendIcon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                )}
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-950">{m.value}</p>
              <p className="mt-1 text-sm font-medium text-slate-600">{m.label}</p>
              <p className={`mt-0.5 text-xs ${trendColour}`}>{m.sub}</p>
            </Link>
          );
        })}
      </div>

      {/* Revenue trend — last 30 days, full width. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-950">Revenue trend</h2>
          <p className="text-xs text-muted-foreground">Last 30 days · IST</p>
        </div>
        <AdminRevenueChart data={revenueSeries} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-950">Order pipeline</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {todayStats.map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl p-4 ${color.split(" ")[0]}`}>
                <p className={`text-2xl font-bold ${color.split(" ")[1]}`}>{value}</p>
                <p className="mt-1 text-xs font-medium text-slate-600">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top sellers — last 30 days. Drives restock decisions. */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-950">Top sellers</h2>
            <p className="text-xs text-muted-foreground">By units · 30d</p>
          </div>
          <AdminTopSellersChart data={topSellers} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Recent Orders</h2>
            <Link
              href="/admin/orders"
              className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No orders yet. New checkouts will appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-950">{order.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.customer} · {order.city}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      order.status === "Delivered"
                        ? "bg-emerald-100 text-emerald-700"
                        : order.status === "Out for Delivery"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-brand-100 text-brand-700"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Low-stock alert — only renders when at least one tracked
              medicine is at or below the threshold. Suppressed entirely when
              inventory is healthy so the dashboard stays clean. */}
          {lowStockMedicines.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold text-amber-900">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  Low stock
                </h2>
                <Link
                  href="/admin/medicines"
                  className="text-sm font-semibold text-amber-800 hover:text-amber-900"
                >
                  Manage →
                </Link>
              </div>
              <p className="text-xs text-amber-800">
                {lowStockMedicines.length}{" "}
                {lowStockMedicines.length === 1 ? "item" : "items"} at or below{" "}
                {LOW_STOCK_THRESHOLD} units. Reorder soon.
              </p>
              <ul className="mt-3 divide-y divide-amber-200/70 text-sm">
                {lowStockMedicines.map((m) => {
                  const qty = m.stockOnHand ?? 0;
                  const critical = qty === 0;
                  return (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-amber-950">
                        <Package
                          className="mr-1.5 inline h-3.5 w-3.5 text-amber-700"
                          aria-hidden
                        />
                        {m.name}
                        <span className="ml-1.5 text-xs text-amber-700">
                          · {m.category}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                          critical
                            ? "bg-rose-200 text-rose-900"
                            : "bg-amber-200 text-amber-900"
                        }`}
                      >
                        {critical ? "0 — out" : `${qty} left`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-rose-900">
                <ClipboardList className="h-4 w-4" />
                Prescription Queue
              </h2>
              <Link
                href="/admin/prescriptions"
                className="text-sm font-semibold text-rose-700 hover:text-rose-800"
              >
                Review →
              </Link>
            </div>
            <p className="text-3xl font-bold text-rose-700">{prescriptionOrders}</p>
            <p className="mt-1 text-sm text-rose-600">orders flagged with prescriptions</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-bold text-slate-950">Today&apos;s Checklist</h2>
            <div className="space-y-2">
              {[
                "Review uploaded prescriptions before dispatch",
                "Confirm low-stock medicines for tomorrow",
                "Call COD customers for address verification",
                "Update order statuses for out-for-delivery items",
              ].map((task, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-[10px] font-bold text-slate-400">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-700">{task}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-bold text-slate-950">Quick contact</h2>
            <div className="rounded-xl bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">Customer helpline</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Share this number on invoices and tracking pages.
              </p>
              <a
                href="tel:+919354360049"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
              >
                <Phone className="h-4 w-4" /> +91 9354360049
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
