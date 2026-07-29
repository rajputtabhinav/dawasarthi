import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import {
  clerkUserMatchesAdminEmails,
  getServerAdminEmails,
} from "@/lib/admin-emails";

/**
 * Fast-path admin check using a custom JWT claim.
 *
 * `is_admin` is populated from `user.public_metadata.is_admin` via Clerk's
 * "Customize session token" feature (dashboard → Sessions → Customize). When
 * present, we trust the verified JWT and skip the `currentUser()` round-trip,
 * which saves ~300-600ms per admin-gated request.
 */
function sessionClaimAdminFlag(sessionClaims: unknown): boolean {
  if (!sessionClaims || typeof sessionClaims !== "object") return false;
  const v = (sessionClaims as { is_admin?: unknown }).is_admin;
  return v === true || v === "true";
}

/**
 * Resolve admin status without hitting Clerk's backend when possible.
 *
 * Path A (fast): the session JWT carries `is_admin: true`. No network call.
 * Path B (slow): bootstrap / fallback — fetch `currentUser()` and check the
 *   `ADMIN_EMAILS` allowlist. Used for users who logged in before the
 *   session-claim customization was rolled out, or as a safety net.
 */
async function isAdmin(): Promise<{ userId: string | null; admin: boolean }> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return { userId: null, admin: false };

  if (sessionClaimAdminFlag(sessionClaims)) {
    return { userId, admin: true };
  }

  // Fallback path: query Clerk for the user's email list.
  const user = await currentUser();
  return {
    userId,
    admin: clerkUserMatchesAdminEmails(user, getServerAdminEmails()),
  };
}

/** Returns a JSON error response if the caller is not an admin, otherwise null. */
export async function requireAdminJson(): Promise<NextResponse | null> {
  const { userId, admin } = await isAdmin();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** Redirects if not signed in (to sign-in with return URL) or not an allowed admin email. */
export async function assertAdminPage(): Promise<void> {
  const { userId, admin } = await isAdmin();
  if (!userId) {
    redirect("/sign-in?redirect_url=" + encodeURIComponent("/admin"));
  }
  if (!admin) {
    redirect("/");
  }
}
