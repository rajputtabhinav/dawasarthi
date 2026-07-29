"use client";

import { useEffect } from "react";

/**
 * Tiny client island that calls `window.print()` once after the DOM has
 * settled. Keeping it minimal means the rest of the print page can stay
 * a server component (no hydration cost for the slip layout itself).
 *
 * The 400ms delay gives the browser time to lay out and load the (tiny)
 * styles before the print dialog snapshot — without it, Chrome occasionally
 * prints a pre-styled flash.
 */
export function PrintTrigger() {
  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        /* user closed window before timer fired — harmless */
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, []);
  return null;
}
