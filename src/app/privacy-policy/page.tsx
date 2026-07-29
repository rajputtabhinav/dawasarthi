import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Dawasarthi collects, uses, and protects your personal and health data.",
  alternates: { canonical: "/privacy-policy" },
  openGraph: {
    title: "Privacy Policy — Dawasarthi",
    description:
      "How Dawasarthi collects, uses, and protects your personal and health data.",
    type: "website",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
            Legal
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: April 2026
          </p>
        </div>

        <div className="space-y-8 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-950 [&_p]:text-sm [&_p]:leading-7 [&_p]:text-slate-600 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:text-sm [&_ul]:leading-7 [&_ul]:text-slate-600">
          <section>
            <h2>1. Information We Collect</h2>
            <p>
              When you use Dawasarthi, we collect information you provide
              directly to us, including your name, phone number, email address,
              and delivery address when you register or place an order.
            </p>
            <p className="mt-3">
              We also collect prescription documents you upload, which are used
              solely to verify and fulfil your medicine orders.
            </p>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <ul>
              <li>To process and deliver your medicine orders</li>
              <li>To verify prescriptions with our pharmacist team</li>
              <li>To send order confirmations and delivery updates</li>
              <li>To respond to your support queries</li>
              <li>To improve our services and platform experience</li>
            </ul>
          </section>

          <section>
            <h2>3. Prescription Data</h2>
            <p>
              Prescription images and PDFs you upload are stored securely and
              accessed only by our licensed pharmacist team for order
              verification. We do not share prescription data with third parties
              for marketing purposes.
            </p>
          </section>

          <section>
            <h2>4. Data Sharing</h2>
            <p>
              We do not sell your personal data. We may share information with
              delivery partners strictly for the purpose of completing your
              order, and with payment processors when applicable.
            </p>
          </section>

          <section>
            <h2>5. Data Security</h2>
            <p>
              We use industry-standard security measures to protect your
              personal information. However, no method of transmission over the
              internet is 100% secure, and we cannot guarantee absolute
              security.
            </p>
          </section>

          <section>
            <h2>6. Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your
              personal data by contacting us at{" "}
              <a
                href="mailto:care@dawasarthi.com"
                className="font-medium text-brand-700 hover:underline"
              >
                care@dawasarthi.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2>7. Contact Us</h2>
            <p>
              For any privacy-related questions, reach us at{" "}
              <a
                href="mailto:care@dawasarthi.com"
                className="font-medium text-brand-700 hover:underline"
              >
                care@dawasarthi.com
              </a>{" "}
              or call{" "}
              <a
                href="tel:+919354360049"
                className="font-medium text-brand-700 hover:underline"
              >
                +91 9354360049
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/terms" className="font-medium text-brand-700 hover:underline">
            Terms &amp; Conditions
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
