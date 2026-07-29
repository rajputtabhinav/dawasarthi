"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BellOff, BellRing, ShoppingBag } from "lucide-react";

/**
 * Polls /api/orders every POLL_MS and surfaces a count of "new since last
 * visit to /admin/orders". Three signals to the admin:
 *
 *  1. Tab title prefix — `(N) Admin · Dawasarthi` so the count is visible
 *     even when the tab isn't focused.
 *  2. Browser notification (Notification API) when count goes up — only
 *     after the user explicitly grants permission via the bell button.
 *  3. Clickable red badge in the top bar that jumps to /admin/orders and
 *     clears the count.
 *
 * "Last seen" is persisted in localStorage so admins keep the same count
 * across browser tabs and reloads. The list is silent on first load — we
 * bookmark the newest existing order so historical orders don't trigger
 * a phantom alert.
 */

const POLL_MS = 15_000;
const LAST_SEEN_KEY = "dawasarthi-admin-last-seen-order";
const RECENT_LIMIT = 15;

type OrderHit = {
  id: string;
  customer: string;
  total?: string;
  placedAt?: string;
};

export function AdminNewOrderWatcher() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [latest, setLatest] = useState<OrderHit | null>(null);
  const [permission, setPermission] =
    useState<NotificationPermission | "unsupported">("default");

  /** Tracks the most-recent-ID we've alerted the user about so we don't
      re-fire the Notification on every poll while the count is steady. */
  const notifiedIdRef = useRef<string | null>(null);
  /** Newest order id the admin has explicitly seen (visited /admin/orders). */
  const lastSeenIdRef = useRef<string | null>(null);
  /** Newest order id observed in the most recent poll. Used when the admin
      visits /admin/orders to advance "last seen" to the current tip. */
  const observedNewestIdRef = useRef<string | null>(null);

  /* ── Init: detect Notification support + load last-seen marker ──────── */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot capability detection
    setPermission(
      typeof Notification === "undefined"
        ? "unsupported"
        : Notification.permission,
    );
    try {
      lastSeenIdRef.current = window.localStorage.getItem(LAST_SEEN_KEY);
    } catch {
      /* localStorage unavailable — count starts at 0, history won't survive reload */
    }
  }, []);

  /* ── Poll loop ──────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/orders?limit=${RECENT_LIMIT}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { orders?: OrderHit[] };
        const orders = data.orders ?? [];
        if (orders.length === 0) return;

        const newestId = orders[0].id;
        observedNewestIdRef.current = newestId;

        // First-time bootstrap: don't alert about pre-existing orders.
        if (!lastSeenIdRef.current) {
          lastSeenIdRef.current = newestId;
          try {
            window.localStorage.setItem(LAST_SEEN_KEY, newestId);
          } catch {
            /* ignore */
          }
          return;
        }

        // Count orders ahead of the last-seen marker.
        const lastSeen = lastSeenIdRef.current;
        const idx = orders.findIndex((o) => o.id === lastSeen);
        const newCount = idx === -1 ? orders.length : idx;

        if (cancelled) return;
        setCount(newCount);
        setLatest(newCount > 0 ? orders[0] : null);

        // Fire a Notification only when (a) permission granted, (b) there's
        // at least one new order, and (c) we haven't already alerted about
        // this newest-id (avoids spam on subsequent polls).
        if (
          newCount > 0 &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          notifiedIdRef.current !== newestId
        ) {
          try {
            new Notification(
              newCount === 1
                ? "New order received"
                : `${newCount} new orders`,
              {
                body:
                  orders[0].customer && orders[0].total
                    ? `${orders[0].customer} · ${orders[0].total}`
                    : orders[0].customer || "Open the admin panel to review.",
                tag: "dawasarthi-orders",
                icon: "/marketing/logo.png",
                silent: false,
              },
            );
            notifiedIdRef.current = newestId;
          } catch {
            /* Notification constructor can throw on some mobile browsers */
          }
        }
      } catch {
        /* network blip — try again next tick */
      }
    }

    void poll();
    const handle = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, []);

  /* ── Title prefix — reapplies on count or route change ───────────────── */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const current = document.title.replace(/^\(\d+\+?\)\s*/, "");
    if (count > 0) {
      const label = count > 99 ? "99+" : String(count);
      document.title = `(${label}) ${current}`;
    } else {
      document.title = current;
    }
  }, [count, pathname]);

  /* ── Clear when admin actually visits /admin/orders ─────────────────── */
  useEffect(() => {
    if (pathname !== "/admin/orders") return;
    if (count === 0 && !observedNewestIdRef.current) return;
    const newest = observedNewestIdRef.current ?? lastSeenIdRef.current;
    if (newest) {
      lastSeenIdRef.current = newest;
      try {
        window.localStorage.setItem(LAST_SEEN_KEY, newest);
      } catch {
        /* ignore */
      }
    }
    notifiedIdRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pathname change is an external event, clearing here is correct
    setCount(0);
    setLatest(null);
  }, [pathname, count]);

  function enableNotifications() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((p) => {
      setPermission(p);
      if (p === "granted") {
        // Confirmation ping so the admin knows it actually works.
        try {
          new Notification("Order alerts on", {
            body: "You'll be notified when a new order arrives.",
            tag: "dawasarthi-orders",
            icon: "/marketing/logo.png",
          });
        } catch {
          /* ignore */
        }
      }
    });
  }

  return (
    <>
      {/* ── Live count badge — clickable, jumps to /admin/orders ───── */}
      {count > 0 && (
        <Link
          href="/admin/orders"
          aria-label={`${count} new orders — view`}
          title={
            latest?.customer
              ? `Latest: ${latest.customer}${latest.total ? ` · ${latest.total}` : ""}`
              : `${count} new orders`
          }
          className="relative inline-flex items-center gap-1.5 rounded-xl border border-rose-400/40 bg-rose-500/15 px-2.5 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25 hover:text-white"
        >
          <span className="relative inline-flex">
            <ShoppingBag className="h-4 w-4" aria-hidden />
            <span className="absolute -right-1 -top-1 inline-flex h-2 w-2 animate-ping rounded-full bg-rose-400" />
          </span>
          <span>{count > 99 ? "99+" : count}</span>
          <span className="hidden text-xs font-medium text-rose-200 sm:inline">
            new
          </span>
        </Link>
      )}

      {/* ── Notification permission button — only when "default" ───── */}
      {permission === "default" && (
        <button
          type="button"
          onClick={enableNotifications}
          aria-label="Enable browser notifications for new orders"
          title="Enable order alert sounds"
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          <Bell className="h-4 w-4" aria-hidden />
        </button>
      )}
      {permission === "granted" && (
        <span
          title="Order alerts on"
          aria-label="Order alerts on"
          className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-2 text-emerald-300"
        >
          <BellRing className="h-4 w-4" aria-hidden />
        </span>
      )}
      {permission === "denied" && (
        <span
          title="Order alerts blocked in browser settings"
          aria-label="Order alerts blocked"
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-500"
        >
          <BellOff className="h-4 w-4" aria-hidden />
        </span>
      )}
    </>
  );
}
