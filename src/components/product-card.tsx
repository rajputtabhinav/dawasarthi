"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Star } from "lucide-react";
import { motion } from "@/components/motion-primitives";
import { useCart } from "@/components/providers/cart-provider";
import { Medicine } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function MedicineVisual({
  medicine,
  priority = false,
}: {
  medicine: Medicine;
  priority?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-t-xl border-b border-border bg-slate-50">
      {medicine.discount > 0 && (
        <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          -{medicine.discount}%
        </span>
      )}
      {medicine.requiresPrescription && (
        <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
          Rx
        </span>
      )}
      {/* Mobile: shorter image; desktop: taller */}
      <div className="relative flex h-24 w-full items-center justify-center px-3 py-2 sm:h-36 sm:px-4 sm:py-3">
        {medicine.image.startsWith("data:") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={medicine.image}
            alt={medicine.name}
            className="h-full w-full object-contain"
          />
        ) : (
          <Image
            src={medicine.image}
            alt={medicine.name}
            fill
            priority={priority}
            sizes="(max-width: 640px) 45vw, 200px"
            className="object-contain"
          />
        )}
      </div>
    </div>
  );
}

export function ProductCard({ medicine }: { medicine: Medicine }) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);

  function handleAddToCart() {
    for (let i = 0; i < qty; i++) {
      addItem(medicine);
    }
    setQty(1);
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.08 }}
      whileHover={{ y: -5, scale: 1.02, boxShadow: "0 12px 32px rgba(24,79,99,0.13)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm"
    >
      <MedicineVisual medicine={medicine} />

      <div className="flex flex-1 flex-col p-2 sm:p-3">
        {/* Provider */}
        <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
          {medicine.manufacturer}
        </p>

        {/* Name */}
        <Link href={`/medicines/${medicine.slug}`} className="mt-1 block">
          <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-slate-900 sm:text-sm sm:leading-snug">
            {medicine.name}
          </h3>
        </Link>

        {/* Rating — hidden on very small, shown on sm+ */}
        <div className="mt-1 hidden items-center gap-0.5 sm:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-2.5 w-2.5 ${
                i < Math.round(medicine.rating)
                  ? "fill-amber-400 text-amber-400"
                  : "fill-slate-200 text-slate-200"
              }`}
            />
          ))}
          <span className="ml-0.5 text-[10px] font-semibold text-slate-600">
            {medicine.rating.toFixed(1)}
          </span>
        </div>

        {/* Price */}
        <div className="mt-1.5">
          <p className="text-sm font-bold text-slate-950 sm:text-base">
            {formatCurrency(medicine.price)}
          </p>
          <div className="flex flex-wrap items-center gap-1 text-[10px] sm:text-xs">
            <span className="text-muted-foreground line-through">
              {formatCurrency(medicine.mrp)}
            </span>
            {medicine.discount > 0 && (
              <span className="font-semibold text-emerald-600">
                {medicine.discount}% off
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto pt-2">
          {/* Mobile: single compact "Add" button */}
          <motion.button
            type="button"
            onClick={() => addItem(medicine)}
            whileTap={{ scale: 0.93 }}
            whileHover={{ scale: 1.04 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-600 bg-white py-2 text-xs font-semibold text-brand-700 sm:hidden"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Add
          </motion.button>

          {/* Desktop: stepper + Add to Cart */}
          <div className="hidden sm:flex sm:flex-col sm:gap-2">
            <div className="flex items-center justify-between rounded-full border border-border bg-slate-50 p-1">
              <motion.button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                whileTap={{ scale: 0.85 }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-white hover:shadow-sm"
              >
                <Minus className="h-3.5 w-3.5" />
              </motion.button>
              <span className="min-w-[44px] text-center text-xs font-semibold text-slate-800">
                {qty} {qty === 1 ? "unit" : "units"}
              </span>
              <motion.button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty((q) => Math.min(10, q + 1))}
                whileTap={{ scale: 0.85 }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-white hover:shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
              </motion.button>
            </div>

            <motion.button
              type="button"
              onClick={handleAddToCart}
              whileHover={{ scale: 1.03, backgroundColor: "rgb(232 244 246)" }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-brand-600 bg-white py-2.5 text-sm font-semibold text-brand-700"
            >
              <ShoppingCart className="h-4 w-4" />
              Add to Cart
            </motion.button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
