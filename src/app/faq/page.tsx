import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SUPPORT_EMAIL_CARE, SUPPORT_EMAIL_PHARMACY } from "@/lib/support-contact";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about Dawasarthi — orders, delivery, prescriptions, Cash on Delivery, and support.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Dawasarthi FAQ",
    description:
      "Common questions about ordering, delivery, prescriptions, and Cash on Delivery on Dawasarthi.",
    type: "website",
  },
};

const faqs = [
  {
    q: "How do I order medicines on Dawasarthi?",
    a: "Search for the medicine you need on our medicines page, add it to your cart, and proceed to checkout. Fill in your delivery address and place a Cash on Delivery order. It only takes a few minutes.",
  },
  {
    q: "Do I need a prescription to order medicines?",
    a: "Some medicines require a valid prescription. These are clearly marked on the product page with an 'Rx Required' label. You can upload your prescription on the Upload Prescription page or directly on the product page.",
  },
  {
    q: "How do I upload a prescription?",
    a: "Go to the Upload Prescription page and drag-and-drop your prescription image or PDF, or tap 'Choose file'. Supported formats are JPG, PNG, and PDF. Our pharmacist team will verify it and call you to confirm the order.",
  },
  {
    q: "What payment methods are accepted?",
    a: "We currently accept Cash on Delivery (COD) for all orders. You pay when the order is delivered to your door — no advance payment required.",
  },
  {
    q: "How long does delivery take?",
    a: "We deliver within 30 minutes in Dibiyapur. Our delivery partner will call you before arriving.",
  },
  {
    q: "Can I track my order?",
    a: "Yes. After placing an order, you will receive an order ID. Use it on the Track Order page to see the status of your order.",
  },
  {
    q: "What if I receive a wrong or damaged product?",
    a: `Contact us within 48 hours of delivery by calling +91 9354360049 or emailing ${SUPPORT_EMAIL_CARE} or ${SUPPORT_EMAIL_PHARMACY}. We will arrange a replacement or refund. Please see our Refund Policy for details.`,
  },
  {
    q: "How do I cancel an order?",
    a: "Orders can be cancelled before they are dispatched. Call us immediately at +91 9354360049 to cancel. Once an order is out for delivery, cancellation is not possible.",
  },
  {
    q: "Is my personal and prescription data safe?",
    a: "Yes. Your data is stored securely and accessed only by our pharmacist team for order verification. We do not share your personal or prescription data with third parties for marketing. See our Privacy Policy for full details.",
  },
  {
    q: "How do I create an account?",
    a: "Click Register in the header or footer and fill in your name, email, phone number, and password. You can then track your order history and manage your profile from the My Account page.",
  },
  {
    q: "What areas do you deliver to?",
    a: "We currently deliver in Dibiyapur only. If you are unsure whether your address is within our delivery area, call us at +91 9354360049 and we will confirm.",
  },
  {
    q: "How do I contact support?",
    a: `Our support team is available 24x7. Call us at +91 9354360049 or email ${SUPPORT_EMAIL_CARE} or ${SUPPORT_EMAIL_PHARMACY}.`,
  },
];

export default async function FaqPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <SiteHeader />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
            Help Centre
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Frequently Asked Questions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Can&apos;t find an answer? Call us at{" "}
            <a
              href="tel:+919354360049"
              className="font-medium text-brand-700 hover:underline"
            >
              +91 9354360049
            </a>
            , or email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL_PHARMACY}`}
              className="font-medium text-brand-700 hover:underline"
            >
              {SUPPORT_EMAIL_PHARMACY}
            </a>
            {" / "}
            <a
              href={`mailto:${SUPPORT_EMAIL_CARE}`}
              className="font-medium text-brand-700 hover:underline"
            >
              {SUPPORT_EMAIL_CARE}
            </a>
            {" "}
            — available 24x7.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-white p-5 shadow-sm"
            >
              <h2 className="text-sm font-bold text-slate-950">{faq.q}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl bg-brand-700 p-6 text-center text-white">
          <p className="text-lg font-bold">Still have questions?</p>
          <p className="mt-2 text-sm text-brand-100">
            Our team is available 24x7 to help you with orders, prescriptions,
            and deliveries.
          </p>
          <a
            href="tel:+919354360049"
            className="mt-4 inline-flex rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            Call +91 9354360049
          </a>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-semibold">
            <a
              href={`mailto:${SUPPORT_EMAIL_PHARMACY}`}
              className="text-white underline decoration-brand-200 underline-offset-2 hover:text-brand-100"
            >
              {SUPPORT_EMAIL_PHARMACY}
            </a>
            <span className="hidden text-brand-200 sm:inline" aria-hidden>
              ·
            </span>
            <a
              href={`mailto:${SUPPORT_EMAIL_CARE}`}
              className="text-white underline decoration-brand-200 underline-offset-2 hover:text-brand-100"
            >
              {SUPPORT_EMAIL_CARE}
            </a>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/privacy-policy" className="font-medium text-brand-700 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="font-medium text-brand-700 hover:underline">
            Terms &amp; Conditions
          </Link>
          <Link href="/refund-policy" className="font-medium text-brand-700 hover:underline">
            Refund Policy
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
