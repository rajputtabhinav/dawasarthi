"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Tag, Trash2 } from "lucide-react";
import {
  AnimatePresence,
  MotionFadeSwap,
  MotionHover,
  MotionItem,
  MotionSection,
  MotionStagger,
  motion,
} from "@/components/motion-primitives";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useCart } from "@/components/providers/cart-provider";
import { CHECKOUT_COUPONS } from "@/lib/coupons";
import { formatCurrency } from "@/lib/utils";

export default function CartPage() {
  const { items, subtotal, totalSavings, updateQuantity, removeItem } = useCart();
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState("");

  // Hydrate previously-applied coupon from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("dawasarthi-coupon");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { code?: string };
      const code =
        typeof parsed?.code === "string" ? parsed.code.toUpperCase() : null;
      if (code && CHECKOUT_COUPONS[code as keyof typeof CHECKOUT_COUPONS]) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from localStorage
        setAppliedCoupon(code);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const couponDef =
    appliedCoupon && CHECKOUT_COUPONS[appliedCoupon as keyof typeof CHECKOUT_COUPONS]
      ? CHECKOUT_COUPONS[appliedCoupon as keyof typeof CHECKOUT_COUPONS]
      : null;
  const couponDiscount = couponDef?.discount ?? 0;
  const finalTotal = Math.max(0, subtotal - couponDiscount);

  function removeCoupon(options: { keepError?: boolean } = {}) {
    setAppliedCoupon(null);
    if (!options.keepError) setCouponError("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("dawasarthi-coupon");
    }
  }

  // Drop the coupon if subtotal no longer meets its minimum (item removal etc.).
  useEffect(() => {
    if (couponDef && subtotal > 0 && subtotal < couponDef.minOrder) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reactive invariant: coupon validity must follow subtotal
      setCouponError(
        `Coupon removed — minimum order of ${formatCurrency(couponDef.minOrder)} required.`,
      );
      removeCoupon({ keepError: true });
    }
    if (subtotal === 0 && appliedCoupon) {
      removeCoupon();
    }
  }, [subtotal, couponDef, appliedCoupon]);

  function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const coupon = CHECKOUT_COUPONS[code as keyof typeof CHECKOUT_COUPONS];
    if (!coupon) {
      setCouponError("Invalid coupon code.");
      return;
    }
    if (subtotal < coupon.minOrder) {
      setCouponError(
        `Minimum order of ${formatCurrency(coupon.minOrder)} required for this coupon.`,
      );
      return;
    }
    setAppliedCoupon(code);
    setCouponError("");
    setCouponInput("");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "dawasarthi-coupon",
        JSON.stringify({ code, discount: coupon.discount }),
      );
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        <MotionStagger className="mb-4 flex flex-wrap gap-2">
          {["Cart", "Address", "Place Order"].map((step, index) => (
            <MotionItem key={step}>
              <div
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  index === 0 ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {step}
              </div>
            </MotionItem>
          ))}
        </MotionStagger>

        <MotionSection className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            Cart
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Review your medicines before checkout
          </h1>
        </MotionSection>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            {items.length === 0 ? (
              <MotionFadeSwap
                motionKey="empty-cart"
                className="rounded-3xl border border-border bg-white p-10 text-center shadow-card"
              >
                <div className="mx-auto inline-flex rounded-full bg-brand-50 p-4 text-brand-700">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                  Your cart is empty
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Add medicines to begin a simple one-page checkout.
                </p>
                <Link
                  href="/medicines"
                  className="mt-6 inline-flex rounded-2xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white"
                >
                  Browse medicines
                </Link>
              </MotionFadeSwap>
            ) : (
              <MotionStagger className="space-y-4">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <MotionItem key={item.id}>
                      <motion.article
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -14 }}
                        className="rounded-3xl border border-border bg-white p-5 shadow-card"
                      >
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                              {item.category}
                            </p>
                            <h2 className="mt-2 text-xl font-semibold text-slate-950">
                              {item.name}
                            </h2>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {item.stockStatus}
                              {item.requiresPrescription ? " • Prescription required" : " • OTC"}
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-2xl font-semibold text-slate-950">
                              {formatCurrency(item.price)}
                            </p>
                            <p className="text-sm text-muted-foreground line-through">
                              {formatCurrency(item.mrp)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="inline-flex w-fit items-center rounded-2xl border border-border bg-slate-50 p-1">
                            <MotionHover>
                              <button
                                aria-label={`Decrease quantity for ${item.name}`}
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-white active:scale-95"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                            </MotionHover>
                            <motion.span
                              key={`${item.id}-${item.quantity}`}
                              initial={{ scale: 0.92, opacity: 0.6 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="min-w-12 text-center text-sm font-semibold text-slate-950"
                            >
                              {item.quantity}
                            </motion.span>
                            <MotionHover>
                              <button
                                aria-label={`Increase quantity for ${item.name}`}
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-white active:scale-95"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </MotionHover>
                          </div>

                          <MotionHover>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="inline-flex min-h-[44px] items-center gap-2 px-2 text-sm font-semibold text-rose-700"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </button>
                          </MotionHover>
                        </div>
                      </motion.article>
                    </MotionItem>
                  ))}
                </AnimatePresence>
              </MotionStagger>
            )}
          </section>

          <MotionSection className="h-fit rounded-3xl border border-border bg-white p-6 shadow-card">
            <h2 className="text-xl font-semibold text-slate-950">Order summary</h2>
            <div className="mt-5 space-y-4 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Items total</span>
                <span>{formatCurrency(subtotal + totalSavings)}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-700">
                <span>Savings</span>
                <motion.span
                  key={`savings-${totalSavings}`}
                  initial={{ opacity: 0.5, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  -{formatCurrency(totalSavings)}
                </motion.span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" />
                    Coupon ({appliedCoupon})
                  </span>
                  <span>-{formatCurrency(couponDiscount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Delivery fee</span>
                <span>Free</span>
              </div>
              <div className="border-t border-border pt-4 text-base font-semibold text-slate-950">
                <div className="flex items-center justify-between">
                  <span>To pay</span>
                  <motion.span
                    key={`total-${finalTotal}`}
                    initial={{ opacity: 0.5, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {formatCurrency(finalTotal)}
                  </motion.span>
                </div>
              </div>
            </div>

            {/* Coupon input */}
            <div className="mt-5 border-t border-border pt-5">
              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 font-semibold text-emerald-700">
                    <Tag className="h-4 w-4" />
                    {appliedCoupon} applied
                  </span>
                  <button
                    onClick={() => removeCoupon()}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        setCouponError("");
                      }}
                      placeholder="Enter coupon code"
                      className="flex-1 rounded-xl border border-border bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-300 focus:bg-white"
                    />
                    <button
                      onClick={applyCoupon}
                      className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Apply
                    </button>
                  </div>
                  {couponError && (
                    <p role="alert" className="text-xs text-rose-600">
                      {couponError}
                    </p>
                  )}
                  {(() => {
                    // Surface the first defined coupon dynamically so the hint
                    // never goes stale when codes are added/removed in
                    // `src/lib/coupons.ts`.
                    const [hintCode, hintRule] =
                      Object.entries(CHECKOUT_COUPONS)[0] ?? [];
                    return hintCode && hintRule ? (
                      <p className="text-xs text-muted-foreground">
                        Try <strong>{hintCode}</strong> for ₹{hintRule.discount} off on orders above ₹{hintRule.minOrder}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}
            </div>

            <MotionHover className="mt-5">
              <Link
                href="/checkout"
                className={`inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 text-sm font-semibold ${
                  items.length === 0
                    ? "pointer-events-none bg-slate-200 text-slate-500"
                    : "bg-brand-700 text-white"
                }`}
              >
                Proceed to checkout
              </Link>
            </MotionHover>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Cash on Delivery. Pay when your order arrives.
            </p>

            <MotionHover className="mt-3">
              <Link
                href="/medicines"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-slate-800"
              >
                Continue browsing
              </Link>
            </MotionHover>
          </MotionSection>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
