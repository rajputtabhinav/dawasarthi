import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getSql, isDatabaseConfigured } from "@/lib/db";
import { clerkUserMatchesAdminEmails, getServerAdminEmails } from "@/lib/admin-emails";

/**
 * Operational health check. Returns a minimal status to anonymous callers and
 * detailed diagnostics only to admin Clerk sessions.
 *
 * `dynamic = "force-dynamic"` keeps the handler off the static cache so an
 * outage isn't masked by a stale 200. `no-store` prevents intermediaries from
 * caching either a healthy or unhealthy response.
 */
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

export async function GET(request: Request) {
  // Cheap fast-path for uptime checkers — don't hit Clerk on every probe.
  // Pass `?admin=1` (still requires an admin session) to surface diagnostics.
  const wantsAdmin = new URL(request.url).searchParams.get("admin") === "1";
  let isAdmin = false;
  if (wantsAdmin) {
    const { userId } = await auth();
    if (userId) {
      const user = await currentUser();
      isAdmin = clerkUserMatchesAdminEmails(user, getServerAdminEmails());
    }
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      isAdmin
        ? {
            ok: false,
            postgres: "not_configured",
            hint: "Add POSTGRES_PRISMA_URL (or DATABASE_URL) via the Supabase / Vercel integration and redeploy.",
          }
        : { ok: false },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      isAdmin
        ? {
            ok: false,
            postgres: "unreachable",
            hint: "DB client could not be initialised. Verify POSTGRES_PRISMA_URL is well-formed and reachable.",
          }
        : { ok: false },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const rows = await sql<{ one: number }[]>`SELECT 1 AS one`;
    if (!rows[0] || rows[0].one !== 1) {
      throw new Error("Unexpected ping result");
    }
    return NextResponse.json(
      isAdmin ? { ok: true, postgres: "ok" } : { ok: true },
      { headers: NO_STORE_HEADERS },
    );
  } catch (err) {
    return NextResponse.json(
      isAdmin
        ? {
            ok: false,
            postgres: "unreachable",
            hint: "Ping failed after connect.",
            error: err instanceof Error ? err.message : String(err),
          }
        : { ok: false },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
