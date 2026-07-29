import Link from "next/link";
import { ArrowRight, Clock, ShieldCheck, Truck, Wallet } from "lucide-react";
import { HomeMedicineSection } from "@/components/home-medicine-section";
import {
  MotionCard,
  MotionItem,
  MotionPage,
  MotionSection,
  MotionStagger,
} from "@/components/motion-primitives";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HeroAiBanners } from "@/components/hero-ai-banners";
import { ShopByHealthConcerns } from "@/components/shop-by-health-concerns";
import { loadMedicinesFromDb } from "@/lib/server-medicines-catalog";

export const revalidate = 60;

const trustItems = [
  { icon: Truck, label: "30 Min Delivery", sub: "Within Dibiyapur" },
  { icon: ShieldCheck, label: "Genuine Medicines", sub: "Verified & expiry-checked" },
  { icon: Clock, label: "24x7 Support", sub: "Call or chat anytime" },
  { icon: Wallet, label: "Cash on Delivery", sub: "No advance payment" },
];

export default async function Home() {
  // Single server-side catalogue fetch — replaces two client-side fetches
  // (homepage + ShopByHealthConcerns) and removes the spinner on first paint.
  const medicines = await loadMedicinesFromDb();
  const categories = Array.from(new Set(medicines.map((m) => m.category))).filter(
    Boolean,
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <SiteHeader />
      {/* z-0: keep page below sticky header z-[100] (Motion transform layers can overlap lower z siblings) */}
      <MotionPage className="relative z-0">
        <main id="main" tabIndex={-1} className="min-w-0">
          {/* ── AI hero carousel — images only ── */}
          <HeroAiBanners />
          <h1 className="sr-only">
            Dawasarthi — 30-minute medicine delivery in Dibiyapur
          </h1>

          {/* ── Trust Strip ── */}
          <section className="border-border bg-white max-lg:border-b-0 lg:border-b">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <MotionStagger className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0 lg:divide-border">
                {trustItems.map(({ icon: Icon, label, sub }) => (
                  <MotionItem key={label}>
                    <div className="flex items-center gap-3 px-6 py-5 transition hover:bg-brand-50/40">
                      <div className="shrink-0 rounded-full bg-brand-50 p-2.5 text-brand-700">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{label}</p>
                        <p className="text-xs text-slate-500">{sub}</p>
                      </div>
                    </div>
                  </MotionItem>
                ))}
              </MotionStagger>
            </div>
          </section>

          <ShopByHealthConcerns categories={categories} />

          {/* ── Popular Medicines ── */}
          <section className="bg-white py-5 sm:py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <HomeMedicineSection
                title="Our Most Popular Medicines"
                items={medicines.slice(0, 12)}
                href="/medicines"
              />
            </div>
          </section>

          {/* ── New Arrivals & Deals ── */}
          <section className="bg-[#f8f9fa] py-5 sm:py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <HomeMedicineSection
                title="New Arrivals & Deals"
                items={medicines.slice(12, 24)}
                href="/medicines"
              />
            </div>
          </section>

          {/* ── Top Partner Pharmacies ── */}
          <section className="bg-white py-5 sm:py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <HomeMedicineSection
                title="Top Partner Pharmacies"
                items={medicines.slice(24, 36)}
                href="/medicines"
              />
            </div>
          </section>

          {/* ── Trust ── */}
          <section className="border-y border-border bg-[#f8f9fa] py-8 sm:py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <MotionSection className="mb-8 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
                  Why Dawasarthi
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">
                  Straightforward care for your family
                </h2>
              </MotionSection>
              <div className="grid gap-8 md:grid-cols-3">
                {[
                  {
                    title: "Catalogue you control",
                    body:
                      "Medicines on this site come only from your admin catalogue—nothing is invented or demo-filled here.",
                  },
                  {
                    title: "Prescription clarity",
                    body:
                      "Products that need a valid prescription are labelled clearly so customers know before they checkout.",
                  },
                  {
                    title: "Local delivery promise",
                    body:
                      "Fast COD delivery within the Dibiyapur service area, with support a call away when something is unclear.",
                  },
                ].map(({ title, body }) => (
                  <MotionItem
                    key={title}
                    className="rounded-2xl border border-border bg-white p-6 shadow-sm"
                  >
                    <p className="font-semibold text-slate-950">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                  </MotionItem>
                ))}
              </div>
              <div className="mt-10 flex justify-center">
                <Link
                  href="/medicines"
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-600 px-5 py-3 text-sm font-semibold text-brand-700 transition hover:scale-[1.02] hover:bg-brand-50 active:scale-95"
                >
                  Browse medicines <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </section>

          {/* ── How It Works ── */}
          <section className="bg-white py-8 sm:py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <MotionSection className="mb-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
                  How It Works
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
                  Order medicines in 3 steps
                </h2>
              </MotionSection>

              <MotionStagger className="grid gap-3 sm:grid-cols-3 sm:gap-6">
                {[
                  {
                    step: "1",
                    title: "Search or Browse",
                    body: "Find by name, category, or condition. Quick shortcuts make it fast.",
                    color: "bg-brand-50 text-brand-700",
                  },
                  {
                    step: "2",
                    title: "Upload if Required",
                    body: "Prescription items are clearly marked. Upload a photo or PDF in seconds.",
                    color: "bg-amber-50 text-amber-700",
                  },
                  {
                    step: "3",
                    title: "Checkout & Pay COD",
                    body: "Add your address and place a Cash on Delivery order. No advance payment.",
                    color: "bg-emerald-50 text-emerald-700",
                  },
                ].map((item) => (
                  <MotionItem key={item.step}>
                    <MotionCard className="flex h-full items-start gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm sm:flex-col sm:gap-0 sm:rounded-2xl sm:p-6">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${item.color}`}
                      >
                        {item.step}
                      </span>
                      <div className="sm:mt-4">
                        <h3 className="text-sm font-bold text-slate-950 sm:text-base">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                          {item.body}
                        </p>
                      </div>
                    </MotionCard>
                  </MotionItem>
                ))}
              </MotionStagger>

              <MotionSection className="mt-8 text-center">
                <Link
                  href="/medicines"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-8 py-3.5 text-sm font-semibold text-white transition hover:scale-[1.04] hover:bg-brand-800 active:scale-95"
                >
                  Start Shopping
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </MotionSection>
            </div>
          </section>
        </main>
      </MotionPage>
      <SiteFooter />
    </div>
  );
}
