/** Stable slug from catalogue category label (for keys / asset paths). */
export function slugifyCategoryLabel(cat: string): string {
  return cat
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "category";
}
