import { formatCurrency } from "@/lib/utils";

/** Single source of truth for COD checkout coupons (cart UI + POST /api/orders). */
export const CHECKOUT_COUPONS = {
  DAVA50: { discount: 50, minOrder: 500 },
} as const;

export function resolveCheckoutCoupon(
  code: unknown,
  subtotalBeforeCoupon: number,
): { discount: number; normalizedCode: string | null } {
  if (code === null || code === undefined || String(code).trim() === "") {
    return { discount: 0, normalizedCode: null };
  }

  const upper = String(code).trim().toUpperCase();
  const rule =
    CHECKOUT_COUPONS[upper as keyof typeof CHECKOUT_COUPONS];

  if (!rule) {
    throw new Error("Invalid coupon code.");
  }

  if (subtotalBeforeCoupon < rule.minOrder) {
    throw new Error(
      `Minimum order of ${formatCurrency(rule.minOrder)} required for this coupon.`,
    );
  }

  return { discount: rule.discount, normalizedCode: upper };
}
