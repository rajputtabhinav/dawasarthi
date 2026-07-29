"use client";

import { Ban, Check } from "lucide-react";
import { MotionItem, MotionStagger, motion } from "@/components/motion-primitives";

const steps = ["Ordered", "Packed", "Out for Delivery", "Delivered"];

const STATUS_ALIAS: Record<string, string> = {
  Confirmed: "Ordered",
  confirmed: "Ordered",
};

export function OrderTimeline({
  currentStatus,
}: {
  currentStatus: string;
}) {
  const normalized = STATUS_ALIAS[currentStatus] ?? currentStatus;

  // Cancelled is a terminal sibling state — render a single, clear "Cancelled"
  // card instead of the forward pipeline so customers aren't confused by half-
  // completed checkmarks.
  if (normalized === "Cancelled") {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
        <div className="inline-flex rounded-full bg-rose-600 p-2 text-white">
          <Ban className="h-4 w-4" aria-hidden />
        </div>
        <p className="mt-3 font-semibold">Cancelled</p>
        <p className="mt-1 text-sm text-rose-900/80">
          This order will no longer be delivered. Reserved stock has been
          returned to the catalogue.
        </p>
      </div>
    );
  }

  const currentStepIndex = steps.indexOf(normalized);

  return (
    <MotionStagger className="grid gap-4 sm:grid-cols-4">
      {steps.map((step, index) => {
        const isCompleted = index <= currentStepIndex;

        return (
          <MotionItem key={step}>
            <div className="relative rounded-3xl border border-border bg-slate-50 p-5">
              {index < steps.length - 1 ? (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: index * 0.08 + 0.2, duration: 0.4 }}
                  style={{ originX: 0 }}
                  className={`absolute left-[calc(100%_-_8px)] top-7 hidden h-[2px] w-[calc(100%_-_24px)] sm:block ${
                    index < currentStepIndex ? "bg-emerald-600" : "bg-slate-200"
                  }`}
                />
              ) : null}
              <motion.div
                initial={{ scale: 0.85, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.08 }}
                className={`mb-4 inline-flex rounded-full p-2 ${
                  isCompleted ? "bg-emerald-600 text-white" : "bg-white text-slate-300"
                }`}
              >
                <Check className="h-4 w-4" aria-hidden />
              </motion.div>
              <p className="font-semibold text-slate-950">{step}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {isCompleted ? "Completed" : "Pending"}
              </p>
            </div>
          </MotionItem>
        );
      })}
    </MotionStagger>
  );
}
