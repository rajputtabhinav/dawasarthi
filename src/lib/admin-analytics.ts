import { getSql } from "@/lib/db";

/**
 * Admin dashboard analytics — SQL aggregations that the dashboard's
 * client-side charts render. Kept server-only so we don't ship the
 * underlying queries to the browser.
 *
 * Defaults:
 *  - 30-day rolling window
 *  - Cancelled orders excluded (they didn't generate real revenue)
 *  - `total` is parsed via REGEXP_REPLACE since it's stored as TEXT
 *    (legacy: Mongo had it as a formatted string like "₹1,234.00").
 */

export type DailyRevenuePoint = {
  /** ISO date `YYYY-MM-DD` */
  date: string;
  revenue: number;
  orderCount: number;
};

export type TopSellerRow = {
  name: string;
  totalQty: number;
  orderCount: number;
};

/**
 * Daily revenue + order count for the last N days (default 30).
 * Days with zero orders are filled in as zeros so the chart line is
 * continuous instead of skipping gaps.
 */
export async function loadDailyRevenue(
  days = 30,
): Promise<DailyRevenuePoint[]> {
  const sql = getSql();
  if (!sql) return [];
  const cap = Math.min(Math.max(7, days), 180);

  try {
    const rows = await sql<
      Array<{ date: string; revenue: string | number; orderCount: string | number }>
    >`
      SELECT
        TO_CHAR(DATE(created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS date,
        COALESCE(SUM(
          NULLIF(REGEXP_REPLACE(total, '[^0-9.]', '', 'g'), '')::NUMERIC
        ), 0) AS revenue,
        COUNT(*) AS order_count
      FROM orders
      WHERE status != 'Cancelled'
        AND created_at >= NOW() - (${cap}::text || ' days')::INTERVAL
      GROUP BY DATE(created_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY DATE(created_at AT TIME ZONE 'Asia/Kolkata') ASC
    `;

    // Fill in missing days with zeros so the chart spans the full window.
    const byDate = new Map<string, { revenue: number; orderCount: number }>();
    for (const r of rows) {
      byDate.set(r.date, {
        revenue: Number(r.revenue) || 0,
        orderCount: Number(r.orderCount) || 0,
      });
    }

    const out: DailyRevenuePoint[] = [];
    const now = new Date();
    for (let i = cap - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      // Use IST for consistency with the SQL aggregation above.
      const yyyy = d.toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });
      const hit = byDate.get(yyyy);
      out.push({
        date: yyyy,
        revenue: hit?.revenue ?? 0,
        orderCount: hit?.orderCount ?? 0,
      });
    }
    return out;
  } catch (err) {
    console.error(
      "[dawasarthi] loadDailyRevenue failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Top-selling medicines by units sold in the last N days. Used for the
 * "Top sellers" bar chart on the admin dashboard and as a hint for restock
 * decisions.
 */
export async function loadTopSellers(
  days = 30,
  limit = 8,
): Promise<TopSellerRow[]> {
  const sql = getSql();
  if (!sql) return [];
  const dayCap = Math.min(Math.max(7, days), 180);
  const rowCap = Math.min(Math.max(3, limit), 20);

  try {
    const rows = await sql<
      Array<{ name: string; totalQty: string | number; orderCount: string | number }>
    >`
      SELECT
        oi.name,
        SUM(oi.quantity) AS total_qty,
        COUNT(DISTINCT oi.order_id) AS order_count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status != 'Cancelled'
        AND o.created_at >= NOW() - (${dayCap}::text || ' days')::INTERVAL
      GROUP BY oi.name
      ORDER BY total_qty DESC
      LIMIT ${rowCap}
    `;
    return rows.map((r) => ({
      name: r.name,
      totalQty: Number(r.totalQty) || 0,
      orderCount: Number(r.orderCount) || 0,
    }));
  } catch (err) {
    console.error(
      "[dawasarthi] loadTopSellers failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Sum of revenue + order count for a window. Reused for the top-of-page
 * "Revenue" stat card so the number on the card and the chart agree.
 */
export function summariseRevenue(points: DailyRevenuePoint[]): {
  totalRevenue: number;
  totalOrders: number;
  /** Comparison vs the immediately-preceding window of the same length. */
  pctChangeVsPrev: number | null;
} {
  const mid = Math.floor(points.length / 2);
  const recent = points.slice(mid);
  const prev = points.slice(0, mid);
  const totalRevenue = recent.reduce((s, p) => s + p.revenue, 0);
  const totalOrders = recent.reduce((s, p) => s + p.orderCount, 0);
  const prevRevenue = prev.reduce((s, p) => s + p.revenue, 0);
  const pctChangeVsPrev =
    prevRevenue > 0
      ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
      : null;
  return { totalRevenue, totalOrders, pctChangeVsPrev };
}
