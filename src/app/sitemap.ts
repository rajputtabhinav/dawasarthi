import type { MetadataRoute } from "next";
import { listMedicineSitemapEntries } from "@/lib/server-medicines";

function origin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://dawasarthi.com";
}

// Build-time constant — only changes when the static page text changes.
const STATIC_LAST_MODIFIED = new Date(
  process.env.VERCEL_GIT_COMMIT_AUTHOR_DATE ??
    process.env.SOURCE_DATE_EPOCH ??
    Date.now(),
);

const STATIC_PATHS = [
  { path: "", priority: 1 },
  { path: "medicines", priority: 0.9 },
  { path: "upload-prescription", priority: 0.7 },
  { path: "join-as-rider", priority: 0.7 },
  { path: "faq", priority: 0.6 },
  { path: "privacy-policy", priority: 0.4 },
  { path: "refund-policy", priority: 0.4 },
  { path: "terms", priority: 0.4 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = origin();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map(
    ({ path, priority }) => ({
      url: path ? `${site}/${path}` : `${site}/`,
      lastModified: STATIC_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority,
    }),
  );

  let medicineEntries: MetadataRoute.Sitemap = [];
  try {
    const meds = await listMedicineSitemapEntries();
    medicineEntries = meds.map((m) => ({
      url: `${site}/medicines/${m.slug}`,
      lastModified: m.updatedAt ?? STATIC_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    /* skip on DB outage */
  }

  return [...staticEntries, ...medicineEntries];
}
