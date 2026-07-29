"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TopSellerRow } from "@/lib/admin-analytics";

/**
 * Horizontal bar chart of top-selling medicines (last 30 days, by units).
 * Long names are truncated on the y-axis but the full name appears in the
 * tooltip.
 */

type Props = {
  data: TopSellerRow[];
};

/** Brand-teal scaled so the heaviest seller is darkest. */
function colourFor(index: number, total: number): string {
  // 0 → darkest (#0c2c39), last → lightest (#7baabc).
  const start = [12, 44, 57];
  const end = [123, 170, 188];
  const t = total <= 1 ? 0 : index / (total - 1);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(start[0], end[0])}, ${lerp(start[1], end[1])}, ${lerp(start[2], end[2])})`;
}

function truncate(s: string, max = 22): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function AdminTopSellersChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-muted-foreground">
        No sales yet — best-selling medicines will show up here.
      </div>
    );
  }

  // Reverse so the biggest seller sits at the TOP of the bar chart
  // (Recharts stacks the first array entry at the bottom).
  const rows = [...data].reverse();

  return (
    <div
      className="w-full"
      style={{ height: Math.max(220, rows.length * 32 + 32) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
          barCategoryGap={6}
        >
          <XAxis
            type="number"
            stroke="#94a3b8"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            dataKey="name"
            type="category"
            stroke="#94a3b8"
            tick={{ fontSize: 11 }}
            tickFormatter={truncate}
            width={140}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            contentStyle={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              fontSize: 12,
              padding: "8px 12px",
              boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
            }}
            formatter={(value, _name, ctx) => {
              const num = typeof value === "number" ? value : Number(value) || 0;
              const orderCount =
                (ctx?.payload as TopSellerRow | undefined)?.orderCount ?? 0;
              return [
                `${num} units · ${orderCount} order${orderCount === 1 ? "" : "s"}`,
                "Sold",
              ];
            }}
            labelFormatter={(label) => String(label ?? "")}
          />
          <Bar dataKey="totalQty" radius={[0, 6, 6, 0]} maxBarSize={22}>
            {rows.map((_, i) => (
              <Cell key={i} fill={colourFor(rows.length - 1 - i, rows.length)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
