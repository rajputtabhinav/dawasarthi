import { revalidatePath } from "next/cache";

declare global {
  var __isaCatalogCache:
    | { value: string; expiresAt: number }
    | null
    | undefined;
}

/**
 * Invalidate every place the medicine catalogue is cached. Call after any
 * admin mutation (create / update / delete).
 */
export function invalidateMedicineCatalog(): void {
  globalThis.__isaCatalogCache = null;
  try {
    revalidatePath("/medicines");
    revalidatePath("/medicines/[slug]", "page");
    revalidatePath("/sitemap.xml");
    revalidatePath("/");
  } catch {
    /* revalidatePath is a no-op outside the App Router server runtime */
  }
}
