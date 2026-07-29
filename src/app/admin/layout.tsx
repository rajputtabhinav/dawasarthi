import type { ReactNode } from "react";
import { assertAdminPage } from "@/lib/admin-auth";
import { AdminCommandBar } from "@/components/admin-command-bar";
import { AdminShell } from "./admin-shell";

/**
 * Admin pages are auth-gated and read live data from Postgres on every load —
 * never useful to prerender. Forcing dynamic here also avoids build-time
 * timeouts that occur when the build worker tries to connect to the DB.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await assertAdminPage();
  return (
    <AdminShell>
      {/*
        Globally-mounted command palette. Opens on ⌘K / Ctrl+K from anywhere
        in /admin, jumps to orders, medicines, or admin pages with one key.
        Returns null until opened so it has near-zero render cost.
      */}
      <AdminCommandBar />
      {children}
    </AdminShell>
  );
}
