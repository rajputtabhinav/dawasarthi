/**
 * Loading skeleton for admin pages. They all fetch DB data on the server
 * (orders / medicines / prescriptions / applications) so the skeleton matches
 * the typical card-grid + table layout used across the admin section.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-7 w-64 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            aria-hidden
          >
            <div className="h-9 w-9 animate-pulse rounded-xl bg-brand-50" />
            <div className="mt-4 h-7 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl bg-slate-50"
              aria-hidden
            />
          ))}
        </div>
      </div>
    </div>
  );
}
