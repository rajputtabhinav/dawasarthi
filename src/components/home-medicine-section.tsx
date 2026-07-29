"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import type { Medicine } from "@/lib/types";

type Badge = { text: string; color: string };

type Props = {
  title: string;
  href: string;
  items: Medicine[];
  /** Kept for backward compat with any client caller; ignored when items prop is server-passed. */
  loading?: boolean;
  badge?: Badge;
};

export function HomeMedicineSection({
  title,
  href,
  items,
  loading,
  badge,
}: Props) {
  if (loading && items.length === 0) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-950 sm:text-2xl">{title}</h2>
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700"
          >
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div
          role="status"
          aria-label="Loading medicines"
          className="flex items-center justify-center py-12"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
          <span className="sr-only">Loading…</span>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-950 sm:text-2xl">{title}</h2>
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700"
          >
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <p className="rounded-2xl border border-border bg-slate-50 px-4 py-8 text-center text-sm text-muted-foreground">
          No medicines in the catalogue yet. Add products from the admin dashboard.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-950 sm:text-2xl">{title}</h2>
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700"
        >
          View All <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Mobile: 2-col grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:hidden">
        {items.slice(0, 4).map((medicine) => (
          <div key={medicine.id} className="relative">
            {badge && (
              <div className="absolute right-1.5 top-1.5 z-20">
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white ${badge.color}`}>
                  {badge.text}
                </span>
              </div>
            )}
            <ProductCard medicine={medicine} />
          </div>
        ))}
      </div>

      {/* Desktop: horizontal scroll */}
      <div className="no-scrollbar -mx-4 hidden gap-3 overflow-x-auto px-4 pb-2 sm:flex sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {items.map((medicine) => (
          <div key={medicine.id} className="w-[200px] shrink-0">
            <div className="relative">
              {badge && (
                <div className="absolute right-2 top-2 z-20">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${badge.color}`}>
                    {badge.text}
                  </span>
                </div>
              )}
              <ProductCard medicine={medicine} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
