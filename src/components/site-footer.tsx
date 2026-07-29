import Link from "next/link";
import { Code2, LogIn, Mail, User } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import {
  SUPPORT_EMAIL_CARE,
  SUPPORT_EMAIL_PHARMACY,
  TECH_SUPPORT_EMAIL,
  TECH_SUPPORT_NAME,
} from "@/lib/support-contact";

const socialLinks = [
  { label: "Facebook", short: "f", href: "https://facebook.com" },
  { label: "Instagram", short: "in", href: "https://instagram.com" },
  { label: "LinkedIn", short: "li", href: "https://linkedin.com" },
  { label: "YouTube", short: "yt", href: "https://youtube.com" },
  { label: "Twitter", short: "𝕏", href: "https://twitter.com" },
];

const paymentMethods = [
  "UPI",
  "COD",
  "Net Banking",
  "Visa",
  "Mastercard",
  "RuPay",
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-white">
      {/* Zone 1: Logo + Account CTA */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-6 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-8 lg:px-8">
          <BrandLogo variant="footer" />
          <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
            <p className="text-sm font-semibold text-slate-950">My Account</p>
            <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <User className="h-4 w-4" />
                Register
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Register to enjoy faster checkout and order history
            </p>
          </div>
        </div>
      </div>

      {/* Zone 2: Two link columns */}
      <div className="border-b border-border">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-5 lg:px-8">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950">
              About Dawasarthi
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link href="/faq" className="hover:text-slate-900">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-slate-900">
                  Our Brands
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-slate-900">
                  Sell With Us
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-slate-900">
                  Compliance
                </Link>
              </li>
              <li>
                <Link
                  href="/join-as-rider"
                  className="hover:text-slate-900"
                >
                  Become a delivery partner
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950">
              Help &amp; Support
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/account"
                  className="hover:text-slate-900"
                >
                  Track Order
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-slate-900">
                  Shipping &amp; Returns
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-slate-900">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-slate-900">
                  Support Centre
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-slate-900">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950">
              Popular Categories
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/medicines?category=Fever"
                  className="hover:text-slate-900"
                >
                  Fever &amp; Cold
                </Link>
              </li>
              <li>
                <Link
                  href="/medicines?category=Pain+Relief"
                  className="hover:text-slate-900"
                >
                  Pain Relief
                </Link>
              </li>
              <li>
                <Link
                  href="/medicines?category=Diabetes"
                  className="hover:text-slate-900"
                >
                  Diabetes
                </Link>
              </li>
              <li>
                <Link
                  href="/medicines?category=Vitamins"
                  className="hover:text-slate-900"
                >
                  Vitamins
                </Link>
              </li>
              <li>
                <Link href="/medicines" className="hover:text-slate-900">
                  All Medicines
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950">
              Contact Us
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <a
                  href="tel:+919354360049"
                  className="hover:text-slate-900"
                >
                  +91 9354360049
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SUPPORT_EMAIL_CARE}`}
                  className="hover:text-slate-900"
                >
                  {SUPPORT_EMAIL_CARE}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SUPPORT_EMAIL_PHARMACY}`}
                  className="hover:text-slate-900"
                >
                  {SUPPORT_EMAIL_PHARMACY}
                </a>
              </li>
              <li className="text-slate-500">Available 24x7</li>
              <li>
                <Link
                  href="/upload-prescription"
                  className="hover:text-slate-900"
                >
                  Upload Prescription
                </Link>
              </li>
            </ul>
          </div>

          {/*
            Tech support — the person who maintains this site, separate
            from pharmacy/customer-care contact. Reach here for site
            issues, login problems, OTP failures, payment errors, etc.
          */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950">
              Tech Support
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2 text-slate-800">
                <Code2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                <span className="font-medium">{TECH_SUPPORT_NAME}</span>
              </li>
              <li>
                <a
                  href={`mailto:${TECH_SUPPORT_EMAIL}?subject=Dawasarthi%20site%20issue`}
                  className="inline-flex items-center gap-2 hover:text-slate-900"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  {TECH_SUPPORT_EMAIL}
                </a>
              </li>
              <li className="text-xs leading-5 text-slate-500">
                For site issues, login problems, OTP failures, or payment
                errors only. For order help, use Customer care above.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Zone 3: Social Icons */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-5 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-slate-700">Follow us on</p>
          <div className="flex items-center gap-3">
            {socialLinks.map(({ label, short, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-sm font-bold text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              >
                {short}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Zone 3.5: Regulatory & Licence Information.
          Required by the Drugs and Cosmetics Act, 1940 + Drugs Rules, 1945.
          Drug Inspectors check that licence numbers, the responsible
          pharmacist, and the licensed address are visible on the public
          surface of any retail/e-pharmacy. */}
      <div className="border-t border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs leading-relaxed text-slate-600 sm:px-6 lg:px-8">
          <p className="font-semibold uppercase tracking-[0.18em] text-slate-500">
            Regulatory information
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            SHIV KRIPA MEDICAL STORE
          </p>
          <p className="mt-0.5">
            Bela Road, Rana Nagar, Dibiyapur, Auraiya, Uttar Pradesh — 206244, India
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <dt className="font-semibold text-slate-700">Retail Drug Licence (Form 20):</dt>
              <dd className="font-mono tracking-tight">RLF20UP2025015091</dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <dt className="font-semibold text-slate-700">Schedule C / C(1) Licence (Form 21):</dt>
              <dd className="font-mono tracking-tight">RLF21UP2025015033</dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <dt className="font-semibold text-slate-700">Registered Pharmacist:</dt>
              <dd>Mr. Aman Singh, D.Pharma (Reg. ID 20252611237)</dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <dt className="font-semibold text-slate-700">Issuing authority:</dt>
              <dd>
                Kanpur Division, Food Safety and Drug Administration, Govt. of Uttar Pradesh
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <dt className="font-semibold text-slate-700">Validity:</dt>
              <dd>08 Jul 2025 — 07 Jul 2030</dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <dt className="font-semibold text-slate-700">Proprietor:</dt>
              <dd>Ankit Rajput</dd>
            </div>
          </dl>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Drugs are dispensed only under the supervision of the Registered Pharmacist named above,
            as required under the Drugs and Cosmetics Act, 1940 and the Drugs Rules, 1945. Schedule H
            and Schedule H1 drugs are sold strictly against a valid prescription from a registered
            medical practitioner.
          </p>
        </div>
      </div>

      {/* Zone 4: Copyright + Payment Methods */}
      <div className="bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-4 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground">
            © 2026 Dawasarthi. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {paymentMethods.map((method) => (
              <span
                key={method}
                className="rounded-md border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
