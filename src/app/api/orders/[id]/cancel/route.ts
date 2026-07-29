import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  clerkUserMatchesAdminEmails,
  getServerAdminEmails,
} from "@/lib/admin-emails";
import {
  BODY_LIMIT_JSON_SMALL,
  enforceContentLength,
  enforceSameOrigin,
} from "@/lib/request-limits";
import { assertRateLimitJson } from "@/lib/server-rate-limit";
import { cancelOrder } from "@/lib/server-orders";

type RouteContext = { params: Promise<{ id: string }> };

const ORDER_ID_RE = /^ORD[A-Z0-9]{4,32}$/;

/**
 * Cancel an order.
 *
 * - Customer path: must be signed in AND own the order AND the order must be
 *   in `Ordered` or `Packed` status. Stock is released back to the catalogue.
 * - Admin path: same endpoint, but if the caller is on `ADMIN_EMAILS`, they
 *   can cancel any non-terminal order (including `Out for Delivery`).
 *
 * Body: { reason?: string }  (max 200 chars; falls back to a default)
 */
export async function POST(request: Request, context: RouteContext) {
  const csrfRejected = enforceSameOrigin(request);
  if (csrfRejected) return csrfRejected;

  const tooBig = enforceContentLength(request, BODY_LIMIT_JSON_SMALL);
  if (tooBig) return tooBig;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to cancel an order." },
      { status: 401 },
    );
  }

  // Cancellation is a low-volume but sensitive action — keep the cap tight so
  // a compromised cookie can't churn the order table.
  const limited = await assertRateLimitJson(request, "post_orders_cancel", 6, {
    userId,
  });
  if (limited) return limited;

  const { id: rawId } = await context.params;
  const orderId = decodeURIComponent(rawId).trim();
  if (!ORDER_ID_RE.test(orderId)) {
    return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";

  // Is the caller an admin? If yes, allow the broader cancellation window.
  const user = await currentUser();
  const isAdmin = clerkUserMatchesAdminEmails(user, getServerAdminEmails());

  const result = await cancelOrder({
    orderId,
    actor: isAdmin ? "admin" : "customer",
    userId,
    reason,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    order: {
      id: result.order.id,
      status: result.order.status,
      cancelledAt: result.order.cancelledAt,
      cancelReason: result.order.cancelReason,
      cancelledBy: result.order.cancelledBy,
      updatedAt: result.order.updatedAt,
    },
  });
}
