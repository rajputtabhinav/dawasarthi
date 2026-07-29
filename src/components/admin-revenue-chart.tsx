"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyRevenuePoint } from "@/lib/admin-analytics";

/**
 * 30-day revenue area chart.
 *
 * Rendered as a client component because Recharts uses DOM measurement
 * APIs. The parent server component does the SQL aggregation and just
 * hands an array of pre-computed points down.
 */

type Props = {
  data: DailyRevenuePoint[];
};

function formatINR(value: number): string {
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}k`;
  return `₹${Math.round(value)}`;
}

function formatDayLabel(iso: string): string {
  // "2026-05-15" → "15 May"
  const [, m, d] = iso.split("-");
  const monthIdx = (Number(m) || 1) - 1;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${Number(d)} ${months[monthIdx] ?? ""}`.trim();
}

export function AdminRevenueChart({ data }: Props) {
  // Empty-state — show a friendly placeholder until at least one order lands.
  if (data.length === 0 || data.every((p) => p.revenue === 0)) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-muted-foreground">
        No revenue yet — orders from the last 30 days will populate this chart.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#184f63" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#184f63" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDayLabel}
            stroke="#94a3b8"
            tick={{ fontSize: 11 }}
            tickMargin={6}
            // Show roughly one label every 5 days so the axis doesn't crowd.
            interval={Math.max(1, Math.floor(data.length / 6))}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatINR(v)}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
            contentStyle={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              fontSize: 12,
              padding: "8px 12px",
              boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
            }}
            labelFormatter={(label) =>
              typeof label === "string" ? formatDayLabel(label) : String(label ?? "")
            }
            formatter={(value, _name, ctx) => {
              const num = typeof value === "number" ? value : Number(value) || 0;
              if (ctx?.dataKey === "orderCount") {
                return [`${num} order${num === 1 ? "" : "s"}`, "Orders"];
              }
              return [`₹${num.toLocaleString("en-IN")}`, "Revenue"];
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#184f63"
            strokeWidth={2}
            fill="url(#revenueFill)"
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          {/* Hidden series so the tooltip can show orderCount alongside */}
          <Area
            type="monotone"
            dataKey="orderCount"
            stroke="transparent"
            fill="transparent"
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
