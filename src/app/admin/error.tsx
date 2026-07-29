"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Admin-scoped error boundary. Catches errors that bubble out of any admin
 * sub-route (medicines, orders, prescriptions, riders, users). We surface
 * a slim recovery card rather than the public-facing 500 page.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dawasarthi] admin error boundary caught:", error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
      <h2 className="text-lg font-bold text-rose-900">
        Something went wrong loading this admin page
      </h2>
      <p className="mt-2 text-sm text-rose-800">
        {error.message?.slice(0, 200) || "Unexpected error."}
      </p>
      {error.digest ? (
        <p className="mt-1 text-xs text-rose-700">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-rose-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-rose-800"
        >
          Retry
        </button>
        <Link
          href="/admin"
          className="rounded-full border border-rose-300 bg-white px-6 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
