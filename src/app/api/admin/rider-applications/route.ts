import { NextResponse } from "next/server";
import { requireAdminJson } from "@/lib/admin-auth";
import {
  RIDER_APP_STATUSES,
  type RiderApplicationStatus,
} from "@/lib/types";
import { listRiderApplications } from "@/lib/server-rider-applications";

export async function GET(request: Request) {
  const forbidden = await requireAdminJson();
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status") ?? "";
  const status = (RIDER_APP_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as RiderApplicationStatus)
    : undefined;

  const apps = await listRiderApplications(status);
  return NextResponse.json(
    { applications: apps, count: apps.length },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
