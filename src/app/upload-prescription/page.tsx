import type { Metadata } from "next";
import { PrescriptionUpload } from "@/components/prescription-upload";
import { MotionSection } from "@/components/motion-primitives";
import { SectionHeading } from "@/components/section-heading";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Upload Prescription",
  description:
    "Upload your prescription on Dawasarthi. Our team verifies and matches your medicines for 30-minute delivery in Dibiyapur.",
  alternates: { canonical: "/upload-prescription" },
  openGraph: {
    title: "Upload Prescription — Dawasarthi",
    description:
      "Upload prescription for verified medicines, 30-minute delivery, and Cash on Delivery.",
    type: "website",
  },
};

export default function UploadPrescriptionPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <MotionSection>
          <SectionHeading
            eyebrow="Prescription support"
            title="Upload a prescription and let our team help with the order"
            description="The flow is intentionally simple for users on mobile devices: drag-and-drop when available, or tap to select an image or PDF."
          />
        </MotionSection>

        <MotionSection className="rounded-[2rem] border border-border bg-white p-6 shadow-card sm:p-8">
          <PrescriptionUpload />
        </MotionSection>
      </main>
      <SiteFooter />
    </div>
  );
}
