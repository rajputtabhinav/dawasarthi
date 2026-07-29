"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { CircleCheckBig, Loader2, Tag } from "lucide-react";
import {
  AnimatePresence,
  MotionFadeSwap,
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

function saveOrderToHistory(order: object, userId: string | null | undefined) {
  if (typeof window === "undefined" || !userId) return;
  const key = `dawasarthi-orders:${userId}`;
  try {
    const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]") as object[];
    existing.unshift(order);
    window.localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
  } catch {
    /* ignore quota / parse errors — server is the source of truth */
  }
}

function readCoupon(): { code: string; discount: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("dawasarthi-coupon");
    return raw ? (JSON.parse(raw) as { code: string; discount: number }) : null;
  } catch {
    return null;
  }
}

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const { isLoaded, isSignedIn, user } = useUser();
  const [isPlaced, setIsPlaced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);

  /** Controlled phone input — kept controlled so the past-order pre-fill can populate it. */
  const [phone, setPhone] = useState("");

  /**
   * Form pre-fill — populated from the user's most recent order so repeat
   * customers don't retype their delivery details. We only set the values
   * once on mount; the user can still edit anything.
   */
  const [customerName, setCustomerName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [cityValue, setCityValue] = useState("Dibiyapur");
  const [stateValue, setStateValue] = useState("Uttar Pradesh");
  const [pincodeValue, setPincodeValue] = useState("209302");
  const prefillledRef = useRef(false);

  /**
   * Delivery-zone preview — we ping /api/checkout/check-zone with the
   * current address while the user types so they see "in zone" vs.
   * "out of zone" before clicking Place Order. The server's order POST
   * also does its own check, so this is purely a UX aid.
   */
  type ZoneStatus =
    | { state: "idle" }
    | { state: "checking" }
    | { state: "ready"; inZone: boolean; distanceKm: number; maxKm: number }
    | { state: "skipped" };
  const [zoneStatus, setZoneStatus] = useState<ZoneStatus>({ state: "idle" });

  useEffect(() => {
    setCoupon(readCoupon());
  }, []);

  /**
   * Pull the most recent order and use its address fields as defaults.
   * Runs once after sign-in is confirmed; later edits to fields are kept.
   */
  useEffect(() => {
    if (!isSignedIn || prefillledRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/orders?limit=1", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          orders?: Array<{
            customer?: string;
            phone?: string;
            address?: string;
            city?: string;
          }>;
        };
        const latest = data.orders?.[0];
        if (cancelled || !latest) return;
        prefillledRef.current = true;
        // Address comes back as a single comma-joined string. Best-effort
        // split: last 6-digit chunk = pincode, "Uttar Pradesh" if present =
        // state, "Dibiyapur" (or whatever the user typed) = city, rest = line.
        if (latest.customer && !customerName) setCustomerName(latest.customer);
        if (latest.phone && !phone) setPhone(latest.phone);
        if (latest.address && !addressLine) {
          const parts = latest.address.split(",").map((s) => s.trim()).filter(Boolean);
          const pinIdx = parts.findIndex((p) => /^\d{6}$/.test(p));
          if (pinIdx >= 0) setPincodeValue(parts[pinIdx]);
          const stateIdx = parts.findIndex((p) => /uttar\s*pradesh|up$/i.test(p));
          if (stateIdx >= 0) setStateValue(parts[stateIdx]);
          // City: prefer the explicit field if present.
          if (latest.city && latest.city !== "—") {
            setCityValue(latest.city);
          }
          // Line: everything before the city, or fall back to the first
          // chunk if heuristics didn't match.
          const cityIdx = parts.findIndex(
            (p) => p.toLowerCase() === (latest.city ?? "").toLowerCase(),
          );
          const lineParts =
            cityIdx > 0 ? parts.slice(0, cityIdx) : parts.slice(0, 1);
          setAddressLine(lineParts.join(", "));
        }
      } catch {
        /* network blip — leave defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when sign-in resolves
  }, [isSignedIn]);

  /**
   * Debounced delivery-zone preview. Fires whenever the address line + city
   * are populated long enough to geocode meaningfully (~8 chars). Auth-gated
   * upstream so we only do it for signed-in users.
   */
  useEffect(() => {
    if (!isSignedIn) {
      setZoneStatus({ state: "idle" });
      return;
    }
    const line = addressLine.trim();
    const city = cityValue.trim();
    if (line.length < 8) {
      setZoneStatus({ state: "idle" });
      return;
    }
    let cancelled = false;
    setZoneStatus({ state: "checking" });
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/checkout/check-zone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: line, city }),
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) {
          setZoneStatus({ state: "skipped" });
          return;
        }
        const data = (await res.json()) as
          | { ready: false; reason?: string }
          | {
              ready: true;
              inZone: boolean;
              distanceKm: number;
              maxDeliveryKm: number;
            };
        if (cancelled) return;
        if (!data.ready) {
          setZoneStatus({ state: "skipped" });
          return;
        }
        setZoneStatus({
          state: "ready",
          inZone: data.inZone,
          distanceKm: data.distanceKm,
          maxKm: data.maxDeliveryKm,
        });
      } catch {
        if (!cancelled) setZoneStatus({ state: "skipped" });
      }
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [addressLine, cityValue, isSignedIn]);

  /**
   * Drop the saved coupon if the cart subtotal no longer meets the minimum.
   * Without this, a user who applied a coupon on the cart page and then
   * removed items would see (and be charged) a discount the server will
   * reject. We mirror the server's validation logic here for UX parity.
   */
  useEffect(() => {
    if (!coupon) return;
    const rule =
      CHECKOUT_COUPONS[coupon.code.toUpperCase() as keyof typeof CHECKOUT_COUPONS];
    if (!rule || subtotal < rule.minOrder) {
      setCoupon(null);
      try {
        window.localStorage.removeItem("dawasarthi-coupon");
      } catch {
        /* ignore */
      }
    }
  }, [coupon, subtotal]);

  const couponDiscount = coupon?.discount ?? 0;
  const finalTotal = Math.max(0, subtotal - couponDiscount);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0) return;

    if (!isSignedIn) {
      setError("Please sign in before placing an order.");
      return;
    }

    setIsLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);

    const street = (formData.get("address") as string) ?? "";
    const city = (formData.get("city") as string) ?? "";
    const stateField = (formData.get("state") as string) ?? "";
    const pincode = (formData.get("pincode") as string) ?? "";
    const fullAddress = [street, city, stateField, pincode]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");

    const orderPayload = {
      customer: formData.get("name") as string,
      phone: formData.get("phone") as string,
      address: fullAddress,
      city,
      items: items.map((item) => ({
        medicineId: item.id,
        quantity: item.quantity,
      })),
      coupon: coupon?.code ?? null,
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const data = (await res.json()) as {
        error?: string;
        order?: { id: string } & Record<string, unknown>;
      };

      if (!res.ok || !data.order?.id) {
        throw new Error(data.error ?? "We could not place your order. Please try again.");
      }

      saveOrderToHistory(data.order, user?.id ?? null);
      window.localStorage.removeItem("dawasarthi-coupon");
      setOrderId(data.order.id);
      clearCart();
      setIsPlaced(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again or call us.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        <MotionStagger className="mb-4 flex flex-wrap gap-2">
          {["Cart", "Address", "Place Order"].map((step, index) => (
            <MotionItem key={step}>
              <div
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  index < 2
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {step}
              </div>
            </MotionItem>
          ))}
        </MotionStagger>

        <MotionSection className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            Checkout
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            One-page checkout built for speed and clarity
          </h1>
        </MotionSection>

        <AnimatePresence mode="wait">
          {isPlaced ? (
            <MotionFadeSwap
              motionKey="success"
              className="mx-auto max-w-3xl rounded-3xl border border-border bg-white p-8 text-center shadow-card"
            >
              <div className="mx-auto inline-flex rounded-full bg-emerald-50 p-4 text-emerald-700">
                <CircleCheckBig className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                Order placed successfully
              </h2>
              <p className="mt-3 text-muted-foreground">
                Your order ID is{" "}
                <span className="font-bold text-slate-950">{orderId}</span>. Our
                team will confirm and call you before dispatch.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href={`/track-order/${orderId}`}
                  className="rounded-2xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white"
                >
                  Track order
                </Link>
                <Link
                  href="/medicines"
                  className="rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-slate-800"
                >
                  Continue shopping
                </Link>
              </div>
            </MotionFadeSwap>
          ) : (
            <MotionFadeSwap
              motionKey="checkout"
              className="grid gap-6 lg:grid-cols-[1fr_360px]"
            >
              <motion.form
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border bg-white p-4 shadow-card sm:rounded-3xl sm:p-8"
              >
                <div className="grid gap-5">
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block text-sm font-semibold text-slate-950"
                    >
                      Full Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-4 text-base outline-none transition focus:border-brand-300 focus:bg-white"
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-2 block text-sm font-semibold text-slate-950"
                    >
                      Phone Number
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      required
                      inputMode="tel"
                      pattern="[0-9 +\-]{10,15}"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-4 text-base outline-none transition focus:border-brand-300 focus:bg-white"
                      placeholder="10-digit mobile number"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="address"
                      className="mb-1 block text-sm font-semibold text-slate-950"
                    >
                      House / Flat / Street
                    </label>
                    {/* Always-visible delivery policy — set expectation
                        before the user types anything. */}
                    <p className="mb-2 text-xs text-muted-foreground">
                      We deliver up to 6 km from our store in Dibiyapur.
                    </p>
                    <textarea
                      id="address"
                      name="address"
                      required
                      rows={3}
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-4 text-base outline-none transition focus:border-brand-300 focus:bg-white"
                      placeholder="Flat / house number, street, landmark"
                    />
                    {/*
                      Delivery-zone preview chip. Refreshes ~600ms after
                      the user stops typing. The order POST does its own
                      authoritative check — this is just early UX feedback.
                    */}
                    {zoneStatus.state === "checking" && (
                      <p className="mt-2 text-xs text-slate-500">
                        Checking delivery area…
                      </p>
                    )}
                    {zoneStatus.state === "ready" && zoneStatus.inZone && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        ✓ Delivers here · {zoneStatus.distanceKm} km from store
                      </p>
                    )}
                    {zoneStatus.state === "ready" && !zoneStatus.inZone && (
                      <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                        <p className="font-semibold">
                          ⚠ Outside our delivery zone
                        </p>
                        <p className="mt-1 leading-5">
                          This address is about{" "}
                          <span className="font-semibold">
                            {zoneStatus.distanceKm} km
                          </span>{" "}
                          from our store. We currently deliver only within{" "}
                          {zoneStatus.maxKm} km of Dibiyapur. Call{" "}
                          <a
                            href="tel:+919354360049"
                            className="font-semibold underline"
                          >
                            +91 93543 60049
                          </a>{" "}
                          if you&apos;d like us to consider your area.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label
                        htmlFor="city"
                        className="mb-2 block text-sm font-semibold text-slate-950"
                      >
                        City
                      </label>
                      <input
                        id="city"
                        name="city"
                        required
                        value={cityValue}
                        onChange={(e) => setCityValue(e.target.value)}
                        className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-4 text-base outline-none transition focus:border-brand-300 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="state"
                        className="mb-2 block text-sm font-semibold text-slate-950"
                      >
                        State
                      </label>
                      <input
                        id="state"
                        name="state"
                        required
                        value={stateValue}
                        onChange={(e) => setStateValue(e.target.value)}
                        className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-4 text-base outline-none transition focus:border-brand-300 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pincode"
                        className="mb-2 block text-sm font-semibold text-slate-950"
                      >
                        Pincode
                      </label>
                      <input
                        id="pincode"
                        name="pincode"
                        required
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        value={pincodeValue}
                        onChange={(e) =>
                          setPincodeValue(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-4 text-base outline-none transition focus:border-brand-300 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-5">
                    <p className="text-sm font-semibold text-slate-950">
                      Payment method
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Cash on Delivery. Pay when your order arrives.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-brand-50 p-5 text-sm text-brand-900">
                    Delivery partner will call before arrival. Need help? Call{" "}
                    <a
                      href="tel:+919354360049"
                      className="font-semibold underline"
                    >
                      +91 9354360049
                    </a>
                    .
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
                    >
                      {error}
                    </p>
                  )}

                  {!isLoaded && (
                    <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                      Loading your account…
                    </p>
                  )}

                  {isLoaded && !isSignedIn && (
                    <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Please{" "}
                      <Link href="/sign-in?redirect_url=/checkout" className="font-semibold underline">
                        sign in
                      </Link>{" "}
                      to place your order. Your cart will be kept.
                    </p>
                  )}

                  {(() => {
                    const zoneBlocked =
                      zoneStatus.state === "ready" && !zoneStatus.inZone;
                    return (
                      <button
                        type="submit"
                        disabled={
                          !isLoaded ||
                          isLoading ||
                          items.length === 0 ||
                          !isSignedIn ||
                          zoneBlocked
                        }
                        className="flex items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                        aria-busy={isLoading || !isLoaded}
                      >
                        {(isLoading || !isLoaded) && (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        )}
                        {!isLoaded
                          ? "Loading…"
                          : isLoading
                            ? "Placing order…"
                            : zoneBlocked
                              ? "Outside delivery zone"
                              : "Place Order"}
                      </button>
                    );
                  })()}
                </div>
              </motion.form>

              <motion.aside
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                className="h-fit rounded-3xl border border-border bg-white p-6 shadow-card"
              >
                <h2 className="text-xl font-semibold text-slate-950">
                  Order summary
                </h2>
                <div className="mt-5 space-y-4">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Your cart is empty. Add medicines before placing an order.
                    </p>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-4 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-950">
                            {item.name}
                          </p>
                          <p className="text-muted-foreground">
                            Qty {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold text-slate-950">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {coupon && (
                    <div className="flex items-center justify-between text-emerald-700">
                      <span className="flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        Coupon ({coupon.code})
                      </span>
                      <span>-{formatCurrency(coupon.discount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Delivery</span>
                    <span>Free</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-slate-950">
                    <span>Total payable</span>
                    <span>{formatCurrency(finalTotal)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cash on Delivery
                  </p>
                </div>
              </motion.aside>
            </MotionFadeSwap>
          )}
        </AnimatePresence>
      </main>
      <SiteFooter />
    </div>
  );
}
