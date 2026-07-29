"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { Medicine } from "@/lib/types";

type CartItem = Medicine & {
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  totalSavings: number;
  isHydrated: boolean;
  addItem: (medicine: Medicine) => void;
  updateQuantity: (medicineId: string, quantity: number) => void;
  removeItem: (medicineId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "dawasarthi-cart";
const MAX_QTY = 999;

function isValidCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.price === "number" &&
    Number.isFinite(v.price) &&
    typeof v.mrp === "number" &&
    Number.isFinite(v.mrp) &&
    typeof v.quantity === "number" &&
    Number.isFinite(v.quantity) &&
    v.quantity > 0
  );
}

function readPersistedCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidCartItem)
      .map((it) => ({ ...it, quantity: Math.min(MAX_QTY, it.quantity) }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Initialize empty to avoid hydration mismatch; populate from storage in an effect.
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const persisted = readPersistedCart();
    if (persisted.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from localStorage
      setItems(persisted);
    }
    setIsHydrated(true);

    // One-shot migration: drop legacy device-scoped order history that
    // could leak between users on a shared device.
    try {
      window.localStorage.removeItem("dawasarthi-orders");
      window.localStorage.removeItem("dawasarthi-users");
      window.localStorage.removeItem("dawasarthi-session");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota errors */
    }
  }, [items, isHydrated]);

  const addItem = useCallback((medicine: Medicine) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === medicine.id);
      if (existing) {
        return current.map((item) =>
          item.id === medicine.id
            ? { ...item, quantity: Math.min(MAX_QTY, item.quantity + 1) }
            : item,
        );
      }
      return [...current, { ...medicine, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback(
    (medicineId: string, quantity: number) => {
      const next = Math.min(MAX_QTY, Math.max(0, Math.floor(quantity)));
      setItems((current) =>
        current
          .map((item) =>
            item.id === medicineId ? { ...item, quantity: next } : item,
          )
          .filter((item) => item.quantity > 0),
      );
    },
    [],
  );

  const removeItem = useCallback((medicineId: string) => {
    setItems((current) => current.filter((item) => item.id !== medicineId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((count, item) => count + item.quantity, 0);
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const totalSavings = items.reduce(
      (sum, item) => sum + (item.mrp - item.price) * item.quantity,
      0,
    );

    return {
      items,
      itemCount,
      subtotal,
      totalSavings,
      isHydrated,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    };
  }, [items, isHydrated, addItem, updateQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}

export function AddToCartButton({
  medicine,
  className = "",
  compact = false,
  label = "Add to Cart",
}: {
  medicine: Medicine;
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  const { addItem } = useCart();

  return (
    <button
      onClick={() => addItem(medicine)}
      className={
        compact
          ? `inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-white transition hover:bg-brand-800 ${className}`
          : `inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-800 ${className}`
      }
      aria-label={compact ? `Add ${medicine.name} to cart` : undefined}
    >
      {compact ? <Plus className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
      {compact ? null : label}
    </button>
  );
}
