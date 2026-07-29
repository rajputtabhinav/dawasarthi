import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Check,
  Clock,
  IndianRupee,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { RiderApplicationForm } from "@/components/rider-application-form";
import { RiderHeroBanners } from "@/components/rider-hero-banners";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Become a delivery partner",
  description:
    "Join Dawasarthi as a delivery rider in Dibiyapur. Flexible hours, weekly UPI payouts, fuel allowance, and 24×7 support. Apply online in 5 minutes.",
  alternates: { canonical: "/join-as-rider" },
  openGraph: {
    type: "website",
    title: "Become a Dawasarthi delivery rider",
    description:
      "Earn ₹20,000-35,000/month delivering medicines in Dibiyapur. Flexible hours, weekly payouts.",
    url: "/join-as-rider",
    images: [{ url: "/marketing/logo.png", alt: "Dawasarthi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Become a Dawasarthi delivery rider",
    description:
      "Earn ₹20,000-35,000/month delivering medicines in Dibiyapur. Flexible hours, weekly payouts.",
  },
};

const PERKS = [
  {
    icon: IndianRupee,
    title: "Weekly UPI payouts",
    body: "Every Monday. No waiting, no paperwork, no advances.",
  },
  {
    icon: Clock,
    title: "Flexible hours",
    body: "Full-time, part-time, or just evenings. You pick.",
  },
  {
    icon: Wrench,
    title: "Fuel & repair support",
    body: "Per-km fuel on active orders. Two local garage tie-ups for breakdowns.",
  },
  {
    icon: ShieldCheck,
    title: "24×7 human support",
    body: "Stuck mid-delivery? One tap and a real person picks up.",
  },
  {
    icon: Sparkles,
    title: "Peak-hour bonuses",
    body: "Extra ₹ on lunch, evening, and rainy-day surges.",
  },
  {
    icon: Bike,
    title: "Short distances",
    body: "1-4 km within Dibiyapur — quick turnaround, more orders per shift.",
  },
] as const;

const ELIGIBILITY = [
  "18 years or older",
  "Valid 2-wheeler driving licence",
  "Two-wheeler with valid RC and PUC",
  "Aadhaar card",
  "Smartphone with WhatsApp & GPS",
  "Resident in or near Dibiyapur (UP)",
];

const STEPS = [
  {
    n: "1",
    title: "Apply online",
    body: "Fill the form below. About 5 minutes if your documents are handy.",
  },
  {
    n: "2",
    title: "Upload documents",
    body: "Aadhaar (front + back), driving licence, vehicle RC, and a recent selfie.",
  },
  {
    n: "3",
    title: "Verification call",
    body: "We ring you on WhatsApp within 2-3 days to confirm and answer questions.",
  },
  {
    n: "4",
    title: "Start earning",
    body: "Get the login link, install the rider app, pick up your first order.",
  },
];

const FAQ = [
  {
    q: "How much can I really earn?",
    a: "Most active riders complete 20-35 deliveries on a full shift. With ₹20-30 base per order plus fuel allowance and peak bonuses, that's roughly ₹500-800 a day — ₹20,000-35,000 a month for steady work. We pay weekly, no advances needed.",
  },
  {
    q: "What if I only want to work evenings or weekends?",
    a: "That's completely fine. You pick your shift when you apply and can update it from the rider app. There's no minimum hours.",
  },
  {
    q: "Do I need to pay anything to join?",
    a: "No. Joining Dawasarthi is free. You'll never be asked for a security deposit or training fee. If anyone claims otherwise, please report it to support.",
  },
  {
    q: "What if my bike breaks down mid-shift?",
    a: "Open a support ticket from the rider app and our team will reassign your active orders. We have tie-ups with two local garages for emergency repairs.",
  },
  {
    q: "How do payouts work?",
    a: "Every Monday, your last week's earnings are transferred to the UPI ID you provide. You can change the UPI ID any time from the rider app.",
  },
  {
    q: "What documents do I need?",
    a: "Your Aadhaar (front + back), driving licence, vehicle RC, and a recent selfie. PAN is only needed once your monthly earnings cross ₹15,000.",
  },
  {
    q: "Will my personal phone number be visible to customers?",
    a: "Customers see only your first name and a 'Call rider' button that connects through a masked number. Your real number stays private.",
  },
];

export default async function JoinAsRiderPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // SEO: JobPosting structured data so Google Jobs can index this page.
  const jobJsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "Medicine delivery rider",
    description:
      "Deliver medicines for Dawasarthi within Dibiyapur. Flexible shifts, weekly UPI payouts, fuel allowance, and 24×7 support.",
    datePosted: new Date().toISOString().slice(0, 10),
    employmentType: ["PART_TIME", "FULL_TIME", "CONTRACTOR"],
    hiringOrganization: {
      "@type": "Organization",
      name: "Dawasarthi",
      sameAs: "https://dawasarthi.com",
      logo: "https://dawasarthi.com/marketing/logo.png",
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Dibiyapur",
        addressRegion: "Uttar Pradesh",
        postalCode: "209302",
        addressCountry: "IN",
      },
    },
    baseSalary: {
      "@type": "MonetaryAmount",
      currency: "INR",
      value: {
        "@type": "QuantitativeValue",
        minValue: 20000,
        maxValue: 35000,
        unitText: "MONTH",
      },
    },
    industry: "Logistics, Pharmacy",
    qualifications:
      "Age 18+, valid two-wheeler driving licence, own vehicle with RC, Aadhaar, smartphone.",
    incentiveCompensation: "Weekly UPI payouts, fuel allowance, peak-hour bonuses.",
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jobJsonLd).replace(/</g, "\\u003c"),
          }}
        />

        <h1 className="sr-only">
          Become a Dawasarthi delivery rider — earn ₹20,000–35,000/month delivering
          medicines in Dibiyapur. Flexible hours, weekly UPI payouts, fuel
          allowance, and 24×7 support. No joining fee, no security deposit.
          Apply in 5 minutes.
        </h1>

        {/* ── Rotating hero banners — edge-to-edge ─────────────────────── */}
        <RiderHeroBanners />

        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
          {/* ── Earnings hero — the single dominant visual on this page.
              Big bold stat block, dark brand background, real numbers. ── */}
          <section
            aria-labelledby="earnings-headline"
            className="overflow-hidden rounded-3xl bg-brand-900 text-white"
          >
            <div className="grid gap-6 p-7 sm:p-10 lg:grid-cols-[1.3fr_1fr] lg:gap-10">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-200">
                  What you actually take home
                </p>
                <p
                  id="earnings-headline"
                  className="mt-3 text-5xl font-black leading-none tracking-tight sm:text-6xl lg:text-7xl"
                >
                  ₹500
                  <span className="text-brand-200">–</span>
                  800
                  <span className="ml-1 text-2xl font-bold text-brand-200 sm:text-3xl">
                    /day
                  </span>
                </p>
                <p className="mt-4 max-w-md text-sm leading-7 text-brand-100 sm:text-base">
                  25–40 medicine drops at ₹20–30 each. Fuel allowance and
                  peak-hour bonuses on top. UPI payout every Monday — no
                  advances, no fees, no hidden cuts.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="#apply"
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-brand-900 hover:bg-brand-50"
                  >
                    Apply in 5 minutes
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </a>
                  <a
                    href="https://wa.me/919354360049?text=I want to apply as a Dawasarthi rider"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    Ask on WhatsApp
                  </a>
                </div>
              </div>
              {/*
                Right column: an inline "income breakdown" table — a quiet
                editorial counterweight to the giant number on the left.
                Designed to look like a payslip, not a marketing card.
              */}
              <dl className="self-center text-sm">
                <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
                  <dt className="text-brand-200">Base per order</dt>
                  <dd className="font-semibold tabular-nums">₹20–30</dd>
                </div>
                <div className="flex items-baseline justify-between border-b border-white/10 py-3">
                  <dt className="text-brand-200">Typical orders / shift</dt>
                  <dd className="font-semibold tabular-nums">25–40</dd>
                </div>
                <div className="flex items-baseline justify-between border-b border-white/10 py-3">
                  <dt className="text-brand-200">Fuel allowance</dt>
                  <dd className="font-semibold tabular-nums">+₹3/km active</dd>
                </div>
                <div className="flex items-baseline justify-between border-b border-white/10 py-3">
                  <dt className="text-brand-200">Peak / rain bonus</dt>
                  <dd className="font-semibold tabular-nums">+10–25%</dd>
                </div>
                <div className="flex items-baseline justify-between pt-3">
                  <dt className="font-semibold text-white">Take home / month</dt>
                  <dd className="font-bold tabular-nums">₹20k–35k</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* ── Perks — flat list, no per-item card chrome ─────────────── */}
          <section className="mt-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">
              What we promise
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
              Six things, no fine print
            </h2>
            <ul className="mt-6 grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-y-0">
              {PERKS.map(({ icon: Icon, title, body }, i) => (
                <li
                  key={title}
                  className={`flex items-start gap-3 py-4 sm:gap-4 sm:py-5 ${
                    /* horizontal divider on desktop between columns */
                    i % 2 === 0 ? "sm:border-r sm:border-slate-200 sm:pr-6" : "sm:pl-6"
                  } ${
                    /* skip the top border on the first row */
                    i < 2 ? "sm:border-t-0" : "sm:border-t sm:border-slate-200"
                  }`}
                >
                  <Icon
                    className="mt-0.5 h-5 w-5 shrink-0 text-brand-700"
                    aria-hidden
                  />
                  <div>
                    <p className="font-semibold text-slate-950">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Who can join + how it works — flat, divider-based, no
              competing white cards ──────────────────────────────────── */}
          <section className="mt-14 grid gap-10 border-t border-slate-200 pt-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">
                Who can join
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">
                Eligibility
              </h2>
              <ul className="mt-5 space-y-3 text-sm text-slate-800">
                {ELIGIBILITY.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs leading-5 text-amber-900">
                <span className="font-semibold">Note:</span> basic background
                checks happen during verification — honesty upfront speeds
                things up.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">
                Four steps
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">
                How it works
              </h2>
              <ol className="mt-5 space-y-5">
                {STEPS.map((s) => (
                  <li key={s.n} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
                      {s.n}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-950">{s.title}</p>
                      <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                        {s.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ── Application form ─────────────────────────────────────── */}
          <section
            id="apply"
            className="mt-14 scroll-mt-24 border-t border-slate-200 pt-10"
          >
            <div className="mx-auto mb-6 max-w-2xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">
                Application form
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
                Apply in 5 minutes
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Aadhaar, licence, and RC photos ready — we save your progress
                as you go.
              </p>
            </div>
            <RiderApplicationForm />
          </section>

          {/* ── FAQ — flat accordion, single border per item, no per-card chrome ── */}
          <section className="mt-14 border-t border-slate-200 pt-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">
              Before you apply
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
              Common questions
            </h2>
            <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-950 sm:text-base">
                    <span>{f.q}</span>
                    <span
                      className="text-2xl font-light text-slate-400 transition group-open:rotate-45"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </section>

          {/* ── Bottom CTA — dark slab, kept as final closer ───────────── */}
          <section className="mt-14 overflow-hidden rounded-3xl bg-slate-950 p-8 text-center text-white sm:p-12">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Still on the fence?
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
              Message us on WhatsApp. Real person, not a bot — we&apos;ll
              answer honestly, whether or not you end up applying.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a
                href="https://wa.me/919354360049?text=Hi, I have a question about joining as a rider"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-400"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                WhatsApp us
              </a>
              <a
                href="tel:+919354360049"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                <Phone className="h-4 w-4" aria-hidden />
                +91 93543 60049
              </a>
              <Link
                href="#apply"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-900 hover:bg-brand-50"
              >
                Apply now
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
