import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requireAdminJson } from "@/lib/admin-auth";
import {
  countUserPrescriptionsToday,
  listRecentPrescriptions,
  persistPrescriptionFile,
} from "@/lib/server-prescriptions";
import { assertRateLimitJson } from "@/lib/server-rate-limit";
import {
  BODY_LIMIT_MULTIPART_PRESCRIPTION,
  enforceContentLength,
  enforceSameOrigin,
} from "@/lib/request-limits";

const DAILY_UPLOAD_QUOTA = 20;

export async function GET() {
  const forbidden = await requireAdminJson();
  if (forbidden) return forbidden;
  const prescriptions = await listRecentPrescriptions(200);
  return NextResponse.json({ prescriptions });
}

export async function POST(request: Request) {
  const csrfRejected = enforceSameOrigin(request);
  if (csrfRejected) return csrfRejected;

  const tooBig = enforceContentLength(request, BODY_LIMIT_MULTIPART_PRESCRIPTION);
  if (tooBig) return tooBig;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to upload a prescription." },
      { status: 401 },
    );
  }

  const limited = await assertRateLimitJson(request, "post_prescriptions", 8, {
    userId,
  });
  if (limited) return limited;

  const todays = await countUserPrescriptionsToday(userId);
  if (todays >= DAILY_UPLOAD_QUOTA) {
    return NextResponse.json(
      { error: "Daily upload limit reached. Try again tomorrow." },
      { status: 429 },
    );
  }

  try {
    const contentTypeHeader = request.headers.get("content-type") ?? "";
    if (!contentTypeHeader.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart form submission." },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("prescription");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose a prescription file to upload." },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());

    const user = await currentUser();
    const userEmail =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses?.[0]?.emailAddress;

    const saved = await persistPrescriptionFile({
      userId,
      userEmail: userEmail ?? undefined,
      filename: file.name || "prescription",
      contentType: file.type || "application/octet-stream",
      buffer: buf,
    });

    return NextResponse.json(
      {
        message: "Prescription uploaded.",
        id: saved.id,
      },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed.";
    // Avoid leaking infra error messages to the client.
    const isUserError =
      /file too large|allowed|not a recognized|does not match|sign in/i.test(message);
    if (!isUserError) {
      console.error("[dawasarthi] prescription upload failed:", message);
      return NextResponse.json(
        { error: "Upload failed. Please try again." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
