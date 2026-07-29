/**
 * Root loading boundary. Shown by Next.js while a server component segment is
 * suspended on data (e.g. catalogue fetch, admin DB queries). Kept generic and
 * lightweight so it streams immediately.
 */
export default function RootLoading() {
  return (
    <div className="min-h-[40vh] bg-[#f8f9fa]">
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700"
          aria-hidden
        />
        <p className="mt-4 text-sm font-medium text-slate-600">Loading…</p>
      </main>
    </div>
  );
}
