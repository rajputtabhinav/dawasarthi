"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  AVAILABILITY_OPTIONS,
  PREFERRED_SHIFTS,
  RIDER_APP_SOURCES,
  VEHICLE_TYPES,
  type Availability,
  type PreferredShift,
  type RiderAppDocKind,
  type VehicleType,
} from "@/lib/types";

type FormState = {
  phone: string;
  fullName: string;
  dob: string;
  gender: "" | "male" | "female" | "other";
  currentAddress: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  vehicleType: VehicleType | "";
  vehicleNumber: string;
  aadhaarLast4: string;
  upiId: string;
  availability: Availability | "";
  preferredShift: PreferredShift | "";
  hoursPerWeek: string;
  source: string;
};

const EMPTY: FormState = {
  phone: "",
  fullName: "",
  dob: "",
  gender: "",
  currentAddress: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  vehicleType: "",
  vehicleNumber: "",
  aadhaarLast4: "",
  upiId: "",
  availability: "",
  preferredShift: "",
  hoursPerWeek: "",
  source: "",
};

const STORAGE_KEY = "dawasarthi-rider-application-draft";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = [
  "Contact",
  "Personal",
  "Vehicle & documents",
  "Payouts & availability",
];

const DOC_LABELS: Record<RiderAppDocKind, { label: string; required: boolean; hint: string }> = {
  photo: { label: "Your photo (selfie)", required: true, hint: "Clear face, daylight" },
  aadhaarFront: { label: "Aadhaar card (front)", required: true, hint: "Photo of the front side" },
  aadhaarBack: { label: "Aadhaar card (back)", required: true, hint: "Photo of the back side" },
  licence: { label: "Driving licence", required: true, hint: "Front of the licence" },
  rc: { label: "Vehicle RC", required: true, hint: "Registration certificate" },
  pan: { label: "PAN card (optional)", required: false, hint: "Needed only once you cross ₹15,000/month" },
};

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function isValidPhone(p: string): boolean {
  return /^\d{10}$/.test(p.replace(/\D/g, "").slice(-10));
}

function ageFromDob(dob: string): number | null {
  const t = new Date(dob).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24 * 365.25);
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function RiderApplicationForm() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [files, setFiles] = useState<Partial<Record<RiderAppDocKind, File>>>({});
  const [fileErrors, setFileErrors] = useState<Partial<Record<RiderAppDocKind, string>>>({});
  const [fieldError, setFieldError] = useState<{ field: string; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ id: string } | null>(null);
  const [consent, setConsent] = useState(false);

  // Restore draft on mount (text fields only — File objects can't be persisted).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FormState>;
        setForm((curr) => ({ ...curr, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist on each change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* ignore quota */
    }
  }, [form]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((curr) => ({ ...curr, [key]: value }));
    if (fieldError?.field === key) setFieldError(null);
  }

  const handleFile = useCallback((kind: RiderAppDocKind, file: File | null) => {
    setFileErrors((curr) => ({ ...curr, [kind]: undefined }));
    if (!file) {
      setFiles((curr) => {
        const next = { ...curr };
        delete next[kind];
        return next;
      });
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      setFileErrors((curr) => ({
        ...curr,
        [kind]: "Only JPG, PNG, WebP, or PDF files.",
      }));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileErrors((curr) => ({
        ...curr,
        [kind]: "File is larger than 4 MB.",
      }));
      return;
    }
    setFiles((curr) => ({ ...curr, [kind]: file }));
  }, []);

  const stepValid = useMemo(() => {
    switch (step) {
      case 1:
        return isValidPhone(form.phone);
      case 2: {
        if (!form.fullName.trim() || form.fullName.trim().length < 2) return false;
        const age = ageFromDob(form.dob);
        if (age == null || age < 18 || age > 70) return false;
        if (form.currentAddress.trim().length < 10) return false;
        return true;
      }
      case 3: {
        if (!form.vehicleType) return false;
        if (!/^[A-Z0-9 -]{4,20}$/.test(form.vehicleNumber.trim().toUpperCase())) return false;
        if (!/^\d{4}$/.test(form.aadhaarLast4)) return false;
        for (const kind of ["photo", "aadhaarFront", "aadhaarBack", "licence", "rc"] as const) {
          if (!files[kind]) return false;
        }
        return true;
      }
      case 4: {
        if (!form.availability || !form.preferredShift) return false;
        return consent;
      }
    }
    return false;
  }, [step, form, files, consent]);

  async function handleSubmit() {
    if (!consent) {
      setFieldError({ field: "consent", text: "Please accept the terms." });
      return;
    }
    setSubmitting(true);
    setFieldError(null);
    try {
      const fd = new FormData();
      fd.append("phone", form.phone);
      fd.append("fullName", form.fullName);
      fd.append("dob", form.dob);
      if (form.gender) fd.append("gender", form.gender);
      fd.append("currentAddress", form.currentAddress);
      fd.append("emergencyContactName", form.emergencyContactName);
      fd.append("emergencyContactPhone", form.emergencyContactPhone);
      if (form.vehicleType) fd.append("vehicleType", form.vehicleType);
      fd.append("vehicleNumber", form.vehicleNumber.toUpperCase());
      fd.append("aadhaarLast4", form.aadhaarLast4);
      fd.append("upiId", form.upiId);
      if (form.availability) fd.append("availability", form.availability);
      if (form.preferredShift) fd.append("preferredShift", form.preferredShift);
      fd.append("hoursPerWeek", form.hoursPerWeek);
      fd.append("source", form.source);
      for (const [kind, file] of Object.entries(files)) {
        if (file) fd.append(kind, file);
      }

      const res = await fetch("/api/rider-applications", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        error?: string;
        field?: string;
      };
      if (!res.ok || !data.ok || !data.id) {
        setFieldError({
          field: data.field ?? "form",
          text: data.error ?? "Submission failed. Please try again.",
        });
        return;
      }
      // Clear the draft on success.
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setSuccess({ id: data.id });
    } catch {
      setFieldError({ field: "form", text: "Network issue. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-10">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </div>
        <h2 className="mt-5 text-2xl font-bold text-emerald-950">
          Application received
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900/80">
          Thanks for applying! Your application ID is{" "}
          <span className="font-mono font-bold text-emerald-950">
            {success.id}
          </span>
          .
        </p>
        <p className="mt-1 text-sm leading-relaxed text-emerald-900/80">
          We&apos;ll WhatsApp you on{" "}
          <span className="font-semibold">{form.phone.slice(-10)}</span> in 2–3
          working days after verifying your documents.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href={`https://wa.me/919354360049?text=${encodeURIComponent(
              `Hi, my rider application ID is ${success.id}.`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Message us on WhatsApp
          </a>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-8">
      {/* Stepper */}
      <ol className="mb-6 flex items-center justify-between gap-2 text-xs font-semibold">
        {STEP_LABELS.map((label, idx) => {
          const n = (idx + 1) as Step;
          const active = step === n;
          const done = step > n;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] ${
                  done
                    ? "bg-emerald-600 text-white"
                    : active
                      ? "bg-brand-700 text-white"
                      : "bg-slate-100 text-slate-500"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : n}
              </span>
              <span
                className={`truncate max-sm:hidden ${
                  active ? "text-slate-950" : "text-slate-500"
                }`}
              >
                {label}
              </span>
              {idx < STEP_LABELS.length - 1 && (
                <span
                  className={`mx-1 hidden h-px flex-1 sm:block ${
                    done ? "bg-emerald-300" : "bg-slate-200"
                  }`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>

      {fieldError && fieldError.field === "form" && (
        <p
          role="alert"
          className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {fieldError.text}
        </p>
      )}

      {/* Step 1 — Contact */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Let&apos;s start with your phone
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This is how we&apos;ll reach you. We don&apos;t spam — just one
              update when your application is reviewed.
            </p>
          </div>
          <label className="block text-sm font-semibold text-slate-950">
            Phone number
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-border bg-slate-50 px-4 py-3 focus-within:border-brand-500 focus-within:bg-white">
              <span className="text-sm text-muted-foreground">+91</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={form.phone}
                onChange={(e) =>
                  update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="10-digit mobile number"
                className="w-full bg-transparent text-base outline-none placeholder:text-slate-400"
                aria-label="Phone number"
              />
            </div>
          </label>
          <p className="rounded-2xl bg-brand-50 px-4 py-3 text-xs text-brand-900">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
            Your phone is used only for application updates and never shared
            with customers without your consent.
          </p>
        </div>
      )}

      {/* Step 2 — Personal */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">About you</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You must be 18 or older.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-950">
              Full name
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value.slice(0, 120))}
                placeholder="As on your Aadhaar / DL"
                autoComplete="name"
                className="mt-1.5 w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-base outline-none focus:border-brand-500 focus:bg-white"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-950">
              Date of birth
              <input
                type="date"
                value={form.dob}
                onChange={(e) => update("dob", e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-1.5 w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-base outline-none focus:border-brand-500 focus:bg-white"
              />
            </label>
          </div>
          <fieldset>
            <legend className="block text-sm font-semibold text-slate-950">
              Gender (optional)
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(["male", "female", "other"] as const).map((g) => (
                <label
                  key={g}
                  className={`cursor-pointer rounded-full border px-4 py-2 text-sm capitalize transition ${
                    form.gender === g
                      ? "border-brand-300 bg-brand-50 text-brand-900"
                      : "border-border bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={form.gender === g}
                    onChange={() => update("gender", g)}
                    className="sr-only"
                  />
                  {g}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold text-slate-950">
            Current address
            <textarea
              value={form.currentAddress}
              onChange={(e) =>
                update("currentAddress", e.target.value.slice(0, 400))
              }
              rows={3}
              placeholder="House / street / area / pincode"
              className="mt-1.5 w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-base outline-none focus:border-brand-500 focus:bg-white"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-950">
              Emergency contact name (optional)
              <input
                type="text"
                value={form.emergencyContactName}
                onChange={(e) =>
                  update("emergencyContactName", e.target.value.slice(0, 120))
                }
                placeholder="Family member / friend"
                className="mt-1.5 w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-base outline-none focus:border-brand-500 focus:bg-white"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-950">
              Emergency contact phone (optional)
              <input
                type="tel"
                inputMode="tel"
                value={form.emergencyContactPhone}
                onChange={(e) =>
                  update(
                    "emergencyContactPhone",
                    e.target.value.replace(/\D/g, "").slice(0, 13),
                  )
                }
                className="mt-1.5 w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-base outline-none focus:border-brand-500 focus:bg-white"
              />
            </label>
          </div>
        </div>
      )}

      {/* Step 3 — Vehicle + docs */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Vehicle & documents
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Photos from your phone work fine. Max 4 MB per file.
            </p>
          </div>
          <fieldset>
            <legend className="block text-sm font-semibold text-slate-950">
              Vehicle type
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {VEHICLE_TYPES.map((vt) => (
                <label
                  key={vt}
                  className={`cursor-pointer rounded-full border px-4 py-2 text-sm capitalize transition ${
                    form.vehicleType === vt
                      ? "border-brand-300 bg-brand-50 text-brand-900"
                      : "border-border bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="vehicleType"
                    value={vt}
                    checked={form.vehicleType === vt}
                    onChange={() => update("vehicleType", vt)}
                    className="sr-only"
                  />
                  {vt}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-950">
              Vehicle number
              <input
                type="text"
                value={form.vehicleNumber}
                onChange={(e) =>
                  update("vehicleNumber", e.target.value.toUpperCase().slice(0, 20))
                }
                placeholder="UP-75-AB-1234"
                className="mt-1.5 w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-base uppercase outline-none focus:border-brand-500 focus:bg-white"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-950">
              Last 4 digits of Aadhaar
              <input
                type="text"
                inputMode="numeric"
                value={form.aadhaarLast4}
                onChange={(e) =>
                  update("aadhaarLast4", e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="0000"
                maxLength={4}
                className="mt-1.5 w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-base outline-none focus:border-brand-500 focus:bg-white"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(DOC_LABELS) as RiderAppDocKind[]).map((kind) => {
              const meta = DOC_LABELS[kind];
              const f = files[kind];
              const err = fileErrors[kind];
              return (
                <label
                  key={kind}
                  className={`flex cursor-pointer flex-col gap-2 rounded-2xl border-2 border-dashed p-4 text-sm transition ${
                    f
                      ? "border-emerald-300 bg-emerald-50"
                      : err
                        ? "border-rose-300 bg-rose-50"
                        : "border-border bg-slate-50 hover:bg-white"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-950">
                      {meta.label}
                      {meta.required && (
                        <span className="ml-1 text-rose-600" aria-label="required">
                          *
                        </span>
                      )}
                    </span>
                    {f ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden />
                    ) : (
                      <Upload className="h-4 w-4 text-slate-500" aria-hidden />
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {f ? `${f.name} (${bytes(f.size)})` : meta.hint}
                  </span>
                  {err && (
                    <span role="alert" className="text-xs text-rose-700">
                      {err}
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    capture="environment"
                    onChange={(e) =>
                      handleFile(kind, e.target.files?.[0] ?? null)
                    }
                    className="sr-only"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4 — Payouts + availability */}
      {step === 4 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Payouts & schedule
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We pay out weekly via UPI. You can change these later.
            </p>
          </div>
          <label className="block text-sm font-semibold text-slate-950">
            UPI ID (optional now, required to receive payouts)
            <input
              type="text"
              value={form.upiId}
              onChange={(e) => update("upiId", e.target.value.slice(0, 60))}
              placeholder="yourname@okhdfc"
              autoComplete="off"
              className="mt-1.5 w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-base outline-none focus:border-brand-500 focus:bg-white"
            />
          </label>
          <fieldset>
            <legend className="block text-sm font-semibold text-slate-950">
              Availability
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {AVAILABILITY_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition ${
                    form.availability === opt
                      ? "border-brand-300 bg-brand-50 text-brand-900"
                      : "border-border bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="availability"
                    value={opt}
                    checked={form.availability === opt}
                    onChange={() => update("availability", opt)}
                    className="sr-only"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="block text-sm font-semibold text-slate-950">
              Preferred shift
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PREFERRED_SHIFTS.map((opt) => (
                <label
                  key={opt}
                  className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition ${
                    form.preferredShift === opt
                      ? "border-brand-300 bg-brand-50 text-brand-900"
                      : "border-border bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="preferredShift"
                    value={opt}
                    checked={form.preferredShift === opt}
                    onChange={() => update("preferredShift", opt)}
                    className="sr-only"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-950">
              Hours per week (estimate)
              <input
                type="number"
                inputMode="numeric"
                value={form.hoursPerWeek}
                onChange={(e) => update("hoursPerWeek", e.target.value)}
                min={0}
                max={70}
                step={1}
                placeholder="e.g. 30"
                className="mt-1.5 w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-base outline-none focus:border-brand-500 focus:bg-white"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-950">
              How did you hear about us?
              <select
                value={form.source}
                onChange={(e) => update("source", e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-base outline-none focus:border-brand-500 focus:bg-white"
              >
                <option value="">Select…</option>
                {RIDER_APP_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-700"
            />
            <span className="leading-snug text-slate-700">
              I confirm the information above is correct, I have a valid licence
              and vehicle papers, and I agree to Dawasarthi&apos;s{" "}
              <Link href="/terms" className="font-semibold text-brand-700 underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy-policy"
                className="font-semibold text-brand-700 underline"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {fieldError && (
            <p role="alert" className="text-sm text-rose-700">
              {fieldError.text}
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
        <button
          type="button"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1 || submitting}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => ((s + 1) as Step))}
            disabled={!stepValid}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            Next
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!stepValid || submitting}
            className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            aria-busy={submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        )}
      </div>
    </div>
  );
}
