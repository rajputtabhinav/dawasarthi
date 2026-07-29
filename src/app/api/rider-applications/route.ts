import { NextResponse } from "next/server";
import {
  AVAILABILITY_OPTIONS,
  PREFERRED_SHIFTS,
  RIDER_APP_DOC_KINDS,
  VEHICLE_TYPES,
  type Availability,
  type PreferredShift,
  type RiderAppDocKind,
  type VehicleType,
} from "@/lib/types";
import {
  createRiderApplication,
  type CreateApplicationInput,
} from "@/lib/server-rider-applications";
import { assertRateLimitJson } from "@/lib/server-rate-limit";
import { enforceContentLength, enforceSameOrigin } from "@/lib/request-limits";

const MAX_TOTAL_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB across all docs

/**
 * Public application submission. No Clerk auth — applicants don't have
 * accounts yet. Hardened by:
 *  • Origin check (must be a same-origin form post)
 *  • Content-Length cap of 20 MB
 *  • IP rate limit (3/day, 10/min/IP) — applications are infrequent so a
 *    tight cap is safe
 *  • Per-file magic-byte + MIME validation done inside server-rider-applications
 *  • Phone dedup (one application per phone)
 */
export async function POST(request: Request) {
  const csrfRejected = enforceSameOrigin(request);
  if (csrfRejected) return csrfRejected;

  const tooBig = enforceContentLength(request, MAX_TOTAL_UPLOAD_BYTES);
  if (tooBig) return tooBig;

  // Two-tier limit — IP-keyed because applicants are unauthenticated. The
  // minute cap stops form-spam bursts; the daily cap blocks slow-drip abuse
  // (rotating IPs at 1/min for hours).
  const limitedMinute = await assertRateLimitJson(
    request,
    "post_rider_application_min",
    3,
  );
  if (limitedMinute) return limitedMinute;
  const limitedDay = await assertRateLimitJson(
    request,
    "post_rider_application_day",
    20,
    { windowMs: 24 * 60 * 60 * 1000 },
  );
  if (limitedDay) return limitedDay;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form submission." },
      { status: 400 },
    );
  }

  function text(name: string): string {
    const v = form.get(name);
    return typeof v === "string" ? v : "";
  }
  function file(name: string): File | undefined {
    const v = form.get(name);
    return v instanceof File ? v : undefined;
  }

  const phone = text("phone").trim();
  const fullName = text("fullName").trim();
  const dob = text("dob").trim();
  const genderRaw = text("gender").trim().toLowerCase();
  const gender =
    genderRaw === "male" || genderRaw === "female" || genderRaw === "other"
      ? (genderRaw as "male" | "female" | "other")
      : undefined;
  const currentAddress = text("currentAddress").trim();
  const emergencyContactName = text("emergencyContactName").trim();
  const emergencyContactPhone = text("emergencyContactPhone").trim();

  const vehicleTypeRaw = text("vehicleType").trim();
  const vehicleType = (VEHICLE_TYPES as readonly string[]).includes(vehicleTypeRaw)
    ? (vehicleTypeRaw as VehicleType)
    : undefined;
  const vehicleNumber = text("vehicleNumber").trim();
  const aadhaarLast4 = text("aadhaarLast4").trim();

  const upiId = text("upiId").trim();
  const availabilityRaw = text("availability").trim();
  const availability = (AVAILABILITY_OPTIONS as readonly string[]).includes(
    availabilityRaw,
  )
    ? (availabilityRaw as Availability)
    : undefined;
  const preferredShiftRaw = text("preferredShift").trim();
  const preferredShift = (PREFERRED_SHIFTS as readonly string[]).includes(
    preferredShiftRaw,
  )
    ? (preferredShiftRaw as PreferredShift)
    : undefined;
  const hoursPerWeekRaw = text("hoursPerWeek").trim();
  const hoursPerWeek = hoursPerWeekRaw
    ? Math.max(0, Math.min(168, Number(hoursPerWeekRaw) || 0))
    : undefined;
  const source = text("source").trim();

  // Required enum fields — bail early with helpful messages.
  if (!vehicleType) {
    return NextResponse.json(
      { error: "Select a valid vehicle type.", field: "vehicleType" },
      { status: 400 },
    );
  }
  if (!availability) {
    return NextResponse.json(
      { error: "Select your availability.", field: "availability" },
      { status: 400 },
    );
  }
  if (!preferredShift) {
    return NextResponse.json(
      { error: "Select a preferred shift.", field: "preferredShift" },
      { status: 400 },
    );
  }

  const files: Partial<Record<RiderAppDocKind, File>> = {};
  for (const kind of RIDER_APP_DOC_KINDS) {
    const f = file(kind);
    if (f) files[kind] = f;
  }

  const input: CreateApplicationInput = {
    phone,
    fullName,
    dob,
    gender,
    currentAddress,
    emergencyContactName: emergencyContactName || undefined,
    emergencyContactPhone: emergencyContactPhone || undefined,
    vehicleType,
    vehicleNumber,
    aadhaarLast4,
    upiId: upiId || undefined,
    availability,
    preferredShift,
    hoursPerWeek,
    source: source || undefined,
    files,
  };

  const result = await createRiderApplication(input);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, field: result.field },
      { status: result.status },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      id: result.id,
      status: result.status,
      message:
        "Application received. We'll WhatsApp you in 2-3 days after verification.",
    },
    { status: 201 },
  );
}
