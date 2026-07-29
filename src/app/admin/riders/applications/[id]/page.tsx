"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import {
  RIDER_APP_DOC_KINDS,
  type RiderApplication,
  type RiderApplicationStatus,
  type RiderAppDocKind,
} from "@/lib/types";

const DOC_LABELS: Record<RiderAppDocKind, string> = {
  photo: "Selfie",
  aadhaarFront: "Aadhaar (front)",
  aadhaarBack: "Aadhaar (back)",
  licence: "Driving licence",
  rc: "Vehicle RC",
  pan: "PAN card",
};

type AdminApplication = Omit<RiderApplication, "docs"> & {
  docs: Partial<Record<RiderAppDocKind, { contentType: string; size: number }>>;
};

const STATUS_BADGE: Record<RiderApplicationStatus, string> = {
  submitted: "bg-slate-100 text-slate-700",
  under_review: "bg-blue-100 text-blue-700",
  on_hold: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

export default function AdminRiderApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [app, setApp] = useState<AdminApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState<RiderApplicationStatus | null>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/rider-applications/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        application?: AdminApplication;
        error?: string;
      };
      if (!res.ok || !data.application) {
        throw new Error(data.error ?? "Could not load application.");
      }
      setApp(data.application);
      setNotes(data.application.reviewerNotes ?? "");
      setReason(data.application.rejectionReason ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load application.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function changeStatus(nextStatus: RiderApplicationStatus) {
    if (
      nextStatus === "rejected" &&
      reason.trim().length < 3
    ) {
      setError("Please add a short reason before rejecting.");
      return;
    }
    setUpdating(nextStatus);
    setError("");
    try {
      const res = await fetch(`/api/admin/rider-applications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          reason: nextStatus === "rejected" ? reason : undefined,
          notes,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        application?: AdminApplication;
        error?: string;
      };
      if (!res.ok || !data.application) {
        throw new Error(data.error ?? "Update failed.");
      }
      setApp(data.application);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setUpdating(null);
    }
  }

  if (loading && !app) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="flex items-center justify-center py-24"
      >
        <Loader2 className="h-6 w-6 animate-spin text-brand-700" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="rounded-3xl border border-border bg-white p-8 text-center">
        <p className="font-semibold text-slate-900">Application not found.</p>
        {error && (
          <p className="mt-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}
        <Link
          href="/admin/riders/applications"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to applications
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/riders/applications"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to applications
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            {app.fullName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {app.phone} · {app.id}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${STATUS_BADGE[app.status]}`}
        >
          {app.status.replace("_", " ")}
        </span>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Personal */}
          <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Personal details
            </h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date of birth
                </dt>
                <dd className="text-slate-900">{app.dob}</dd>
              </div>
              {app.gender && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Gender
                  </dt>
                  <dd className="capitalize text-slate-900">{app.gender}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Address
                </dt>
                <dd className="text-slate-900">{app.currentAddress}</dd>
              </div>
              {app.emergencyContactName && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Emergency contact
                  </dt>
                  <dd className="text-slate-900">
                    {app.emergencyContactName}
                    {app.emergencyContactPhone && (
                      <>
                        {" "}
                        <span className="text-slate-500">
                          ({app.emergencyContactPhone})
                        </span>
                      </>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Aadhaar (last 4)
                </dt>
                <dd className="font-mono text-slate-900">
                  …{app.aadhaarLast4}
                </dd>
              </div>
            </dl>
          </div>

          {/* Vehicle */}
          <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Vehicle
            </h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </dt>
                <dd className="capitalize text-slate-900">{app.vehicleType}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Number
                </dt>
                <dd className="font-mono uppercase text-slate-900">
                  {app.vehicleNumber}
                </dd>
              </div>
            </dl>
          </div>

          {/* Payouts + availability */}
          <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Payouts & schedule
            </h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  UPI ID
                </dt>
                <dd className="text-slate-900">
                  {app.upiId || (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Availability
                </dt>
                <dd className="text-slate-900">{app.availability}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Preferred shift
                </dt>
                <dd className="text-slate-900">{app.preferredShift}</dd>
              </div>
              {app.hoursPerWeek != null && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Hours/week
                  </dt>
                  <dd className="text-slate-900">{app.hoursPerWeek}</dd>
                </div>
              )}
              {app.source && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Source
                  </dt>
                  <dd className="text-slate-900">{app.source}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Documents */}
          <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Documents
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {RIDER_APP_DOC_KINDS.map((kind) => {
                const present = Boolean(app.docs[kind]);
                if (!present) return null;
                return (
                  <a
                    key={kind}
                    href={`/api/admin/rider-applications/${encodeURIComponent(app.id)}/doc/${kind}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm hover:border-brand-300 hover:bg-white"
                  >
                    <span className="font-medium text-slate-950">
                      {DOC_LABELS[kind]}
                    </span>
                    <ExternalLink className="h-4 w-4 text-slate-500" aria-hidden />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Review panel */}
        <aside className="space-y-5 lg:sticky lg:top-24">
          <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Review
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Reviewer notes are admin-only and never shown to the applicant.
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Notes (internal)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="e.g. Spoke to applicant on WhatsApp, vehicle papers verified."
              className="mt-1 w-full rounded-2xl border border-border bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:bg-white"
            />
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Rejection reason (shown to applicant)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 400))}
              rows={2}
              placeholder="Required only when rejecting."
              className="mt-1 w-full rounded-2xl border border-border bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:bg-white"
            />

            <div className="mt-4 space-y-2">
              <button
                onClick={() => void changeStatus("under_review")}
                disabled={updating != null}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                <Loader2
                  className={`h-4 w-4 ${updating === "under_review" ? "animate-spin" : "hidden"}`}
                  aria-hidden
                />
                Mark under review
              </button>
              <button
                onClick={() => void changeStatus("on_hold")}
                disabled={updating != null}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-60"
              >
                <ShieldQuestion className="h-4 w-4" aria-hidden />
                Put on hold (need more info)
              </button>
              <button
                onClick={() => void changeStatus("approved")}
                disabled={updating != null}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Approve rider
              </button>
              <button
                onClick={() => void changeStatus("rejected")}
                disabled={updating != null}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" aria-hidden />
                Reject
              </button>
            </div>
          </div>

          {app.reviewedAt && (
            <div className="rounded-2xl border border-border bg-slate-50 p-4 text-xs text-muted-foreground">
              Last reviewed{" "}
              {new Date(app.reviewedAt).toLocaleString("en-IN")}
              {app.reviewedBy && (
                <>
                  {" "}
                  by <span className="font-mono">{app.reviewedBy.slice(0, 12)}…</span>
                </>
              )}
              {app.rejectionReason && (
                <p className="mt-2 text-rose-700">
                  Reason shared with applicant: {app.rejectionReason}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
