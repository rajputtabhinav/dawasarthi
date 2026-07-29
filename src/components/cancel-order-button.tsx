"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, X } from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  CANCEL_REASONS,
  CUSTOMER_CANCELLABLE_STATUSES,
  type CancelReason,
  type OrderStatus,
} from "@/lib/types";

type Variant = "primary" | "ghost" | "danger" | "linkRed";
type Size = "sm" | "md";

export type CancelOrderButtonProps = {
  orderId: string;
  /** Current order status — used to decide whether to render at all (customer). */
  status: OrderStatus;
  /** Set true on admin surfaces so the button is shown even outside the customer window. */
  isAdmin?: boolean;
  /** Called after a successful cancellation. Receives the new status + reason. */
  onCancelled?: (info: {
    status: OrderStatus;
    cancelReason?: string;
    cancelledAt?: string;
  }) => void;
  variant?: Variant;
  size?: Size;
  className?: string;
  /** Custom button label — defaults vary by surface. */
  label?: string;
};

const TERMINAL: OrderStatus[] = ["Delivered", "Cancelled"];

function buttonStyles(variant: Variant, size: Size): string {
  const sizing =
    size === "sm"
      ? "px-3 py-1.5 text-xs"
      : "px-4 py-2.5 text-sm";
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
  switch (variant) {
    case "primary":
      return `${base} ${sizing} bg-rose-600 text-white hover:bg-rose-700`;
    case "danger":
      return `${base} ${sizing} border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100`;
    case "ghost":
      return `${base} ${sizing} border border-border bg-white text-slate-700 hover:bg-slate-50`;
    case "linkRed":
      return `${base} ${sizing} text-rose-700 hover:text-rose-800 hover:underline`;
  }
}

export function CancelOrderButton({
  orderId,
  status,
  isAdmin = false,
  onCancelled,
  variant = "danger",
  size = "sm",
  className,
  label,
}: CancelOrderButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState<CancelReason>(CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState("");

  const close = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    setError("");
  }, [submitting]);
  const dialogRef = useFocusTrap<HTMLDivElement>(open, close);

  // Lock the page scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Hide on terminal status (customer surfaces). Admin can still hit the
  // route directly via the admin shell, but the button shouldn't render once
  // the order is delivered/cancelled.
  if (TERMINAL.includes(status)) return null;

  // For customers, only show the button while the order is still in a
  // self-cancellable window.
  if (!isAdmin && !CUSTOMER_CANCELLABLE_STATUSES.includes(status)) return null;

  async function submit() {
    setSubmitting(true);
    setError("");
    const reasonText =
      reason === "Other" ? customReason.trim() : (reason as string);
    if (reason === "Other" && reasonText.length < 3) {
      setSubmitting(false);
      setError("Please tell us why so we can improve.");
      return;
    }
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reasonText }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        order?: {
          status: OrderStatus;
          cancelReason?: string;
          cancelledAt?: string;
        };
        error?: string;
      };
      if (!res.ok || !data.ok || !data.order) {
        throw new Error(data.error ?? "Could not cancel the order.");
      }
      onCancelled?.({
        status: data.order.status,
        cancelReason: data.order.cancelReason,
        cancelledAt: data.order.cancelledAt,
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${buttonStyles(variant, size)} ${className ?? ""}`}
      >
        <Ban className="h-3.5 w-3.5" aria-hidden />
        {label ?? (isAdmin ? "Cancel order" : "Cancel order")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center bg-slate-950/60 px-3 py-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`cancel-${orderId}-title`}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-3xl border border-border bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  id={`cancel-${orderId}-title`}
                  className="text-lg font-bold text-slate-950"
                >
                  Cancel order {orderId}?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your reserved medicines will be released and any Cash-on-Delivery
                  charge will not apply.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                disabled={submitting}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <fieldset className="mt-5 space-y-2" disabled={submitting}>
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Why are you cancelling?
              </legend>
              {CANCEL_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                    reason === r
                      ? "border-rose-300 bg-rose-50 text-rose-900"
                      : "border-border bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`cancel-reason-${orderId}`}
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="h-4 w-4 accent-rose-600"
                  />
                  <span className="leading-tight">{r}</span>
                </label>
              ))}

              {reason === "Other" && (
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value.slice(0, 200))}
                  rows={3}
                  maxLength={200}
                  placeholder="Tell us a bit more (optional but helps us improve)"
                  className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-300 focus:bg-white"
                  aria-label="Other reason"
                />
              )}
            </fieldset>

            {error && (
              <p role="alert" className="mt-3 text-xs font-medium text-rose-700">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Keep order
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                aria-busy={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {submitting ? "Cancelling…" : "Yes, cancel order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
