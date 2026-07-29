"use client";

import { useCallback, useEffect, useState } from "react";
import type { Medicine } from "@/lib/types";

export function useMedicinesCatalog() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // `full=1` returns admin-shape rows (including image data URLs and
      // description). Server-side it requires admin auth and returns 403 to
      // non-admin callers — currently only the admin medicines page uses this
      // hook, so requesting `full=1` is appropriate.
      const res = await fetch("/api/medicines?full=1&limit=200", {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        medicines?: Medicine[];
        count?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load catalogue.");
      }
      const list = Array.isArray(data.medicines) ? data.medicines : [];
      setMedicines(list);
      setCount(typeof data.count === "number" ? data.count : list.length);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load catalogue.");
      setMedicines([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { medicines, count, loading, error, refresh };
}
