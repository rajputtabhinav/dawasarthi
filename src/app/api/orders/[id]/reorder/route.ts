import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { assertRateLimitJson } from "@/lib/server-rate-limit";
import { findUserOrderById } from "@/lib/server-orders";
import { findMedicineById } from "@/lib/server-medicines";
import type { Medicine } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

const ORDER_ID_RE = /^ORD[A-Z0-9]{4,32}$/;

/**
 * Reorder lookup — resolves a past order's items against the live catalogue.
 *
 * Returns the full `Medicine` rows for each line that's still available, plus
 * the quantity the user originally ordered. The client adds these to the cart
 * via the existing cart provider — we don't mutate the cart server-side.
 *
 * Items that no longer exist or are out of stock come back in
 * `unavailable[]` with a reason so the UI can tell the customer.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await assertRateLimitJson(
    _request,
    "get_order_reorder",
    30,
    { userId },
  );
  if (limited) return limited;

  const { id: rawId } = await context.params;
  const orderId = decodeURIComponent(rawId).trim();
  if (!ORDER_ID_RE.test(orderId)) {
    return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
  }

  const order = await findUserOrderById(userId, orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const available: Array<{ medicine: Medicine; quantity: number }> = [];
  const unavailable: Array<{ name: string; reason: string }> = [];

  for (const item of order.items) {
    if (!item.medicineId) {
      unavailable.push({
        name: item.name,
        reason: "Medicine no longer on catalogue",
      });
      continue;
    }
    const medicine = await findMedicineById(item.medicineId);
    if (!medicine) {
      unavailable.push({
        name: item.name,
        reason: "No longer available",
      });
      continue;
    }
    // Respect tracked stock — out-of-stock items go to unavailable so the
    // customer doesn't get a "your cart can't be ordered" surprise later.
    if (
      typeof medicine.stockOnHand === "number" &&
      medicine.stockOnHand <= 0
    ) {
      unavailable.push({
        name: medicine.name,
        reason: "Out of stock",
      });
      continue;
    }
    // Cap requested quantity at the tracked stock if we know it.
    const requested = Math.max(1, Math.floor(item.quantity));
    const capped =
      typeof medicine.stockOnHand === "number"
        ? Math.min(requested, medicine.stockOnHand)
        : requested;
    available.push({ medicine, quantity: capped });
  }

  return NextResponse.json(
    { orderId, available, unavailable },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
