/** Client helpers for generating stable catalogue ids/slugs (Postgres is source of truth). */

export function generateMedicineId(): string {
  return `med-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
