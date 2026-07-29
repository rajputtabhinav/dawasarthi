import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center sm:px-6">
        <p className="text-8xl font-black text-brand-100">404</p>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          The page you are looking for doesn&apos;t exist or has been moved.
          Try searching for a medicine or go back to the homepage.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Go Home
          </Link>
          <Link
            href="/medicines"
            className="rounded-full border border-border bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Browse Medicines
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
          <Link href="/faq" className="hover:text-brand-700">FAQ</Link>
          <Link href="/account" className="hover:text-brand-700">My Orders</Link>
          <a href="tel:+919354360049" className="hover:text-brand-700">
            Call Support
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
