import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { MotionStagger } from "@/components/motion-primitives";
import { ProductCard } from "@/components/product-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loadMedicinesFromDb } from "@/lib/server-medicines-catalog";
import type { Medicine } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 60;

type SearchParams = Promise<{ category?: string; query?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { category, query } = await searchParams;
  const trimmedQuery = query?.trim() ?? "";
  const trimmedCategory = category?.trim() ?? "";

  const titleParts = ["Medicines"];
  if (trimmedCategory && trimmedCategory !== "All") {
    titleParts.unshift(trimmedCategory);
  }
  if (trimmedQuery) {
    titleParts.push(`"${trimmedQuery}"`);
  }
  const title = `${titleParts.join(" · ")} | Buy online in Dibiyapur`;

  const description = trimmedCategory && trimmedCategory !== "All"
    ? `Browse ${trimmedCategory.toLowerCase()} medicines on Dawasarthi. 30-minute delivery in Dibiyapur with Cash on Delivery.`
    : "Browse all medicines on Dawasarthi. 30-minute delivery in Dibiyapur with Cash on Delivery.";

  return {
    title,
    description,
    alternates: {
      canonical: trimmedCategory && trimmedCategory !== "All"
        ? `/medicines?category=${encodeURIComponent(trimmedCategory)}`
        : "/medicines",
    },
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

function filterCatalogue(
  catalogue: Medicine[],
  category: string,
  query: string,
): Medicine[] {
  const q = query.trim().toLowerCase();
  return catalogue.filter((medicine) => {
    const categoryMatch = category === "All" || medicine.category === category;
    const queryMatch =
      q.length === 0 ||
      medicine.name.toLowerCase().includes(q) ||
      medicine.category.toLowerCase().includes(q) ||
      medicine.manufacturer.toLowerCase().includes(q);
    return categoryMatch && queryMatch;
  });
}

function buildHref(category: string, query: string) {
  const params = new URLSearchParams();
  if (category !== "All") params.set("category", category);
  if (query) params.set("query", query);
  const qs = params.toString();
  return qs ? `/medicines?${qs}` : "/medicines";
}

export default async function MedicinesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { category: rawCategory, query: rawQuery } = await searchParams;
  const selectedCategory = (rawCategory ?? "All").trim() || "All";
  const query = (rawQuery ?? "").trim();

  const catalogue = await loadMedicinesFromDb();
  const filteredMedicines = filterCatalogue(catalogue, selectedCategory, query);
  const allCategoryNames = Array.from(
    new Set(catalogue.map((m) => m.category)),
  ).sort();

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <SiteHeader />

      <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Link href="/" className="hover:text-slate-900">
            Home
          </Link>
          <ChevronRight className="h-4 w-4" aria-hidden />
          <span className="font-medium text-slate-900">Medicines</span>
          {selectedCategory !== "All" && (
            <>
              <ChevronRight className="h-4 w-4" aria-hidden />
              <span className="font-medium text-slate-900">{selectedCategory}</span>
            </>
          )}
        </nav>

        <header className="mb-5">
          <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">
            {selectedCategory !== "All"
              ? `${selectedCategory} medicines`
              : "All medicines"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            30-minute delivery within Dibiyapur · Cash on Delivery · Prescription
            review for Rx items
          </p>
        </header>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden w-56 shrink-0 lg:block" aria-label="Filters">
            <div className="sticky top-32 space-y-4">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-brand-700" aria-hidden />
                  <h2 className="text-sm font-bold text-slate-950">Category</h2>
                </div>
                <ul className="space-y-1">
                  {["All", ...allCategoryNames].map((c) => {
                    const isActive = c === selectedCategory;
                    return (
                      <li key={c}>
                        <Link
                          href={buildHref(c, query)}
                          className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                            isActive
                              ? "bg-brand-700 font-semibold text-white"
                              : "text-slate-700 hover:bg-slate-50 hover:text-brand-700"
                          }`}
                          aria-current={isActive ? "true" : undefined}
                        >
                          <span>{c}</span>
                          {isActive && (
                            <span
                              className="ml-auto h-2 w-2 rounded-full bg-white/70"
                              aria-hidden
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Quick Links
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link
                      href="/upload-prescription"
                      className="hover:text-brand-700"
                    >
                      Upload Prescription
                    </Link>
                  </li>
                  <li>
                    <Link href="/account" className="hover:text-brand-700">
                      Track Your Order
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {["All", ...allCategoryNames].map((c) => {
                const isActive = c === selectedCategory;
                return (
                  <Link
                    key={c}
                    href={buildHref(c, query)}
                    aria-current={isActive ? "true" : undefined}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-brand-700 text-white"
                        : "border border-border bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {c}
                  </Link>
                );
              })}
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              <span className="font-semibold text-slate-900">
                {filteredMedicines.length}
              </span>{" "}
              products found
              {selectedCategory !== "All" && <span> in {selectedCategory}</span>}
              {query && <span> matching “{query}”</span>}
            </p>

            {filteredMedicines.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-white py-16 text-center">
                <p className="text-lg font-semibold text-slate-950">
                  No medicines found
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try a different category or search term.
                </p>
                <Link
                  href="/medicines"
                  className="mt-4 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  Clear Filters
                </Link>
              </div>
            ) : (
              <MotionStagger className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {filteredMedicines.map((medicine) => (
                  <ProductCard key={medicine.id} medicine={medicine} />
                ))}
              </MotionStagger>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
