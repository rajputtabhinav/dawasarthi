"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

/** Five professional ecommerce-style heroes (see scripts/generate-hero-banners.mjs) */
const SLIDES = [
  {
    src: "/marketing/hero-01.jpg",
    alt: "Dawasarthi — best brands and savings with fast delivery in Dibiyapur",
  },
  {
    src: "/marketing/hero-02.jpg",
    alt: "Dawasarthi — wellness and essentials with COD",
  },
  {
    src: "/marketing/hero-03.jpg",
    alt: "Dawasarthi — trusted fast medicine delivery",
  },
  {
    src: "/marketing/hero-05.jpg",
    alt: "Dawasarthi — order anytime with support",
  },
  {
    src: "/marketing/hero-06.jpg",
    alt: "Dawasarthi — health essentials for your family",
  },
] as const;

const INTERVAL_MS = 8500;

export function HeroAiBanners() {
  const [active, setActive] = useState(0);

  const go = useCallback((index: number) => {
    setActive((index + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    // Respect prefers-reduced-motion: don't auto-advance for users who opted out.
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) return;

    let id: number | null = null;

    function start() {
      if (id != null) return;
      id = window.setInterval(() => {
        setActive((s) => (s + 1) % SLIDES.length);
      }, INTERVAL_MS);
    }

    function stop() {
      if (id != null) {
        window.clearInterval(id);
        id = null;
      }
    }

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <section className="relative isolate w-full min-w-0 max-w-full overflow-x-clip">
      {/*
        Assets in /marketing/: JPEG slides use .jpg; true PNG slides keep .png.
        were cropping headlines (top) and people (bottom).
      */}
      <div
        className={[
          "relative w-full min-w-0",
          /* Phone only: shallow strip */
          "max-sm:h-[clamp(7.75rem,min(26svh,10.5rem),11.75rem)] max-sm:max-h-[200px]",
          /* ~33/14 matches actual files (1584×672, 3168×1344); 21/9 is close but not exact */
          "sm:h-auto sm:aspect-[33/14]",
        ].join(" ")}
      >
        {SLIDES.map((slide, index) => (
          <div
            key={slide.src}
            className={`absolute inset-0 bg-slate-100 transition-opacity duration-700 ease-out ${
              index === active
                ? "z-[1] opacity-100"
                : "z-0 opacity-0 pointer-events-none"
            }`}
            aria-hidden={index !== active}
          >
          {/*
            Only the first slide preloads at high priority — others load lazily on
            rotation, keeping LCP fast on first paint.
          */}
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            priority={index === 0}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
            quality={85}
            sizes="(max-width: 639px) 100vw, (max-width: 1279px) 100vw, min(1440px, 100vw)"
            className="object-cover object-center"
          />
        </div>
        ))}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-12 bg-gradient-to-t from-black/30 to-transparent sm:h-16 md:h-20 lg:h-24"
          aria-hidden
        />

        <div className="absolute bottom-3 left-1/2 z-10 flex max-w-[min(100%,20rem)] -translate-x-1/2 flex-wrap justify-center gap-1.5 px-2 max-sm:max-w-[90vw] sm:bottom-4 sm:gap-2 md:bottom-5 lg:max-w-[28rem]">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => go(index)}
              aria-label={`Show banner ${index + 1} of ${SLIDES.length}`}
              aria-pressed={index === active}
              className={`h-1.5 w-1.5 shrink-0 rounded-full transition sm:h-2 md:h-2.5 sm:w-2 md:w-2.5 ${
                index === active ? "bg-white" : "bg-white/35 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
