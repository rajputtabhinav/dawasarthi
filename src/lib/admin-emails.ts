/**
 * Admin access is gated by verified Clerk email addresses.
 *
 * - `ADMIN_EMAILS` (server, required for admin access): comma-separated admin emails — API + /admin gating.
 * - `NEXT_PUBLIC_ADMIN_EMAILS` (client): comma-separated emails that should also see the admin link in the header.
 *
 * Admin emails are not hardcoded into source so they cannot leak through the
 * public git history or the client bundle.
 */

function normalizeEmailList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Server + API routes — uses secret `ADMIN_EMAILS`. */
export function getServerAdminEmails(): Set<string> {
  return new Set(normalizeEmailList(process.env.ADMIN_EMAILS));
}

/** Client bundle — uses `NEXT_PUBLIC_ADMIN_EMAILS` only. */
export function getClientAdminEmails(): Set<string> {
  return new Set(normalizeEmailList(process.env.NEXT_PUBLIC_ADMIN_EMAILS));
}

type ClerkEmailAddress = {
  id?: string;
  emailAddress: string;
  verification?: { status?: string | null } | null;
};

/** Enough shape for Backend User (`currentUser`) and Clerk frontend User (`useUser`). */
type MinimalUserForAdminEmails = {
  emailAddresses?: ReadonlyArray<ClerkEmailAddress> | undefined;
  primaryEmailAddressId?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  /** Used only as a fallback when primary id + allowlist match but `verification.status` is missing on the client. */
  hasVerifiedEmailAddress?: boolean;
} | null | undefined;

/**
 * True if this Clerk user may act as admin for the given allowlist.
 *
 * - Primary email on allowlist → allow (OAuth/client payloads often omit `verification.status` on addresses).
 * - Other addresses on allowlist → require `verification.status === "verified"`.
 */
export function clerkUserMatchesAdminEmails(
  user: MinimalUserForAdminEmails,
  allowed: Set<string>,
): boolean {
  if (!user) return false;

  const primaryNorm =
    user.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? null;
  if (primaryNorm && allowed.has(primaryNorm)) return true;

  const list = user.emailAddresses;
  if (!list?.length) return false;

  if (
    list.length === 1 &&
    allowed.has(list[0].emailAddress.trim().toLowerCase()) &&
    (list[0].verification?.status === "verified" ||
      user.hasVerifiedEmailAddress === true)
  ) {
    return true;
  }

  const primaryId = user.primaryEmailAddressId ?? null;

  return list.some((ea) => {
    const normalized = ea.emailAddress.trim().toLowerCase();
    if (!allowed.has(normalized)) return false;

    if (ea.verification?.status === "verified") return true;

    if (primaryNorm !== null && normalized === primaryNorm) return true;

    if (
      primaryId != null &&
      ea.id != null &&
      ea.id === primaryId &&
      user.hasVerifiedEmailAddress === true
    ) {
      return true;
    }

    return false;
  });
}
