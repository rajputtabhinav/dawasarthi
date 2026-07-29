/**
 * Loading skeleton for the medicines catalog. Mimics the grid layout so the
 * page doesn't shift when the data finally streams in.
 */
export default function MedicinesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 h-7 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mb-8 h-4 w-2/3 animate-pulse rounded bg-slate-100" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            aria-hidden
          >
            <div className="aspect-square w-full animate-pulse rounded-xl bg-slate-100" />
            <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-9 w-full animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
