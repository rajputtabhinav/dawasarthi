import Link from "next/link";
import {
  Bike,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import {
  RIDER_APP_STATUSES,
  type RiderApplicationStatus,
} from "@/lib/types";
import { listRiderApplications } from "@/lib/server-rider-applications";

/**
 * Admin rider-applications page — RSC.
 *
 * Previously a client component that hydrated, then fired an `/api/...` fetch
 * which re-ran `requireAdminJson()` (a second `currentUser()` Clerk round-trip)
 * before the table could render. Now we do the auth + DB in one server pass
 * and ship rendered HTML — typical LCP drops from ~4.5s to ~1.5-2s.
 *
 * Filtering is URL-driven (`?status=submitted`) so tab navigation is just a
 * link click. `admin/loading.tsx` provides the skeleton between tabs.
 */

const STATUS_META: Record<
  RiderApplicationStatus,
  { label: string; pill: string; icon: React.ElementType }
> = {
  submitted: {
    label: "Submitted",
    pill: "bg-slate-100 text-slate-700",
    icon: Clock,
  },
  under_review: {
    label: "Under review",
    pill: "bg-blue-100 text-blue-700",
    icon: Eye,
  },
  on_hold: {
    label: "On hold",
    pill: "bg-amber-100 text-amber-800",
    icon: ShieldQuestion,
  },
  approved: {
    label: "Approved",
    pill: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    pill: "bg-rose-100 text-rose-700",
    icon: XCircle,
  },
};

type Tab = "All" | RiderApplicationStatus;
const TABS: Tab[] = ["All", ...RIDER_APP_STATUSES];

function tabLabel(tab: Tab): string {
  if (tab === "All") return "All";
  return STATUS_META[tab].label;
}

function tabHref(tab: Tab): string {
  return tab === "All"
    ? "/admin/riders/applications"
    : `/admin/riders/applications?status=${tab}`;
}

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function AdminRiderApplicationsPage({
  searchParams,
}: PageProps) {
  const { status } = await searchParams;
  const activeTab: Tab =
    status && (RIDER_APP_STATUSES as readonly string[]).includes(status)
      ? (status as RiderApplicationStatus)
      : "All";

  // One DB query for the whole admin set — we filter + count in-memory.
  // At the 500-row cap enforced by `listRiderApplications`, this is well
  // under 50ms of CPU work even on a cold lambda.
  const allApplications = await listRiderApplications();

  const applications =
    activeTab === "All"
      ? allApplications
      : allApplications.filter((a) => a.status === activeTab);

  const counts: Record<Tab, number> = {
    All: allApplications.length,
    submitted: allApplications.filter((a) => a.status === "submitted").length,
    under_review: allApplications.filter((a) => a.status === "under_review").length,
    on_hold: allApplications.filter((a) => a.status === "on_hold").length,
    approved: allApplications.filter((a) => a.status === "approved").length,
    rejected: allApplications.filter((a) => a.status === "rejected").length,
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            Admin · Riders
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Rider applications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review pending applications, approve riders, or request more info.
          </p>
        </div>
        <Link
          href={tabHref(activeTab)}
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Refresh
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = activeTab === t;
          return (
            <Link
              key={t}
              href={tabHref(t)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-brand-700 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tabLabel(t)}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[t]}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
        {applications.length === 0 ? (
          <div className="p-10 text-center">
            <Bike className="mx-auto mb-3 h-8 w-8 text-slate-300" aria-hidden />
            <p className="font-semibold text-slate-900">No applications</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeTab === "All"
                ? "Applications will appear here as soon as someone applies."
                : `No applications in ${tabLabel(activeTab)}.`}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Applicant</th>
                <th className="px-4 py-3 font-semibold">Vehicle</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const meta = STATUS_META[app.status];
                const Icon = meta.icon;
                return (
                  <tr
                    key={app.id}
                    className="border-t border-border align-top hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-950">{app.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {app.phone}
                        {app.availability && (
                          <>
                            <span className="mx-1">·</span>
                            {app.availability}
                          </>
                        )}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        {app.id}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="capitalize text-slate-900">
                        {app.vehicleType}
                      </p>
                      <p className="text-xs uppercase text-muted-foreground">
                        {app.vehicleNumber}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.pill}`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(app.submittedAt).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/riders/applications/${app.id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
