"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { slugifyCategoryLabel } from "@/lib/health-concerns";

const PLACEHOLDER_TILE = "/placeholder-product.svg";

function scrollStridePx(el: HTMLElement) {
  const first = el.querySelector<HTMLElement>("a[data-health-tile]");
  if (!first) return 280;
  const gap = 12 + 4;
  return Math.ceil(first.offsetWidth + gap);
}

type Props = {
  /**
   * Category labels coming from the server. When provided, the component skips
   * the client fetch and renders immediately — much better for LCP on the
   * homepage. Falls back to a client fetch when undefined (for any legacy
   * caller still relying on the old behaviour).
   */
  categories?: string[];
};

export function ShopByHealthConcerns({ categories }: Props = {}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const list = categories ?? [];
    const unique = [...new Set(list)]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return unique.map((label) => ({
      slug: slugifyCategoryLabel(label),
      label,
      href: `/medicines?category=${encodeURIComponent(label)}`,
    }));
  }, [categories]);

  const scrollNextWrap = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const eps = 6;
    const stride = scrollStridePx(el);
    if (max <= eps) return;
    if (el.scrollLeft >= max - eps) {
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      el.scrollBy({ left: stride, behavior: "smooth" });
    }
  }, []);

  const [moreAvailable, setMoreAvailable] = useState(true);

  const syncMore = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setMoreAvailable(max > 8);
  }, []);

  useEffect(() => {
    syncMore();
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => syncMore());
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncMore, items.length]);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="border-b border-border bg-white py-5 sm:py-8 lg:py-10 xl:py-11">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-4 sm:mb-6 lg:mb-7 xl:mb-8">
          <h2 className="text-[1.0625rem] font-bold tracking-tight text-slate-950 sm:text-xl md:text-2xl lg:text-[1.75rem]">
            Shop by category
          </h2>
          <div
            className="mt-1.5 h-0.5 w-12 rounded-full bg-orange-500 sm:mt-2 sm:h-1 sm:w-14 md:w-16 lg:mt-2.5"
            aria-hidden
          />
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            Categories from your catalogue—not preset demo lists.
          </p>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3 md:gap-4">
          <div
            ref={scrollerRef}
            onScroll={syncMore}
            className="min-w-0 flex-1 overscroll-x-contain flex snap-x snap-mandatory gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 sm:pb-1 md:gap-4 [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item) => (
              <Link
                key={item.slug + item.label}
                href={item.href}
                data-health-tile
                aria-label={`Browse ${item.label}`}
                className="group max-sm:max-w-[112px] max-sm:w-[min(7.25rem,30vw)] shrink-0 snap-start sm:w-36 md:w-40 lg:w-44 xl:w-48"
              >
                <article className="flex flex-col items-center">
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 shadow-sm ring-1 ring-black/[0.04] transition group-hover:shadow-md group-hover:ring-brand-200 sm:rounded-2xl md:shadow md:ring-black/[0.06]">
                    <Image
                      src={PLACEHOLDER_TILE}
                      alt=""
                      fill
                      loading="lazy"
                      sizes="(max-width: 639px) min(112px, 30vw), (max-width: 767px) 9rem, (max-width: 1023px) 10rem, (max-width: 1279px) 11rem, 12rem"
                      quality={75}
                      className="object-cover object-center p-4 opacity-90 transition duration-300 group-hover:opacity-100"
                    />
                  </div>
                  <p className="mt-1.5 line-clamp-2 min-h-[2.125rem] w-full px-0.5 text-center text-[11px] font-semibold leading-snug text-slate-900 sm:mt-2 sm:min-h-[2.5rem] sm:text-[13px] md:text-sm lg:text-[0.9375rem]">
                    {item.label}
                  </p>
                </article>
              </Link>
            ))}
          </div>

          <button
            type="button"
            aria-label="Show more categories"
            disabled={!moreAvailable}
            onClick={scrollNextWrap}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:pointer-events-none disabled:opacity-35 sm:flex sm:h-11 sm:w-11 sm:shadow-md md:h-12 md:w-12 lg:h-[3.25rem] lg:w-[3.25rem] lg:shadow-lg"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 md:h-[1.35rem] md:w-[1.35rem] lg:h-6 lg:w-6" />
          </button>
        </div>
      </div>
    </section>
  );
}
