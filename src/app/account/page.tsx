"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { Loader2, Package, RotateCcw, ShoppingBag, User } from "lucide-react";
import { CancelOrderButton } from "@/components/cancel-order-button";
import { useCart } from "@/components/providers/cart-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { Medicine, OrderStatus } from "@/lib/types";

type PlacedOrder = {
  id: string;
  total?: string;
  status: OrderStatus;
  placedAt?: string;
  items: Array<{ name: string; quantity: number; price: string }>;
  address?: string;
  paymentMethod?: string;
  cancelReason?: string;
  cancelledAt?: string;
};

export default function AccountPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const { addItem, updateQuantity } = useCart();
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  /**
   * Reorder state — the id of the order that's currently being processed,
   * plus a transient notice with the result. The notice is shown right
   * below the order card so the customer sees which items couldn't be added.
   */
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reorderNotice, setReorderNotice] = useState<{
    orderId: string;
    addedCount: number;
    unavailable: Array<{ name: string; reason: string }>;
  } | null>(null);

  async function handleReorder(orderId: string) {
    setReorderingId(orderId);
    setReorderNotice(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/reorder`,
        { cache: "no-store" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        available?: Array<{ medicine: Medicine; quantity: number }>;
        unavailable?: Array<{ name: string; reason: string }>;
        error?: string;
      };
      if (!res.ok) {
        setReorderNotice({
          orderId,
          addedCount: 0,
          unavailable: [
            {
              name: "Reorder",
              reason: data.error ?? "Could not load order items.",
            },
          ],
        });
        return;
      }
      const available = data.available ?? [];
      for (const { medicine, quantity } of available) {
        addItem(medicine);
        // addItem starts at qty 1; bump to the captured quantity if needed.
        if (quantity > 1) updateQuantity(medicine.id, quantity);
      }
      setReorderNotice({
        orderId,
        addedCount: available.length,
        unavailable: data.unavailable ?? [],
      });
      // If at least one item went into the cart, send the user there.
      if (available.length > 0) {
        // Small delay so the notice flashes before navigation — most users
        // will see "Added N items" pulse briefly.
        window.setTimeout(() => router.push("/cart"), 600);
      }
    } catch {
      setReorderNotice({
        orderId,
        addedCount: 0,
        unavailable: [
          { name: "Reorder", reason: "Network error. Please try again." },
        ],
      });
    } finally {
      setReorderingId(null);
    }
  }

  useEffect(() => {
    if (!isSignedIn) return;
    setOrdersLoading(true);
    setOrdersError("");
    const controller = new AbortController();
    fetch("/api/orders?limit=50", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: { orders?: PlacedOrder[]; error?: string }) => {
        if (data.error) {
          setOrdersError(data.error);
          return;
        }
        setOrders(data.orders ?? []);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setOrdersError("Could not load your orders.");
      })
      .finally(() => setOrdersLoading(false));
    return () => controller.abort();
  }, [isSignedIn]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <div className="min-h-screen bg-[#f8f9fa]">
        <SiteHeader />
        <main id="main" tabIndex={-1} className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6">
          <div className="rounded-3xl border border-border bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <User className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-950">Sign in to view account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Access your orders, prescriptions, and account details.
            </p>
            <SignInButton mode="modal">
              <button className="mt-6 rounded-full bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800">
                Sign In
              </button>
            </SignInButton>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const displayName = user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Customer";
  const firstName = user.firstName ?? displayName.split(" ")[0];
  const email = user.primaryEmailAddress?.emailAddress ?? "Not added";
  const phone = user.primaryPhoneNumber?.phoneNumber ?? "Not added";

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
              My Account
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Welcome, {firstName}
            </h1>
          </div>
          <UserButton />
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="h-fit rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <User className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-slate-950">{displayName}</p>
                <p className="text-xs text-muted-foreground">Clerk verified account</p>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </p>
                <p className="mt-0.5 text-slate-900">{email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </p>
                <p className="mt-0.5 text-slate-900">{phone}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <Link
                href="/medicines"
                className="flex w-full items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
              >
                <ShoppingBag className="h-4 w-4" />
                Shop Medicines
              </Link>
              <Link
                href="/upload-prescription"
                className="flex w-full items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Upload Prescription
              </Link>
            </div>
          </div>

          <div>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950">
              <Package className="h-5 w-5 text-brand-700" />
              Order History
            </h2>

            {ordersLoading ? (
              <div className="rounded-2xl border border-border bg-white p-10 text-center shadow-sm">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
              </div>
            ) : ordersError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
                {ordersError}
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-2xl border border-border bg-white p-10 text-center shadow-sm">
                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Package className="h-6 w-6" />
                </div>
                <p className="font-semibold text-slate-900">No orders yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your placed orders will appear here.
                </p>
                <Link
                  href="/medicines"
                  className="mt-4 inline-flex rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  Browse Medicines
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const isCancelled = order.status === "Cancelled";
                  const isDelivered = order.status === "Delivered";
                  const statusPillClass = isCancelled
                    ? "bg-rose-100 text-rose-700"
                    : isDelivered
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-brand-100 text-brand-700";
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-border bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-bold text-slate-950">{order.id}</p>
                          <p className="text-xs text-muted-foreground">{order.placedAt}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusPillClass}`}
                          >
                            {order.status}
                          </span>
                          <span className="text-sm font-bold text-slate-950">
                            {order.total}
                          </span>
                        </div>
                      </div>

                      <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-slate-600">
                        {order.items.map((item, idx) => (
                          <li key={idx} className="flex justify-between gap-2">
                            <span className="min-w-0 truncate">
                              {item.name}{" "}
                              <span className="text-muted-foreground">x{item.quantity}</span>
                            </span>
                            <span className="shrink-0 font-medium">{item.price}</span>
                          </li>
                        ))}
                      </ul>

                      {isCancelled && order.cancelReason && (
                        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">
                          Cancelled — {order.cancelReason}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">{order.paymentMethod}</p>
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Reorder is available on every past order — even
                              cancelled ones, since the customer may want to
                              re-attempt the purchase. */}
                          <button
                            type="button"
                            onClick={() => handleReorder(order.id)}
                            disabled={reorderingId === order.id}
                            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-60"
                          >
                            {reorderingId === order.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {reorderingId === order.id ? "Adding…" : "Reorder"}
                          </button>
                          <CancelOrderButton
                            orderId={order.id}
                            status={order.status}
                            variant="linkRed"
                            size="sm"
                            onCancelled={(info) =>
                              setOrders((curr) =>
                                curr.map((o) =>
                                  o.id === order.id
                                    ? {
                                        ...o,
                                        status: info.status,
                                        cancelReason: info.cancelReason,
                                        cancelledAt: info.cancelledAt,
                                      }
                                    : o,
                                ),
                              )
                            }
                          />
                          <Link
                            href={`/track-order/${order.id}`}
                            className="min-h-[44px] shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-800"
                          >
                            Track Order
                          </Link>
                        </div>
                      </div>

                      {/* Reorder result notice — appears only on the order
                          that was just reorder'd. Auto-clears when another
                          reorder starts. */}
                      {reorderNotice?.orderId === order.id && (
                        <div
                          className={`mt-3 rounded-xl px-3 py-2 text-xs ${
                            reorderNotice.addedCount > 0
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-rose-50 text-rose-800"
                          }`}
                          role="status"
                        >
                          {reorderNotice.addedCount > 0 && (
                            <p className="font-semibold">
                              Added {reorderNotice.addedCount}{" "}
                              {reorderNotice.addedCount === 1 ? "item" : "items"} to cart — taking you there…
                            </p>
                          )}
                          {reorderNotice.unavailable.length > 0 && (
                            <ul className={`${reorderNotice.addedCount > 0 ? "mt-1" : ""} space-y-0.5`}>
                              {reorderNotice.unavailable.map((u, i) => (
                                <li key={i}>
                                  Couldn&apos;t add <span className="font-semibold">{u.name}</span> — {u.reason}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
