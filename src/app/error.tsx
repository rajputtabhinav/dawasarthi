"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Global error boundary. Catches uncaught render/server-component errors and
 * shows a friendly fallback. The `reset` prop re-runs the boundary's children;
 * we also offer a hard reload + safe links back to working surfaces.
 *
 * Note: `error.tsx` must be a Client Component (per Next.js conventions).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces to Vercel runtime logs — replace with Sentry/OTEL when wired.
    console.error("[dawasarthi] root error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] bg-[#f8f9fa]">
      <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center sm:px-6">
        <p className="text-7xl font-black text-rose-100">⚠</p>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Our team has been notified. You can try again, or head back to the
          homepage and continue browsing.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Reference: <code className="font-mono">{error.digest}</code>
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-border bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Go home
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
          <Link href="/medicines" className="hover:text-brand-700">Browse medicines</Link>
          <a href="tel:+919354360049" className="hover:text-brand-700">
            Call support
          </a>
        </div>
      </main>
    </div>
  );
}
