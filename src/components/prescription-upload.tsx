"use client";

import { ChangeEvent, DragEvent, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { FileImage, FileText, Loader2, UploadCloud, X } from "lucide-react";
import {
  AnimatePresence,
  MotionHover,
  MotionItem,
  MotionStagger,
  motion,
} from "@/components/motion-primitives";

type PreviewFile = {
  name: string;
  type: string;
  preview?: string;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function PrescriptionUpload() {
  const { isLoaded, isSignedIn } = useUser();
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleFile = (file: File) => {
    setIsSubmitted(false);
    setSubmitError("");

    if (!ALLOWED_TYPES.has(file.type)) {
      setSubmitError("Only PDF, JPG, PNG, or WebP files are supported.");
      setRawFile(null);
      setPreviewFile(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setSubmitError("File is larger than 5 MB. Please upload a smaller file.");
      setRawFile(null);
      setPreviewFile(null);
      return;
    }

    setRawFile(file);
    if (file.type === "application/pdf") {
      setPreviewFile({ name: file.name, type: file.type });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewFile({
        name: file.name,
        type: file.type,
        preview: typeof reader.result === "string" ? reader.result : undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!rawFile) return;
    if (!isSignedIn) {
      setSubmitError("Please sign in to upload a prescription.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const formData = new FormData();
      formData.append("prescription", rawFile);
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed. Please try again.");
      }
      setIsSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Upload failed. Please try again or call us at +91 9354360049.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <MotionStagger className="mb-4 grid gap-3 sm:grid-cols-3">
          {[
            "Upload prescription",
            "Team verifies medicines",
            "Receive call and confirm order",
          ].map((step, index) => (
            <MotionItem key={step}>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                  Step {index + 1}
                </p>
                <p className="mt-2 font-medium text-slate-900">{step}</p>
              </div>
            </MotionItem>
          ))}
        </MotionStagger>
        <motion.label
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex min-h-80 cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed px-6 py-10 text-center transition ${
            isDragging
              ? "border-brand-500 bg-brand-50"
              : "border-border bg-slate-50"
          }`}
          animate={isDragging ? { scale: 1.01 } : { scale: 1 }}
        >
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleChange}
          />
          <div className="inline-flex rounded-full bg-white p-4 text-brand-700 shadow-card">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-slate-950">
            Drag and drop prescription here
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Upload a clear image or PDF. JPG, PNG, and PDF files are supported.
          </p>
          <MotionHover className="mt-5">
            <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
              Choose file
            </span>
          </MotionHover>
        </motion.label>
      </div>

      <motion.div
        initial={{ opacity: 0, x: 18 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        className="rounded-[1.75rem] bg-slate-50 p-5"
      >
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-slate-950">Preview</p>
          {previewFile ? (
            <button
              onClick={() => setPreviewFile(null)}
              className="rounded-full bg-white p-2 text-slate-600"
              aria-label="Clear uploaded file"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {previewFile ? (
            <motion.div
              key={previewFile.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-5 space-y-4"
            >
              <div className="rounded-3xl border border-border bg-white p-4">
                {previewFile.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewFile.preview}
                    alt={previewFile.name}
                    className="h-56 w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <FileText className="h-10 w-10" />
                  </div>
                )}
                <div className="mt-4 flex items-center gap-3">
                  <div className="rounded-full bg-brand-50 p-3 text-brand-700">
                    {previewFile.type === "application/pdf" ? (
                      <FileText className="h-5 w-5" />
                    ) : (
                      <FileImage className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950">{previewFile.name}</p>
                    <p className="text-sm text-muted-foreground">Ready for upload</p>
                  </div>
                </div>
              </div>
              <MotionHover>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || isSubmitted || (isLoaded && !isSignedIn)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting
                    ? "Uploading…"
                    : isSubmitted
                      ? "Submitted"
                      : isLoaded && !isSignedIn
                        ? "Sign in to upload"
                        : "Submit prescription"}
                </button>
              </MotionHover>
              <AnimatePresence>
                {isSubmitted && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800"
                  >
                    Prescription submitted successfully. Our team will call you
                    shortly to help complete the order.
                  </motion.div>
                )}
                {submitError && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700"
                  >
                    {submitError}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="empty-preview"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-5 rounded-3xl border border-border bg-white p-6 text-sm leading-6 text-muted-foreground"
            >
              Once uploaded, our team can verify the prescription and help match
              the required medicines before dispatch.
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
