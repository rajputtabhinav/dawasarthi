import { notFound } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  clerkUserMatchesAdminEmails,
  getServerAdminEmails,
} from "@/lib/admin-emails";
import { findOrderForAdmin } from "@/lib/server-orders";
import { PrintTrigger } from "@/components/print-trigger";

/**
 * Admin-only printable packing slip + delivery label.
 *
 * Designed to print at:
 *   - A5 (148 × 210 mm) — standard sheet, fits one slip per page
 *   - 80 mm thermal — single-column layout still works
 *
 * The page renders a minimal layout (no SiteHeader / sidebar / footer) and
 * mounts a tiny client trigger that calls `window.print()` once after the
 * DOM has settled. Print-only CSS lives in globals.css under `@media print`.
 */

export const dynamic = "force-dynamic";

const ORDER_ID_RE = /^ORD[A-Z0-9]{4,32}$/;

type RouteContext = { params: Promise<{ id: string }> };

export default async function PrintSlipPage({ params }: RouteContext) {
  // Inline admin gate — we don't use the admin layout for this page (the
  // layout adds the sidebar, which we don't want in print output).
  const { userId } = await auth();
  if (!userId) {
    redirect(
      "/sign-in?redirect_url=" + encodeURIComponent("/admin/orders"),
    );
  }
  const user = await currentUser();
  if (!clerkUserMatchesAdminEmails(user, getServerAdminEmails())) {
    redirect("/");
  }

  const { id: rawId } = await params;
  const orderId = decodeURIComponent(rawId).trim();
  if (!ORDER_ID_RE.test(orderId)) notFound();

  const order = await findOrderForAdmin(orderId);
  if (!order) notFound();

  const subtotalNumeric = order.items.reduce((sum, it) => {
    const v = Number(String(it.price).replace(/[^\d.]/g, "")) || 0;
    return sum + v * Math.max(1, it.quantity);
  }, 0);

  const totalText = order.total ?? `₹${subtotalNumeric}`;

  const printedAt = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="print-slip-host min-h-screen bg-slate-100 p-4 sm:p-8">
      <PrintTrigger />

      {/* On-screen toolbar (hidden when printing). */}
      <div className="no-print mx-auto mb-4 flex max-w-md flex-wrap items-center justify-between gap-3">
        <a
          href="/admin/orders"
          className="text-sm font-semibold text-slate-700 underline"
        >
          ← Back to orders
        </a>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white"
          // Inline event handler — keeps this page server-rendered apart
          // from the PrintTrigger island, no full client component needed.
          suppressHydrationWarning
        >
          Print again
        </button>
      </div>

      <article
        className="slip mx-auto bg-white text-slate-950 shadow-sm print:shadow-none"
        style={{ maxWidth: 560 }}
      >
        {/* Pharmacy header */}
        <header className="border-b border-dashed border-slate-300 px-6 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Tax invoice cum delivery slip
          </p>
          <h1 className="mt-1 text-lg font-bold leading-tight">
            SHIV KRIPA MEDICAL STORE
          </h1>
          <p className="mt-0.5 text-xs leading-snug text-slate-700">
            Bela Road, Rana Nagar, Dibiyapur, Auraiya,<br />
            Uttar Pradesh — 206244 · +91 93543 60049
          </p>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
            Drug Licence (Form 20):{" "}
            <span className="font-mono">RLF20UP2025015091</span> · Sch. C/C(1)
            (Form 21): <span className="font-mono">RLF21UP2025015033</span>
            <br />
            Registered Pharmacist: Mr. Aman Singh, D.Pharma (Reg. 20252611237)
          </p>
        </header>

        {/* Order meta */}
        <section className="border-b border-dashed border-slate-300 px-6 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Order
              </p>
              <p className="font-mono text-base font-bold tracking-tight">
                {order.id}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Placed
              </p>
              <p className="text-xs">{order.placedAt ?? "—"}</p>
            </div>
          </div>
        </section>

        {/* Deliver-to block */}
        <section className="border-b border-dashed border-slate-300 px-6 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Deliver to
          </p>
          <p className="mt-1 text-base font-bold leading-tight">
            {order.customer}
          </p>
          {order.phone && (
            <p className="mt-0.5 text-sm">
              <span className="text-slate-500">📞</span> {order.phone}
            </p>
          )}
          {order.address && (
            <p className="mt-1 text-sm leading-snug">{order.address}</p>
          )}
          {order.city && order.city !== "—" && (
            <p className="text-sm text-slate-700">{order.city}</p>
          )}
        </section>

        {/* Items table */}
        <section className="px-6 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Items ({order.items.length})
          </p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="pb-1.5 pr-2 font-semibold">Item</th>
                <th className="pb-1.5 px-2 text-center font-semibold">Qty</th>
                <th className="pb-1.5 pl-2 text-right font-semibold">Price</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr
                  key={`${item.name}-${idx}`}
                  className="border-b border-slate-200 last:border-b-0"
                >
                  <td className="py-2 pr-2 align-top leading-snug">
                    {item.name}
                  </td>
                  <td className="py-2 px-2 text-center align-top tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="py-2 pl-2 text-right align-top font-medium tabular-nums">
                    {item.price}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totals */}
        <section className="border-t border-dashed border-slate-300 px-6 py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-slate-700">Subtotal</p>
            <p className="font-mono text-sm">
              ₹{subtotalNumeric.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-slate-700">Delivery</p>
            <p className="font-mono text-sm">FREE</p>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-slate-300 pt-2">
            <p className="text-base font-bold uppercase">
              {order.paymentMethod === "Cash on Delivery"
                ? "Collect (COD)"
                : "Total"}
            </p>
            <p className="font-mono text-lg font-bold">{totalText}</p>
          </div>
          {order.paymentMethod === "Cash on Delivery" && (
            <p className="mt-3 rounded border border-slate-400 px-2 py-1.5 text-center text-xs font-bold uppercase tracking-wider">
              Collect cash on delivery
            </p>
          )}
          {order.prescription && (
            <p className="mt-2 text-[11px] font-semibold text-rose-700">
              ⚠ Rx order — verify prescription before dispatch.
            </p>
          )}
        </section>

        {/* Footer */}
        <footer className="border-t border-dashed border-slate-300 px-6 py-3 text-center text-[10px] leading-relaxed text-slate-600">
          <p>
            Track: dawasarthi.com/track-order/{order.id}
          </p>
          <p className="mt-1">
            Dispensed under the supervision of the Registered Pharmacist named
            above. Drugs and Cosmetics Act, 1940 · Rules, 1945.
          </p>
          <p className="mt-1 text-slate-400">Printed {printedAt}</p>
        </footer>
      </article>
    </div>
  );
}
