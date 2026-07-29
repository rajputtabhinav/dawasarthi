import type { MetadataRoute } from "next";

function origin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://dawasarthi.com";
}

export default function robots(): MetadataRoute.Robots {
  const site = origin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/medicines", "/medicines/", "/upload-prescription", "/join-as-rider", "/faq", "/privacy-policy", "/refund-policy", "/terms"],
        disallow: [
          "/admin",
          "/api",
          "/account",
          "/checkout",
          "/cart",
          "/track-order",
          "/sign-in",
          "/sign-up",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
