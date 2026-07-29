import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Terms of service for using Dawasarthi — ordering, prescriptions, delivery, payment, and conduct.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms & Conditions — Dawasarthi",
    description:
      "Terms of service for using Dawasarthi for medicine delivery and prescriptions.",
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
            Legal
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Terms &amp; Conditions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: April 2026
          </p>
        </div>

        <div className="space-y-8 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-950 [&_p]:text-sm [&_p]:leading-7 [&_p]:text-slate-600 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:text-sm [&_ul]:leading-7 [&_ul]:text-slate-600">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Dawasarthi platform, you agree to be
              bound by these Terms and Conditions. If you do not agree, please
              do not use our services.
            </p>
          </section>

          <section>
            <h2>2. Eligibility</h2>
            <p>
              You must be at least 18 years of age to use Dawasarthi. By using
              our platform, you confirm that you meet this requirement.
            </p>
          </section>

          <section>
            <h2>3. Prescription Medicines</h2>
            <p>
              Prescription medicines can only be sold against a valid
              prescription from a registered medical practitioner. By uploading
              a prescription, you confirm it is genuine and has been issued to
              you.
            </p>
            <p className="mt-3">
              Providing a false or forged prescription is a violation of Indian
              law and these Terms and may result in legal action.
            </p>
          </section>

          <section>
            <h2>4. Orders and Pricing</h2>
            <ul>
              <li>All prices are inclusive of applicable taxes.</li>
              <li>
                We reserve the right to modify prices without prior notice.
              </li>
              <li>
                Orders are subject to availability and prescription
                verification.
              </li>
              <li>
                We may cancel orders if a product is out of stock or a
                prescription is invalid.
              </li>
            </ul>
          </section>

          <section>
            <h2>5. Cash on Delivery</h2>
            <p>
              Cash on Delivery (COD) is our primary payment method. Payment is
              due at the time of delivery. Our delivery partner will confirm the
              amount before collection.
            </p>
          </section>

          <section>
            <h2>6. Limitation of Liability</h2>
            <p>
              Dawasarthi is a technology platform connecting customers with
              licensed pharmacies. We are not liable for adverse reactions to
              medicines. Always consult a qualified doctor before starting any
              medication.
            </p>
          </section>

          <section>
            <h2>7. Governing Law</h2>
            <p>
              These terms shall be governed by and construed in accordance with
              the laws of India. Any disputes shall be subject to the
              jurisdiction of courts in Uttar Pradesh, India.
            </p>
          </section>

          <section>
            <h2>8. Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a
                href="mailto:care@dawasarthi.com"
                className="font-medium text-brand-700 hover:underline"
              >
                care@dawasarthi.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/privacy-policy" className="font-medium text-brand-700 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/refund-policy" className="font-medium text-brand-700 hover:underline">
            Refund Policy
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
