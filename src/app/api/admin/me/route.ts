import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  clerkUserMatchesAdminEmails,
  getServerAdminEmails,
} from "@/lib/admin-emails";

/**
 * Returns `{ isAdmin: boolean }` for the current Clerk user. Used by the
 * client header to decide whether to show the Admin link, without baking the
 * admin email list into the public JS bundle.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { isAdmin: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const user = await currentUser();
  const isAdmin = clerkUserMatchesAdminEmails(user, getServerAdminEmails());
  return NextResponse.json(
    { isAdmin },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
