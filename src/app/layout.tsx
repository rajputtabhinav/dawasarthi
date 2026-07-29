import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { MotionProvider } from "@/components/motion-primitives";
import { CartProvider } from "@/components/providers/cart-provider";
import { IsaChatbot } from "@/components/isa-chatbot";
import { SUPPORT_EMAIL_CARE, SUPPORT_EMAIL_PHARMACY } from "@/lib/support-contact";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/** Canonical origin for metadata — always HTTPS outside localhost so embeds/iframes (e.g. Clerk) never use http://. */
function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");

  let candidate: string | null = null;

  if (raw) {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      candidate = raw;
    } else {
      candidate = `https://${raw}`;
    }
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (!candidate && vercelHost) {
    candidate = `https://${vercelHost}`;
  }

  if (!candidate) {
    return "https://dawasarthi.com";
  }

  try {
    const url = new URL(candidate);

    const isLoopback =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".local");

    // Upgrade http→https everywhere except local dev (avoids Clerk / iframe mixed-origin blocks).
    if (url.protocol === "http:" && !isLoopback) {
      url.protocol = "https:";
    }

    return url.origin;
  } catch {
    return "https://dawasarthi.com";
  }
}

const SITE_URL = siteOrigin();
const CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dawasarthi | 30 Min Medicine Delivery in Dibiyapur",
    template: "%s | Dawasarthi",
  },
  description:
    "30-minute medicine delivery in Dibiyapur. Prescription upload, Cash on Delivery, and 24x7 support.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Dawasarthi",
    title: "Dawasarthi | 30 Min Medicine Delivery in Dibiyapur",
    description:
      "30-minute medicine delivery in Dibiyapur. Prescription upload, Cash on Delivery, and 24x7 support.",
    images: [{ url: "/marketing/logo.png", width: 512, height: 512, alt: "Dawasarthi" }],
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dawasarthi | 30 Min Medicine Delivery in Dibiyapur",
    description:
      "30-minute medicine delivery in Dibiyapur. Prescription upload, Cash on Delivery, and 24x7 support.",
    images: ["/marketing/logo.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/marketing/logo.png", type: "image/png" }],
    shortcut: "/marketing/logo.png",
    apple: [{ url: "/marketing/logo.png", sizes: "180x180", type: "image/png" }],
  },
};

/** Lets fixed UI use env(safe-area-inset-*) so the chat launcher clears home indicators and rounded corners. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#org`,
      name: "Dawasarthi",
      url: SITE_URL,
      logo: `${SITE_URL}/marketing/logo.png`,
      email: [SUPPORT_EMAIL_PHARMACY, SUPPORT_EMAIL_CARE],
      telephone: "+91-9354360049",
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL,
      name: "Dawasarthi",
      publisher: { "@id": `${SITE_URL}#org` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/medicines?query={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "MedicalBusiness",
      "@id": `${SITE_URL}#business`,
      name: "Dawasarthi",
      url: SITE_URL,
      description: "30-minute medicine delivery in Dibiyapur.",
      areaServed: "Dibiyapur, Uttar Pradesh",
      telephone: "+91-9354360049",
      email: [SUPPORT_EMAIL_PHARMACY, SUPPORT_EMAIL_CARE],
      availableLanguage: ["English", "Hindi"],
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <ClerkProvider
      nonce={nonce}
      publishableKey={CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/account"
      signUpFallbackRedirectUrl="/account"
      afterSignOutUrl="/"
    >
      <html
        lang="en"
        className={`${manrope.variable} ${plexMono.variable} h-full antialiased`}
      >
        <body className="min-h-full bg-background text-foreground">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-full focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
          >
            Skip to main content
          </a>
          <MotionProvider>
            <CartProvider>
              {children}
              <IsaChatbot />
            </CartProvider>
          </MotionProvider>
          {/*
            Vercel observability — both auto-disable in dev and on non-Vercel
            hosts, so they're safe to leave mounted unconditionally.
            • Analytics: page-view + custom-event tracking (no PII).
            • SpeedInsights: real-user CWV (LCP / INP / CLS) for prod.
          */}
          <Analytics />
          <SpeedInsights />
          <script
            type="application/ld+json"
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
