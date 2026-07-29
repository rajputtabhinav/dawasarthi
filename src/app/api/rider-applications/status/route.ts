import { NextResponse } from "next/server";
import { getApplicationStatus } from "@/lib/server-rider-applications";
import { assertRateLimitJson } from "@/lib/server-rate-limit";

/**
 * Public application-status check. The applicant supplies their application
 * id + the phone number they applied with — both are required, so a random
 * caller can't enumerate other people's applications.
 */
export async function GET(request: Request) {
  // Per-IP cap stops bursts; the phone-keyed cap below stops a slow attacker
  // from cycling IPs to brute the (id, phone) pair for one applicant.
  const limited = await assertRateLimitJson(
    request,
    "get_rider_application_status",
    20,
  );
  if (limited) return limited;

  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const phone = url.searchParams.get("phone") ?? "";

  // Layer a phone-keyed limit — cheap (the value is in the URL, no DB lookup
  // needed yet) and means an attacker who guesses the phone can only try
  // 30 IDs per hour against that phone.
  if (phone.trim()) {
    const limitedPhone = await assertRateLimitJson(
      request,
      "get_rider_application_status_phone",
      30,
      {
        dimension: phone.trim(),
        windowMs: 60 * 60 * 1000,
      },
    );
    if (limitedPhone) return limitedPhone;
  }

  const result = await getApplicationStatus(id.trim(), phone.trim());
  if (!result.ok) {
    return NextResponse.json(
      { error: "We could not find that application." },
      { status: 404 },
    );
  }
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
