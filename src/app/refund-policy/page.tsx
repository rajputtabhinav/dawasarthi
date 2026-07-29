import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "How returns, refunds, and replacements work on Dawasarthi for medicine orders.",
  alternates: { canonical: "/refund-policy" },
  openGraph: {
    title: "Refund Policy — Dawasarthi",
    description:
      "Returns, refunds, and replacements for medicine orders on Dawasarthi.",
    type: "website",
  },
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
            Legal
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Refund &amp; Return Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: April 2026
          </p>
        </div>

        <div className="space-y-8 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-950 [&_p]:text-sm [&_p]:leading-7 [&_p]:text-slate-600 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:text-sm [&_ul]:leading-7 [&_ul]:text-slate-600">
          <section>
            <h2>1. Eligible Returns</h2>
            <p>
              We accept returns in the following situations:
            </p>
            <ul>
              <li>Wrong medicine or wrong quantity delivered</li>
              <li>Damaged or defective product received</li>
              <li>Expired medicine delivered</li>
              <li>Product quality significantly different from description</li>
            </ul>
          </section>

          <section>
            <h2>2. Non-Returnable Items</h2>
            <p>
              The following items cannot be returned due to health and safety
              regulations:
            </p>
            <ul>
              <li>
                Prescription medicines once dispensed (unless there is a
                dispensing error)
              </li>
              <li>Opened or partially used medicines</li>
              <li>Refrigerated products after delivery</li>
              <li>
                Products without original packaging or tamper-evident seal
              </li>
            </ul>
          </section>

          <section>
            <h2>3. How to Request a Refund</h2>
            <p>
              Contact us within 48 hours of delivery to raise a return or
              refund request:
            </p>
            <ul>
              <li>
                Call us at{" "}
                <a
                  href="tel:+919354360049"
                  className="font-medium text-brand-700 hover:underline"
                >
                  +91 9354360049
                </a>
              </li>
              <li>
                Email us at{" "}
                <a
                  href="mailto:care@dawasarthi.com"
                  className="font-medium text-brand-700 hover:underline"
                >
                  care@dawasarthi.com
                </a>
              </li>
              <li>Provide your order ID and describe the issue</li>
              <li>Attach a photo of the product if it is damaged or incorrect</li>
            </ul>
          </section>

          <section>
            <h2>4. Refund Timeline</h2>
            <p>
              Once a return request is approved, refunds are processed within 5
              to 7 business days. Since we operate Cash on Delivery, refunds
              are typically issued via bank transfer or UPI to the account
              details you provide.
            </p>
          </section>

          <section>
            <h2>5. Order Cancellation</h2>
            <p>
              Orders can be cancelled before they are dispatched. To cancel,
              call us immediately at{" "}
              <a
                href="tel:+919354360049"
                className="font-medium text-brand-700 hover:underline"
              >
                +91 9354360049
              </a>
              . Once an order is out for delivery, cancellation is not
              possible.
            </p>
          </section>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/privacy-policy" className="font-medium text-brand-700 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="font-medium text-brand-700 hover:underline">
            Terms &amp; Conditions
          </Link>
          <Link href="/faq" className="font-medium text-brand-700 hover:underline">
            FAQ
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
