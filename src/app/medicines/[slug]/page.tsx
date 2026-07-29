import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, FileText, ShieldAlert, Star, Truck } from "lucide-react";
import {
  MotionHover,
  MotionItem,
  MotionSection,
  MotionStagger,
} from "@/components/motion-primitives";
import { AddToCartButton } from "@/components/providers/cart-provider";
import { MedicineVisual } from "@/components/product-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  findMedicineBySlug,
  listMedicineSlugs,
} from "@/lib/server-medicines";
import { formatCurrency } from "@/lib/utils";

type RouteParams = Promise<{ slug: string }>;

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await listMedicineSlugs();
  return slugs.slice(0, 200).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: RouteParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const medicine = await findMedicineBySlug(slug);

  if (!medicine) {
    return {
      title: "Medicine not found",
      robots: { index: false },
    };
  }

  const title = `${medicine.name} — ${medicine.manufacturer}`;
  const description = (medicine.shortDescription || medicine.description || "")
    .trim()
    .slice(0, 160);

  const isLocalImage =
    medicine.image.startsWith("/") &&
    !medicine.image.startsWith("//");

  return {
    title,
    description: description || `Buy ${medicine.name} online with 30-minute delivery in Dibiyapur.`,
    alternates: { canonical: `/medicines/${medicine.slug}` },
    openGraph: {
      type: "website",
      title: medicine.name,
      description: description || `Buy ${medicine.name} on Dawasarthi.`,
      url: `/medicines/${medicine.slug}`,
      images: isLocalImage
        ? [{ url: medicine.image, alt: medicine.name }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: medicine.name,
      description,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const { slug } = await params;
  const medicine = await findMedicineBySlug(slug);

  if (!medicine) {
    notFound();
  }

  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Medicines",
            item: "/medicines",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: medicine.name,
            item: `/medicines/${medicine.slug}`,
          },
        ],
      },
      {
        "@type": "Product",
        name: medicine.name,
        description: medicine.shortDescription || medicine.description,
        brand: { "@type": "Brand", name: medicine.manufacturer },
        category: medicine.category,
        image: medicine.image.startsWith("data:") ? undefined : medicine.image,
        offers: {
          "@type": "Offer",
          url: `/medicines/${medicine.slug}`,
          priceCurrency: "INR",
          price: medicine.price,
          availability:
            medicine.stockStatus.toLowerCase().includes("out") ||
            (medicine.stockOnHand != null && medicine.stockOnHand <= 0)
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
        },
        aggregateRating:
          medicine.reviewCount > 0
            ? {
                "@type": "AggregateRating",
                ratingValue: medicine.rating,
                reviewCount: medicine.reviewCount,
              }
            : undefined,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/medicines"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to medicines
        </Link>

        <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-8 lg:grid-cols-[1fr_1.05fr]">
          <MotionSection className="rounded-2xl border border-border bg-white p-4 shadow-card sm:rounded-[2rem] sm:p-6">
            <MedicineVisual medicine={medicine} priority />
          </MotionSection>

          <MotionSection className="rounded-2xl border border-border bg-white p-4 shadow-card sm:rounded-[2rem] sm:p-8">
            <MotionStagger className="space-y-5 sm:space-y-8">
              <MotionItem>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">
                    {medicine.category}
                  </span>
                  {medicine.requiresPrescription ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
                      <FileText className="h-4 w-4" aria-hidden />
                      Requires prescription
                    </span>
                  ) : null}
                </div>
              </MotionItem>

              <MotionItem>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-3xl sm:font-semibold">
                    {medicine.name}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>{medicine.packSize}</span>
                    <span>{medicine.manufacturer}</span>
                    {medicine.reviewCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-teal-700">
                        <Star className="h-4 w-4 fill-current" aria-hidden />
                        {medicine.rating.toFixed(1)} ({medicine.reviewCount})
                      </span>
                    )}
                  </div>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                    {medicine.description || medicine.shortDescription}
                  </p>
                </div>
              </MotionItem>

              <MotionItem>
                <div className="flex flex-wrap items-end gap-3">
                  <p className="text-4xl font-semibold text-slate-950">
                    {formatCurrency(medicine.price)}
                  </p>
                  <p className="pb-1 text-base text-muted-foreground line-through">
                    {formatCurrency(medicine.mrp)}
                  </p>
                  {medicine.discount > 0 && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                      {medicine.discount}% off
                    </span>
                  )}
                </div>
              </MotionItem>

              <MotionStagger className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                <MotionItem>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <BadgeCheck className="h-5 w-5 text-emerald-600" aria-hidden />
                    <p className="mt-3 text-sm font-semibold text-slate-950">
                      Stock status
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {medicine.stockStatus}
                    </p>
                  </div>
                </MotionItem>
                <MotionItem>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <Truck className="h-5 w-5 text-brand-700" aria-hidden />
                    <p className="mt-3 text-sm font-semibold text-slate-950">
                      Delivery
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {medicine.deliveryText}
                    </p>
                  </div>
                </MotionItem>
                <MotionItem>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <ShieldAlert className="h-5 w-5 text-brand-700" aria-hidden />
                    <p className="mt-3 text-sm font-semibold text-slate-950">
                      Safety check
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Verified before dispatch
                    </p>
                  </div>
                </MotionItem>
              </MotionStagger>

              <MotionItem>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <MotionHover className="flex-1">
                    <AddToCartButton medicine={medicine} className="flex-1" />
                  </MotionHover>
                  <MotionHover className="flex-1">
                    <Link
                      href="/upload-prescription"
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-border px-5 py-4 text-sm font-semibold text-slate-800"
                    >
                      Upload prescription
                    </Link>
                  </MotionHover>
                </div>
              </MotionItem>
            </MotionStagger>
          </MotionSection>
        </div>

        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
