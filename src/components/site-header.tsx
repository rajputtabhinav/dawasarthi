"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  ChevronDown,
  Menu,
  Phone,
  Search,
  Shield,
  ShoppingCart,
  Upload,
  User,
  X,
} from "lucide-react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "@/components/motion-primitives";
import { useCart } from "@/components/providers/cart-provider";
import { BrandLogo } from "@/components/brand-logo";
import { useIsClient } from "@/lib/use-is-client";

const navCategories = [
  {
    label: "Medicines",
    href: "/medicines",
    subCategories: [
      "Fever",
      "Pain Relief",
      "Antibiotics",
      "Diabetes",
      "Blood Pressure",
      "Thyroid",
      "Cardiac Care",
    ],
  },
  {
    label: "Vitamins & Supplements",
    href: "/medicines?category=Vitamins",
    subCategories: [
      "Vitamins",
      "Wellness",
    ],
  },
  {
    label: "Digestion",
    href: "/medicines?category=Digestion",
    subCategories: [
      "Digestion",
    ],
  },
  {
    label: "Allergy & Cold",
    href: "/medicines?category=Allergy",
    subCategories: [
      "Allergy",
      "Cold & Cough",
    ],
  },
  { label: "Offers", href: "/medicines", subCategories: [] },
];

export function SiteHeader() {
  const { itemCount } = useCart();
  const { isLoaded, isSignedIn } = useUser();
  const isMounted = useIsClient();
  const canShowAuthState = isMounted && isLoaded;

  // Admin status is checked via a tiny server endpoint so the admin email
  // allowlist never enters the client bundle.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!isSignedIn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset admin status when sign-out
      setIsAdmin(false);
      return;
    }
    let aborted = false;
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { isAdmin?: boolean }) => {
        if (!aborted) setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      aborted = true;
    };
  }, [isSignedIn]);

  const showAdminLink = canShowAuthState && isSignedIn && isAdmin;

  const userButtonAdminMenu = showAdminLink
    ? [{ label: "Admin", href: "/admin" }]
    : undefined;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<string | null>(null);

  const closeDrawer = useCallback(() => setIsMobileMenuOpen(false), []);
  const drawerRef = useFocusTrap<HTMLElement>(isMobileMenuOpen, closeDrawer);

  return (
    <header className="sticky top-0 z-[100] bg-white shadow-sm">
      {/* Row 1: Promo Bar */}
      <div className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-1 text-[10px] leading-tight sm:px-4 sm:text-[11px] lg:px-8">
          <p className="flex-1 text-center text-[11px] sm:text-xs">
            <span className="font-medium">₹50 off above ₹500</span>
            <span className="mx-1.5 text-slate-400">·</span>
            <span>
              Code:{" "}
              <strong className="text-brand-300 tracking-wider">DAVA50</strong>
            </span>
          </p>
          <a
            href="tel:+919354360049"
            className="hidden shrink-0 items-center gap-1 text-[11px] font-semibold leading-none sm:flex"
          >
            <Phone className="h-3 w-3" />
            +91 9354360049
          </a>
        </div>
      </div>

      {/* Row 2: Logo + Search + Auth + Cart */}
      <div className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 px-2 py-1 sm:gap-2 sm:px-4 sm:py-1.5 lg:px-8">
          <BrandLogo variant="header" />

          <form
            action="/medicines"
            role="search"
            aria-label="Search medicines"
            className="hidden flex-1 items-center gap-1.5 rounded-full border border-border bg-slate-50 px-2 py-1 md:flex"
          >
            <Search className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            <input
              name="query"
              aria-label="Search medicines"
              placeholder="Search for medicines and health products..."
              className="w-full bg-transparent text-[11px] outline-none placeholder:text-slate-400 sm:text-xs"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-semibold leading-tight text-white hover:bg-brand-800 sm:text-xs"
            >
              Search
            </button>
          </form>

          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            <Link
              href="/upload-prescription"
              className="hidden items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:flex"
            >
              <Upload className="h-3 w-3" />
              Upload Rx
            </Link>
            <div className="hidden items-center gap-1.5 lg:flex">
              {!canShowAuthState ? (
                <div className="h-7 w-28 rounded-full bg-slate-100" aria-hidden="true" />
              ) : isSignedIn ? (
                <>
                  {showAdminLink && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100"
                    >
                      <Shield className="h-3 w-3 shrink-0" aria-hidden />
                      Admin
                    </Link>
                  )}
                  <Link
                    href="/account"
                    className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Account
                  </Link>
                  <UserButton customMenuItems={userButtonAdminMenu} />
                </>
              ) : (
                <>
                  <SignInButton mode="modal">
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <User className="h-3 w-3" />
                      Sign In
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Register
                    </button>
                  </SignUpButton>
                </>
              )}
            </div>
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative inline-flex items-center justify-center rounded-full bg-brand-700 p-1.5 text-white hover:bg-brand-800"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              {isMounted && itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-controls="mobile-menu"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="inline-flex rounded-full border border-border p-1.5 text-slate-700 lg:hidden"
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4" aria-hidden />
              ) : (
                <Menu className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>


      {/* Row 3: Category Mega-Nav (desktop only, keyboard accessible) */}
      <div className="hidden border-b border-border bg-white lg:block">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8">
          <nav className="flex items-center" aria-label="Categories">
            {navCategories.map((cat) => (
              <MegaNavItem
                key={cat.label}
                cat={cat}
                isActive={activeNav === cat.label}
                onOpen={() => setActiveNav(cat.label)}
                onClose={() => setActiveNav((curr) => (curr === cat.label ? null : curr))}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu overlay"
              className="fixed inset-0 z-[104] bg-slate-950/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.aside
              ref={drawerRef}
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              className="fixed right-0 top-0 z-[108] h-screen w-[min(88vw,360px)] overflow-y-auto bg-white shadow-xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <BrandLogo variant="drawer" />
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="rounded-full border border-border p-3 text-slate-700"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <div className="space-y-3 p-4">
                <form
                  action="/medicines"
                  role="search"
                  aria-label="Search medicines"
                  className="flex items-center gap-2 rounded-full border border-border bg-slate-50 px-4 py-3"
                >
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <input
                    name="query"
                    aria-label="Search medicines"
                    placeholder="Search medicines..."
                    className="w-full bg-transparent text-base outline-none"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Go
                  </button>
                </form>

                <div className="flex flex-col gap-2">
                  {!canShowAuthState ? (
                    <div className="h-12 rounded-2xl bg-slate-100" aria-hidden="true" />
                  ) : isSignedIn ? (
                    <>
                      {showAdminLink && (
                        <Link
                          href="/admin"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 py-3 text-sm font-semibold text-brand-800 hover:bg-brand-100"
                        >
                          <Shield className="h-4 w-4 shrink-0" aria-hidden />
                          Admin
                        </Link>
                      )}
                      <div className="flex gap-2">
                        <Link
                          href="/account"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-700 py-3 text-sm font-semibold text-white"
                        >
                          My Account
                        </Link>
                      <div className="flex flex-1 items-center justify-center rounded-2xl border border-border py-3">
                        <UserButton customMenuItems={userButtonAdminMenu} />
                      </div>
                    </div>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <SignInButton mode="modal">
                        <button
                          type="button"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-700 py-3 text-sm font-semibold text-white"
                        >
                          Sign In
                        </button>
                      </SignInButton>
                      <SignUpButton mode="modal">
                        <button
                          type="button"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-semibold text-slate-700"
                        >
                          Register
                        </button>
                      </SignUpButton>
                    </div>
                  )}
                </div>

                <a
                  href="tel:+919354360049"
                  className="flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white"
                >
                  <Phone className="h-4 w-4" />
                  Call 24x7 Support
                </a>
                <nav className="space-y-1">
                  {navCategories.map((cat) => (
                    <Link
                      key={cat.label}
                      href={cat.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block rounded-xl border border-border px-4 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {cat.label}
                    </Link>
                  ))}
                </nav>
                <Link
                  href="/upload-prescription"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block rounded-2xl bg-brand-700 px-4 py-3.5 text-center text-sm font-semibold text-white"
                >
                  Upload Prescription
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

type NavCategory = (typeof navCategories)[number];

function MegaNavItem({
  cat,
  isActive,
  onOpen,
  onClose,
}: {
  cat: NavCategory;
  isActive: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const hasSub = cat.subCategories.length > 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!isActive) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isActive, onClose]);

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (
      event.relatedTarget &&
      containerRef.current &&
      containerRef.current.contains(event.relatedTarget as Node)
    ) {
      return;
    }
    onClose();
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={hasSub ? onOpen : undefined}
      onMouseLeave={onClose}
      onFocus={hasSub ? onOpen : undefined}
      onBlur={handleBlur}
    >
      <Link
        ref={triggerRef}
        href={cat.href}
        aria-haspopup={hasSub ? "true" : undefined}
        aria-expanded={hasSub ? isActive : undefined}
        className={`flex items-center gap-0.5 whitespace-nowrap px-2 py-1 text-xs font-medium transition-colors ${
          isActive
            ? "border-b border-brand-700 text-brand-700"
            : "text-slate-700 hover:text-brand-700"
        }`}
      >
        {cat.label}
        {hasSub && <ChevronDown className="h-3 w-3 opacity-70" />}
      </Link>

      {hasSub && isActive && (
        <ul
          aria-label={`${cat.label} subcategories`}
          className="absolute left-0 top-full z-[110] min-w-[180px] rounded-b-xl border border-t-0 border-border bg-white py-1 shadow-lg"
        >
          <li>
            <Link
              href={cat.href}
              className="mx-1.5 mb-0.5 block rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 hover:bg-brand-50 focus:bg-brand-50 focus:outline-none"
            >
              View All →
            </Link>
          </li>
          {cat.subCategories.map((sub) => (
            <li key={sub}>
              <Link
                href={`/medicines?category=${encodeURIComponent(sub)}`}
                className="mx-1.5 block rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-brand-700 focus:bg-slate-50 focus:outline-none"
              >
                {sub}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
