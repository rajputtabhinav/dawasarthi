import { NextResponse } from "next/server";
import { requireAdminJson } from "@/lib/admin-auth";
import { getSql } from "@/lib/db";

/**
 * Admin command-bar search — one endpoint for the ⌘K palette.
 *
 * Searches orders (by id, customer, phone) and medicines (by name,
 * manufacturer, category) in parallel using ILIKE — small dataset, no need
 * for full-text indexes yet.
 *
 * Returns at most 5 hits per category so the dropdown stays scannable.
 */

const LIMIT_PER_GROUP = 5;

type OrderHit = {
  id: string;
  customer: string;
  status: string;
  phone: string | null;
  total: string | null;
  placedAt: string | null;
};

type MedicineHit = {
  id: string;
  slug: string;
  name: string;
  category: string;
  stockOnHand: number | null;
};

export async function GET(request: Request) {
  const forbidden = await requireAdminJson();
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const raw = url.searchParams.get("q")?.trim() ?? "";
  // Bail early on noise — the client also debounces but defence in depth.
  if (raw.length < 2) {
    return NextResponse.json(
      { orders: [], medicines: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  // Cap input length to keep the LIKE pattern bounded — long inputs make
  // Postgres scan slower without improving relevance.
  const q = raw.slice(0, 80);
  const like = `%${q}%`;

  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { orders: [], medicines: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    // Parallel queries — postgres-js queues them on the single connection
    // but they still pipeline well.
    const [orderRows, medicineRows] = await Promise.all([
      sql<OrderHit[]>`
        SELECT id, customer, status, phone, total, placed_at
        FROM orders
        WHERE id ILIKE ${like}
           OR customer ILIKE ${like}
           OR phone ILIKE ${like}
        ORDER BY created_at DESC
        LIMIT ${LIMIT_PER_GROUP}
      `,
      sql<MedicineHit[]>`
        SELECT id, slug, name, category, stock_on_hand
        FROM medicines
        WHERE name ILIKE ${like}
           OR manufacturer ILIKE ${like}
           OR category ILIKE ${like}
        ORDER BY name ASC
        LIMIT ${LIMIT_PER_GROUP}
      `,
    ]);

    return NextResponse.json(
      { orders: orderRows, medicines: medicineRows },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    console.error(
      "[dawasarthi] admin search failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { orders: [], medicines: [], error: "Search temporarily unavailable." },
      { status: 503 },
    );
  }
}
