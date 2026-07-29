import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import {
  escapeTelegramHtml,
  isTelegramConfigured,
  sendAdminTelegramMessage,
} from "@/lib/telegram";

/**
 * Vercel-cron-driven daily admin summary.
 *
 * Fires at 21:00 IST (15:30 UTC) every day via the schedule in
 * `vercel.json`. Auth uses Vercel's built-in `CRON_SECRET` mechanism —
 * Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to every cron
 * invocation, and we reject any caller that doesn't present it.
 *
 * The handler is intentionally idempotent and stateless. Running it a
 * second time on the same day is harmless — it just re-sends the same
 * summary (which is occasionally useful for testing).
 */

export const dynamic = "force-dynamic";

type StatusRow = { status: string; n: string };
type RevenueRow = { revenue: string | number };
type TopSellerRow = { name: string; qty: string | number };
type LowStockRow = { name: string; stockOnHand: number };
type CodRow = { revenue: string | number; orderCount: string | number };

function fmtINR(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export async function GET(request: Request) {
  // Auth: Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`.
  const expected = process.env.CRON_SECRET?.trim();
  const provided = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTelegramConfigured()) {
    // The cron ran but there's no chat to send to yet (admin chat id
    // hasn't been added). 200 so Vercel doesn't retry; the body explains.
    return NextResponse.json({
      ok: false,
      reason: "telegram_not_configured",
      hint:
        "Set TELEGRAM_ADMIN_CHAT_ID in Vercel env to enable daily summaries.",
    });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { ok: false, reason: "db_unavailable" },
      { status: 503 },
    );
  }

  // All four aggregations run in parallel. Window = since IST midnight
  // today (so "Today's summary" at 9 PM IST is exactly that day).
  const since = sql`DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`;

  try {
    const [statusRows, revenueRows, topRows, lowStockRows, codRows] =
      await Promise.all([
        sql<StatusRow[]>`
          SELECT status, COUNT(*)::text AS n
          FROM orders
          WHERE created_at >= ${since}
          GROUP BY status
        `,
        sql<RevenueRow[]>`
          SELECT
            COALESCE(SUM(
              NULLIF(REGEXP_REPLACE(total, '[^0-9.]', '', 'g'), '')::NUMERIC
            ), 0) AS revenue
          FROM orders
          WHERE status != 'Cancelled'
            AND created_at >= ${since}
        `,
        sql<TopSellerRow[]>`
          SELECT oi.name, SUM(oi.quantity)::text AS qty
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.status != 'Cancelled'
            AND o.created_at >= ${since}
          GROUP BY oi.name
          ORDER BY SUM(oi.quantity) DESC
          LIMIT 5
        `,
        sql<LowStockRow[]>`
          SELECT name, stock_on_hand AS "stockOnHand"
          FROM medicines
          WHERE stock_on_hand IS NOT NULL AND stock_on_hand <= 10
          ORDER BY stock_on_hand ASC
          LIMIT 6
        `,
        sql<CodRow[]>`
          SELECT
            COALESCE(SUM(
              NULLIF(REGEXP_REPLACE(total, '[^0-9.]', '', 'g'), '')::NUMERIC
            ), 0) AS revenue,
            COUNT(*)::text AS order_count
          FROM orders
          WHERE status = 'Delivered'
            AND payment_method = 'Cash on Delivery'
            AND created_at >= ${since}
        `,
      ]);

    const byStatus = new Map<string, number>();
    let totalOrders = 0;
    for (const r of statusRows) {
      const n = Number(r.n) || 0;
      byStatus.set(r.status, n);
      totalOrders += n;
    }
    const revenue = Number(revenueRows[0]?.revenue ?? 0);
    const codCash = Number(codRows[0]?.revenue ?? 0);
    const codCount = Number(codRows[0]?.orderCount ?? 0);

    const dateLabel = new Date().toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Build the message — HTML parse mode, see lib/telegram.ts.
    const lines: string[] = [];
    lines.push(`📊 <b>Dawasarthi · Daily Summary</b>`);
    lines.push(`<i>${escapeTelegramHtml(dateLabel)}</i>`);
    lines.push("");
    lines.push(`🛍 <b>Orders today:</b> ${totalOrders}`);
    lines.push(`💰 <b>Revenue:</b> ${fmtINR(revenue)}`);

    if (totalOrders > 0) {
      lines.push("");
      lines.push(`<b>Pipeline</b>`);
      const pipeline = [
        ["Ordered", "📥"],
        ["Packed", "📦"],
        ["Out for Delivery", "🚚"],
        ["Delivered", "✅"],
        ["Cancelled", "❌"],
      ] as const;
      for (const [status, emoji] of pipeline) {
        const n = byStatus.get(status) ?? 0;
        if (n > 0) lines.push(`  ${emoji} ${status}: ${n}`);
      }
    }

    if (topRows.length > 0) {
      lines.push("");
      lines.push(`🏆 <b>Top sellers</b>`);
      for (const r of topRows) {
        lines.push(
          `  • ${escapeTelegramHtml(r.name)} — ${Number(r.qty) || 0}`,
        );
      }
    }

    if (lowStockRows.length > 0) {
      lines.push("");
      lines.push(`⚠ <b>Low stock</b> (≤ 10 units)`);
      for (const r of lowStockRows) {
        const tag = r.stockOnHand === 0 ? "<b>OUT</b>" : `${r.stockOnHand} left`;
        lines.push(`  • ${escapeTelegramHtml(r.name)} — ${tag}`);
      }
    }

    if (codCount > 0) {
      lines.push("");
      lines.push(
        `💵 <b>COD collected today:</b> ${fmtINR(codCash)} (${codCount} ${codCount === 1 ? "delivery" : "deliveries"})`,
      );
    }

    if (totalOrders === 0) {
      lines.push("");
      lines.push(`<i>No orders today.</i>`);
    }

    const sent = await sendAdminTelegramMessage(lines.join("\n"));
    return NextResponse.json({ ok: sent, totalOrders });
  } catch (err) {
    console.error(
      "[dawasarthi] daily-summary cron failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { ok: false, error: "Summary generation failed." },
      { status: 500 },
    );
  }
}
