import clsx from "clsx";

export function cn(...values: Array<string | undefined | false | null>) {
  return clsx(values);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
