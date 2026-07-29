import type { NextConfig } from "next";
import path from "path";

/**
 * Static security headers. CSP is per-request (with a nonce) in src/proxy.ts.
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), serial=(), bluetooth=()",
  },
  // Cross-origin isolation defaults — keep COEP off (would break Clerk iframes),
  // but COOP/CORP provide good XS-Leaks mitigation.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  allowedDevOrigins: (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  experimental: {
    optimizePackageImports: ["lucide-react", "@clerk/nextjs", "framer-motion"],
  },
  images: {
    /** Hero carousel uses quality={95}; Next 16 defaults to [75] only */
    qualities: [75, 80, 85, 95],
  },
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  /** Browsers often request `/favicon.ico` even when `<link rel="icon">` uses PNG. */
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/marketing/logo.png" }];
  },
};

export default nextConfig;
