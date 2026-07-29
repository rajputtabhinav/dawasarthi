import type { Medicine } from "@/lib/types";
import { resolveCheckoutCoupon } from "@/lib/coupons";
import { formatCurrency } from "@/lib/utils";

const MIN_QTY = 1;
const MAX_QTY = 999;

function catalogMaps(catalogue: Medicine[]): {
  byId: Map<string, Medicine>;
  /** First catalogue row wins if duplicate names exist */
  byName: Map<string, Medicine>;
} {
  const byId = new Map<string, Medicine>();
  const byName = new Map<string, Medicine>();

  for (const m of catalogue) {
    byId.set(m.id, m);
    if (!byName.has(m.name)) {
      byName.set(m.name, m);
    }
  }

  return { byId, byName };
}

function resolveMedicineForLine(
  row: Record<string, unknown>,
  byId: Map<string, Medicine>,
  byName: Map<string, Medicine>,
): Medicine {
  const medicineIdRaw =
    row.medicineId != null ? String(row.medicineId).trim() : "";

  if (medicineIdRaw) {
    const med = byId.get(medicineIdRaw);
    if (!med) {
      throw new Error(
        "One or more items are not available for checkout. Refresh your cart and try again.",
      );
    }
    return med;
  }

  const name = String(row.name ?? "").trim();
  if (!name) {
    throw new Error("Invalid cart item.");
  }

  const med = byName.get(name);
  if (!med) {
    throw new Error(
      "Cart could not be verified against our catalogue. Refresh your cart and try again.",
    );
  }

  return med;
}

export type PricedLine = {
  medicineId: string;
  name: string;
  quantity: number;
  price: string;
};

const MAX_LINES = 50;

/**
 * Recomputes line items and subtotal from the trusted catalogue (Postgres-backed).
 * Aggregates duplicate medicine IDs (the same medicine on multiple rows is summed
 * and bounded once) so a malicious client cannot spam rows to bypass MAX_QTY.
 * Accepts legacy payloads with `{ name, quantity }` or preferred `{ medicineId, quantity }`.
 */
export function priceOrderLinesFromCatalog(
  lines: unknown,
  catalogue: Medicine[],
): {
  items: PricedLine[];
  subtotal: number;
  requiresPrescription: boolean;
} {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("Cart cannot be empty.");
  }
  if (lines.length > MAX_LINES) {
    throw new Error("Cart has too many items.");
  }

  const { byId, byName } = catalogMaps(catalogue);

  // Aggregate by medicine.id so duplicates cannot bypass MAX_QTY.
  const aggregated = new Map<string, { med: Medicine; quantity: number }>();

  for (const row of lines) {
    if (!row || typeof row !== "object") {
      throw new Error("Invalid cart item.");
    }
    const r = row as Record<string, unknown>;
    const med = resolveMedicineForLine(r, byId, byName);
    const qty = Math.floor(Number(r.quantity) || MIN_QTY);
    if (!Number.isFinite(qty) || qty < MIN_QTY) {
      throw new Error("Invalid item quantity.");
    }
    const existing = aggregated.get(med.id);
    if (existing) {
      existing.quantity += qty;
    } else {
      aggregated.set(med.id, { med, quantity: qty });
    }
  }

  const items: PricedLine[] = [];
  let subtotal = 0;
  let requiresPrescription = false;

  for (const { med, quantity } of aggregated.values()) {
    const boundedQty = Math.min(MAX_QTY, Math.max(MIN_QTY, quantity));
    const lineAmount = med.price * boundedQty;
    subtotal += lineAmount;
    if (med.requiresPrescription) requiresPrescription = true;
    items.push({
      medicineId: med.id,
      name: med.name,
      quantity: boundedQty,
      price: formatCurrency(lineAmount),
    });
  }

  return { items, subtotal, requiresPrescription };
}

export function validateCheckoutShipment(payload: Record<string, unknown>): {
  customer: string;
  phone: string;
  address: string;
  city: string;
} {
  const customer = String(payload.customer ?? "").trim().slice(0, 120);
  const address = String(payload.address ?? "").trim().slice(0, 500);
  const city = String(payload.city ?? "").trim().slice(0, 120);
  const rawPhone = String(payload.phone ?? "").trim();
  const digits = rawPhone.replace(/\D/g, "");

  if (customer.length < 2) {
    throw new Error("Please enter your name.");
  }
  if (digits.length < 10 || digits.length > 15) {
    throw new Error("Please enter a valid phone number.");
  }
  if (address.length < 10) {
    throw new Error("Please enter a complete delivery address.");
  }

  return {
    customer,
    phone: digits,
    address,
    city,
  };
}

/** Applies catalogue pricing + coupon rules; returns total formatted string */
export function buildTrustedTotals(
  itemsUnknown: unknown,
  couponUnknown: unknown,
  catalogue: Medicine[],
) {
  const { items, subtotal, requiresPrescription } = priceOrderLinesFromCatalog(
    itemsUnknown,
    catalogue,
  );
  const couponResult = resolveCheckoutCoupon(couponUnknown, subtotal);
  const finalTotal = Math.max(0, subtotal - couponResult.discount);

  return {
    items,
    subtotal,
    requiresPrescription,
    couponDiscount: couponResult.discount,
    couponCode: couponResult.normalizedCode,
    totalFormatted: formatCurrency(finalTotal),
  };
}
