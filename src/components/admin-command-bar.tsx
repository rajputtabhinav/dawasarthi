"use client";

import {
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bike,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  Package,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";

/**
 * Admin command bar (⌘K / Ctrl+K).
 *
 * Globally-mounted modal that opens on the keyboard shortcut, gives one
 * search box that hits /api/admin/search, and lets the admin jump to any
 * order, medicine, or admin page with a single keystroke.
 *
 * Mounted via the admin layout so it's available on every admin route. The
 * portal target (document.body) means the modal escapes the layout's
 * container width.
 */

type OrderHit = {
  id: string;
  customer: string;
  status: string;
  phone: string | null;
  total: string | null;
  placedAt: string | null;
};

type MedicineHit = {
  id: string;
  slug: string;
  name: string;
  category: string;
  stockOnHand: number | null;
};

type NavItem = {
  kind: "nav";
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: React.ElementType;
};

type Item =
  | NavItem
  | { kind: "order"; data: OrderHit }
  | { kind: "medicine"; data: MedicineHit };

const NAV_ITEMS: NavItem[] = [
  {
    kind: "nav",
    id: "nav:dashboard",
    label: "Dashboard",
    hint: "Operations overview",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    kind: "nav",
    id: "nav:orders",
    label: "Orders",
    hint: "All customer orders",
    href: "/admin/orders",
    icon: ShoppingBag,
  },
  {
    kind: "nav",
    id: "nav:medicines",
    label: "Medicines",
    hint: "Manage catalogue + stock",
    href: "/admin/medicines",
    icon: Activity,
  },
  {
    kind: "nav",
    id: "nav:prescriptions",
    label: "Prescriptions",
    hint: "Customer uploads",
    href: "/admin/prescriptions",
    icon: ClipboardList,
  },
  {
    kind: "nav",
    id: "nav:riders",
    label: "Riders",
    hint: "Applications + active riders",
    href: "/admin/riders/applications",
    icon: Bike,
  },
  {
    kind: "nav",
    id: "nav:users",
    label: "Users",
    hint: "Customer accounts",
    href: "/admin/users",
    icon: Users,
  },
];

export function AdminCommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<OrderHit[]>([]);
  const [medicines, setMedicines] = useState<MedicineHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Mount portal only after hydration (avoids SSR/CSR mismatch). */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── Open/close keyboard handler — installed on the window once ──────── */
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const isModK =
        (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (isModK) {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("dawasarthi:cmdk-open", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dawasarthi:cmdk-open", onOpenEvent);
    };
  }, [open]);

  /* ── Reset state and focus input when opening ────────────────────────── */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setOrders([]);
    setMedicines([]);
    setActive(0);
    // Wait one tick for the modal to mount before focusing.
    const handle = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(handle);
  }, [open]);

  /* ── Debounced search (200ms) ────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setOrders([]);
      setMedicines([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) {
            setOrders([]);
            setMedicines([]);
          }
          return;
        }
        const data = (await res.json()) as {
          orders?: OrderHit[];
          medicines?: MedicineHit[];
        };
        if (cancelled) return;
        setOrders(data.orders ?? []);
        setMedicines(data.medicines ?? []);
        setActive(0);
      } catch {
        if (!cancelled) {
          setOrders([]);
          setMedicines([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, open]);

  /* ── Build the flat ordered list of items (for keyboard nav) ─────────── */
  const items: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filteredNav =
      q.length === 0
        ? NAV_ITEMS
        : NAV_ITEMS.filter(
            (n) =>
              n.label.toLowerCase().includes(q) ||
              n.hint.toLowerCase().includes(q),
          );
    return [
      ...filteredNav,
      ...orders.map((o): Item => ({ kind: "order", data: o })),
      ...medicines.map((m): Item => ({ kind: "medicine", data: m })),
    ];
  }, [query, orders, medicines]);

  const navigateTo = useCallback(
    (item: Item) => {
      let href: string;
      if (item.kind === "nav") href = item.href;
      else if (item.kind === "order") href = `/admin/orders?focus=${item.data.id}`;
      else href = `/medicines/${item.data.slug}`;
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  function onInputKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) navigateTo(item);
    }
  }

  if (!mounted) return null;
  if (!open) return null;

  const showNav =
    query.trim().length === 0 ||
    items.some((i) => i.kind === "nav");
  const navResults = items.filter((i): i is NavItem => i.kind === "nav");
  const orderResults = items.filter(
    (i): i is { kind: "order"; data: OrderHit } => i.kind === "order",
  );
  const medicineResults = items.filter(
    (i): i is { kind: "medicine"; data: MedicineHit } => i.kind === "medicine",
  );

  const allResults: Item[] = [...navResults, ...orderResults, ...medicineResults];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Admin command palette"
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 px-3 pt-[10vh] backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search
            className="h-4 w-4 shrink-0 text-slate-400"
            aria-hidden
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search orders, medicines, or jump to a page…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            aria-label="Search admin"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {loading && (
            <Loader2
              className="h-4 w-4 shrink-0 animate-spin text-slate-400"
              aria-hidden
            />
          )}
          <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 sm:inline">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {showNav && navResults.length > 0 && (
            <Group label="Pages">
              {navResults.map((n) => {
                const idx = allResults.indexOf(n);
                const Icon = n.icon;
                return (
                  <Row
                    key={n.id}
                    active={idx === active}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => navigateTo(n)}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-950">
                        {n.label}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {n.hint}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Page
                    </span>
                  </Row>
                );
              })}
            </Group>
          )}

          {orderResults.length > 0 && (
            <Group label="Orders">
              {orderResults.map((o) => {
                const idx = allResults.indexOf(o);
                return (
                  <Row
                    key={o.data.id}
                    active={idx === active}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => navigateTo(o)}
                  >
                    <ShoppingBag
                      className="h-4 w-4 shrink-0 text-brand-700"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-950">
                        {o.data.id}{" "}
                        <span className="font-normal text-slate-500">
                          · {o.data.customer}
                        </span>
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {o.data.status}
                        {o.data.phone ? ` · ${o.data.phone}` : ""}
                        {o.data.placedAt ? ` · ${o.data.placedAt}` : ""}
                      </p>
                    </div>
                    {o.data.total && (
                      <span className="shrink-0 text-xs font-semibold text-slate-700">
                        {o.data.total}
                      </span>
                    )}
                  </Row>
                );
              })}
            </Group>
          )}

          {medicineResults.length > 0 && (
            <Group label="Medicines">
              {medicineResults.map((m) => {
                const idx = allResults.indexOf(m);
                const stock = m.data.stockOnHand;
                return (
                  <Row
                    key={m.data.id}
                    active={idx === active}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => navigateTo(m)}
                  >
                    <Package
                      className="h-4 w-4 shrink-0 text-emerald-700"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-950">
                        {m.data.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {m.data.category}
                        {typeof stock === "number"
                          ? ` · ${stock === 0 ? "Out of stock" : `${stock} in stock`}`
                          : ""}
                      </p>
                    </div>
                  </Row>
                );
              })}
            </Group>
          )}

          {/* Empty state — only after the user has typed something */}
          {query.trim().length >= 2 &&
            !loading &&
            orderResults.length === 0 &&
            medicineResults.length === 0 &&
            navResults.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No results for &ldquo;
                <span className="font-semibold text-slate-700">
                  {query.trim()}
                </span>
                &rdquo;
              </p>
            )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-[9px] font-semibold">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-[9px] font-semibold">
                ↵
              </kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-[9px] font-semibold">
                esc
              </kbd>
              close
            </span>
          </div>
          <span className="hidden sm:inline">Admin · Dawasarthi</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Small presentational helpers ──────────────────────────────────────── */

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-2 py-1">
      <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Row({
  active,
  onMouseEnter,
  onClick,
  children,
}: {
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
        active ? "bg-slate-100" : "bg-transparent"
      }`}
    >
      {children}
    </button>
  );
}
