"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";

type Prescription = {
  id: string;
  userId: string;
  userEmail?: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  hasBlob: boolean;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN");
  } catch {
    return iso;
  }
}

export default function AdminPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/prescriptions", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        prescriptions?: Prescription[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load prescriptions.");
      }
      setPrescriptions(data.prescriptions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load prescriptions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Prescription uploads
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest prescriptions uploaded by customers. The file content is stored
            securely and is only available to verifying staff.
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </header>

      {error && (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
        {loading && prescriptions.length === 0 ? (
          <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No prescription uploads yet.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">File</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Size</th>
                <th className="px-4 py-3 font-semibold">Uploaded</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map((rx) => (
                <tr
                  key={rx.id}
                  className="border-t border-border align-top hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 text-brand-700" />
                      <div>
                        <p className="font-medium text-slate-950">{rx.filename}</p>
                        <p className="text-xs text-muted-foreground">{rx.contentType}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-900">{rx.userEmail ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{rx.userId.slice(0, 14)}…</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatSize(rx.size)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatTime(rx.uploadedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/prescriptions/${rx.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
