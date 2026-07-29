"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { AdminNewOrderWatcher } from "@/components/admin-new-order-watcher";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  Bike,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/prescriptions", label: "Prescriptions", icon: ClipboardList },
  { href: "/admin/medicines", label: "Medicines", icon: Package },
  { href: "/admin/users", label: "Customers", icon: Users },
  { href: "/admin/riders/applications", label: "Rider applications", icon: Bike },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { signOut } = useClerk();

  function handleLogout() {
    void signOut({ redirectUrl: "/" });
  }

  return (
    <div className="flex h-full flex-col px-4 py-6 lg:px-6">
      {/* Brand */}
      <Link
        href="/"
        onClick={onClose}
        className="block rounded-2xl bg-white/5 p-4 transition hover:bg-white/8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
          Dawasarthi
        </p>
        <p className="mt-1.5 text-xl font-bold">Admin Panel</p>
      </Link>

      {/* Nav */}
      <nav className="mt-6 flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? "bg-brand-700 text-white"
                  : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="mt-auto pt-6">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/8 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Exit Admin
        </button>
        <p className="mt-3 px-4 text-xs text-slate-600">© 2026 Dawasarthi</p>
      </div>
    </div>
  );
}

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const sidebarRef = useFocusTrap<HTMLElement>(sidebarOpen, closeSidebar);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ── Shared top bar (all screen sizes) ── */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 py-3 text-white sm:px-6">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          aria-controls="admin-sidebar"
          aria-expanded={sidebarOpen}
          className="rounded-xl border border-white/10 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-300">
            Dawasarthi
          </p>
          <p className="text-sm font-bold leading-none">Admin Panel</p>
        </div>

        {/*
          Clickable hint for the command palette. Dispatches a custom event
          that the globally-mounted AdminCommandBar listens for. Visually
          stays compact on mobile (just a search icon + kbd) and expands
          into a fake search input on wider screens.
        */}
        {/* Live count badge + notification toggle — see component file
            for the polling/title/notification implementation. */}
        <div className="ml-auto flex items-center gap-2">
          <AdminNewOrderWatcher />
        </div>

        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("dawasarthi:cmdk-open"))
          }
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white sm:min-w-[14rem] sm:justify-between sm:px-3"
          aria-label="Open command palette"
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" aria-hidden />
            <span className="hidden text-slate-400 sm:inline">
              Search orders, medicines…
            </span>
          </span>
          <kbd className="hidden shrink-0 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-300 sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex min-h-[calc(100vh-53px)]">
        {/* Sidebar drawer — slides in from left on all screen sizes */}
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-20 cursor-default bg-slate-950/50"
              style={{ top: 53 }}
              onClick={() => setSidebarOpen(false)}
            />
            {/* Drawer */}
            <aside
              ref={sidebarRef}
              id="admin-sidebar"
              role="dialog"
              aria-modal="true"
              aria-label="Admin navigation"
              className="fixed left-0 z-30 h-[calc(100vh-53px)] w-64 overflow-y-auto bg-slate-950 text-white shadow-2xl"
              style={{ top: 53 }}
            >
              <SidebarContent onClose={() => setSidebarOpen(false)} />
            </aside>
          </>
        )}

        {/* Main content */}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
