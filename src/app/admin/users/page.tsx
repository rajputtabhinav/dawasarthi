"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  Phone,
  Search,
  Star,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

type Customer = {
  name: string;
  phone: string;
  city: string;
  orders: number;
  joined: string;
  email?: string;
  lastOrder?: string;
  totalSpend?: string;
  segment?: "new" | "repeat" | "high-value";
};

type RemoteOrder = {
  id: string;
  customer?: string;
  phone?: string;
  city?: string;
  userEmail?: string;
  placedAt?: string;
  total?: string;
};

function parseTotal(total: string | undefined): number {
  if (!total) return 0;
  const n = Number(total.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function deriveCustomers(orders: RemoteOrder[]): Customer[] {
  const byPhone = new Map<string, Customer & { _total: number }>();
  for (const o of orders) {
    const phoneRaw = String(o.phone ?? "").replace(/\D/g, "");
    if (!phoneRaw) continue;
    const phone = phoneRaw;
    const existing = byPhone.get(phone);
    const spend = parseTotal(o.total);
    if (existing) {
      existing.orders += 1;
      existing._total += spend;
      existing.lastOrder = o.placedAt ?? existing.lastOrder;
    } else {
      byPhone.set(phone, {
        name: o.customer ?? "Customer",
        phone,
        city: o.city ?? "—",
        orders: 1,
        joined: o.placedAt ?? "—",
        email: o.userEmail,
        lastOrder: o.placedAt,
        _total: spend,
      });
    }
  }

  return Array.from(byPhone.values()).map((c) => {
    const segment: Customer["segment"] =
      c._total >= 5000
        ? "high-value"
        : c.orders >= 3
          ? "repeat"
          : "new";
    return {
      ...c,
      totalSpend: c._total > 0 ? `₹${c._total.toLocaleString("en-IN")}` : "—",
      segment,
    };
  });
}

const SEGMENT_META = {
  "high-value": {
    label: "High Value",
    color: "bg-amber-100 text-amber-800",
    icon: Star,
  },
  repeat: {
    label: "Repeat",
    color: "bg-brand-100 text-brand-800",
    icon: TrendingUp,
  },
  new: {
    label: "New",
    color: "bg-emerald-100 text-emerald-700",
    icon: UserPlus,
  },
};

type SegmentFilter = "All" | "high-value" | "repeat" | "new";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>("All");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let aborted = false;
    fetch("/api/orders?limit=500", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { orders?: RemoteOrder[]; error?: string }) => {
        if (aborted) return;
        if (data.error) {
          setLoadError(data.error);
          return;
        }
        setCustomers(deriveCustomers(data.orders ?? []));
      })
      .catch(() => {
        if (!aborted) setLoadError("Could not load customers.");
      });
    return () => {
      aborted = true;
    };
  }, []);

  const filtered = customers.filter((c) => {
    const segMatch = segmentFilter === "All" || c.segment === segmentFilter;
    const q = search.trim().toLowerCase();
    const searchMatch =
      q === "" ||
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.city.toLowerCase().includes(q);
    return segMatch && searchMatch;
  });

  const segmentCounts = {
    All: customers.length,
    "high-value": customers.filter((c) => c.segment === "high-value").length,
    repeat: customers.filter((c) => c.segment === "repeat").length,
    new: customers.filter((c) => c.segment === "new").length,
  };

  const totalOrders = customers.reduce((s, c) => s + c.orders, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
          CRM
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">
          Customer Management
        </h1>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Customers", value: String(customers.length), icon: Users, color: "bg-brand-50 text-brand-700" },
          { label: "High Value", value: String(segmentCounts["high-value"]), icon: Star, color: "bg-amber-50 text-amber-700" },
          { label: "Repeat Buyers", value: String(segmentCounts["repeat"]), icon: UserCheck, color: "bg-blue-50 text-blue-700" },
          { label: "Total Orders Placed", value: String(totalOrders), icon: TrendingUp, color: "bg-emerald-50 text-emerald-700" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`inline-flex rounded-xl p-2.5 ${color.split(" ")[0]}`}>
              <Icon className={`h-4 w-4 ${color.split(" ")[1]}`} />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Segment tabs */}
        <div className="flex gap-2">
          {(["All", "high-value", "repeat", "new"] as SegmentFilter[]).map((seg) => {
            const meta = seg === "All" ? null : SEGMENT_META[seg];
            return (
              <button
                key={seg}
                onClick={() => setSegmentFilter(seg)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  segmentFilter === seg
                    ? "bg-brand-700 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {meta && <meta.icon className="h-3.5 w-3.5" />}
                {seg === "All" ? "All" : meta?.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    segmentFilter === seg ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {segmentCounts[seg]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, phone, city…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 sm:w-56"
          />
        </div>
      </div>

      {/* Customer cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((customer) => {
          const seg = customer.segment ?? "new";
          const segMeta = SEGMENT_META[seg];
          const SegIcon = segMeta.icon;

          return (
            <div
              key={customer.phone}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              {/* Customer header */}
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-bold">
                    {customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-950">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.city} · Joined {customer.joined}</p>
                  </div>
                </div>
                <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${segMeta.color}`}>
                  <SegIcon className="h-3 w-3" />
                  {segMeta.label}
                </span>
              </div>

              {/* Stats */}
              <div className="mb-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Orders", value: String(customer.orders) },
                  { label: "Spend", value: customer.totalSpend ?? "—" },
                  { label: "Last Order", value: customer.lastOrder ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-2.5 text-center">
                    <p className="text-sm font-bold text-slate-950">{value}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Contact row */}
              <div className="flex gap-2">
                <a
                  href={`tel:${customer.phone.replace(/\s/g, "")}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Phone className="h-4 w-4" /> Call
                </a>
                <a
                  href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-border bg-white py-16 text-center">
          <p className="font-semibold text-slate-900">
            {loadError ? "Could not load customers" : "No customer records yet"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {loadError ||
              "Customers will appear here automatically as soon as the first order is placed."}
          </p>
        </div>
      )}
    </div>
  );
}
