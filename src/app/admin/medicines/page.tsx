"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ImageIcon,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { categoryTaxonomyHints } from "@/lib/data";
import { generateMedicineId, generateSlug } from "@/lib/medicines-store";
import type { Medicine } from "@/lib/types";
import { useMedicinesCatalog } from "@/lib/use-medicines-catalog";

const STOCK_OPTIONS = ["In stock", "Low stock", "Fast moving"] as const;
const ALL_CATEGORIES: string[] = [...categoryTaxonomyHints];

type FormState = {
  name: string;
  category: string;
  customCategory: string;
  manufacturer: string;
  packSize: string;
  price: string;
  mrp: string;
  stockStatus: string;
  stockOnHand: string;
  requiresPrescription: boolean;
  shortDescription: string;
  description: string;
  imagePreview: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  category: ALL_CATEGORIES[0],
  customCategory: "",
  manufacturer: "",
  packSize: "",
  price: "",
  mrp: "",
  stockStatus: "In stock",
  stockOnHand: "",
  requiresPrescription: false,
  shortDescription: "",
  description: "",
  imagePreview: "",
};

function medicineToForm(m: Medicine): FormState {
  const known = ALL_CATEGORIES.includes(m.category);
  return {
    name: m.name,
    category: known ? m.category : "__custom__",
    customCategory: known ? "" : m.category,
    manufacturer: m.manufacturer,
    packSize: m.packSize,
    price: String(m.price),
    mrp: String(m.mrp),
    stockStatus: m.stockStatus,
    stockOnHand:
      m.stockOnHand != null && Number.isFinite(m.stockOnHand)
        ? String(m.stockOnHand)
        : "",
    requiresPrescription: m.requiresPrescription,
    shortDescription: m.shortDescription,
    description: m.description,
    imagePreview: m.image,
  };
}

export default function AdminMedicinesPage() {
  const { medicines: catalogue, loading, refresh } = useMedicinesCatalog();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Medicine | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [saving, setSaving] = useState(false);
  /** When set, a confirmation modal is shown asking to delete this medicine. */
  const [deleteTarget, setDeleteTarget] = useState<Medicine | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryChips = useMemo(() => {
    const fromDb = Array.from(new Set(catalogue.map((m) => m.category))).sort();
    return ["All", ...fromDb];
  }, [catalogue]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalogue.filter((m) => {
      const catMatch = categoryFilter === "All" || m.category === categoryFilter;
      const searchMatch =
        q === "" ||
        m.name.toLowerCase().includes(q) ||
        m.manufacturer.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q);
      return catMatch && searchMatch;
    });
  }, [catalogue, search, categoryFilter]);

  /**
   * Render rows lazily — show 80 per "page" and grow on demand. Previously the
   * table hard-capped at 80 with no way to access the rest. Reset back to 80
   * whenever filters change so the user sees the top of their new query.
   */
  const PAGE_SIZE = 80;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, categoryFilter]);
  const visibleRows = filtered.slice(0, visibleCount);
  const canLoadMore = filtered.length > visibleCount;

  // ── Form handlers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(m: Medicine) {
    setEditTarget(m);
    setForm(medicineToForm(m));
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditTarget(null);
    setFormError("");
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFormError("Image must be under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        imagePreview: typeof reader.result === "string" ? reader.result : prev.imagePreview,
      }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    const price = Number(form.price);
    const mrp = Number(form.mrp);

    if (!form.name.trim()) {
      setSaving(false);
      return setFormError("Name is required.");
    }
    if (!form.manufacturer.trim()) {
      setSaving(false);
      return setFormError("Brand / manufacturer is required.");
    }
    if (!form.packSize.trim()) {
      setSaving(false);
      return setFormError("Pack size is required.");
    }
    if (!price || price <= 0) {
      setSaving(false);
      return setFormError("Enter a valid price.");
    }
    if (!mrp || mrp <= 0) {
      setSaving(false);
      return setFormError("Enter a valid MRP.");
    }
    if (price > mrp) {
      setSaving(false);
      return setFormError("Price cannot be more than MRP.");
    }

    const finalCategory =
      form.category === "__custom__"
        ? form.customCategory.trim() || "General"
        : form.category;

    const discount = Math.round(((mrp - price) / mrp) * 100);

    try {
      if (editTarget) {
        const res = await fetch(
          `/api/medicines/${encodeURIComponent(editTarget.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.name.trim(),
              slug: generateSlug(form.name.trim()),
              category: finalCategory,
              manufacturer: form.manufacturer.trim(),
              packSize: form.packSize.trim(),
              price,
              mrp,
              discount,
              stockStatus: form.stockStatus,
              stockOnHand: form.stockOnHand === "" ? null : Number(form.stockOnHand),
              requiresPrescription: form.requiresPrescription,
              shortDescription: form.shortDescription.trim(),
              description: form.description.trim() || form.shortDescription.trim(),
              image: form.imagePreview || editTarget.image,
            }),
          },
        );
        const data = (await res.json()) as { error?: string; errors?: string[] };
        if (!res.ok) {
          setFormError(
            typeof data.error === "string"
              ? data.error
              : data.errors?.join(", ") ?? "Save failed.",
          );
          return;
        }
      } else {
        const id = generateMedicineId();
        const slug = `${generateSlug(form.name.trim())}-${id.slice(-4)}`;
        const newMed: Medicine = {
          id,
          slug,
          name: form.name.trim(),
          category: finalCategory,
          manufacturer: form.manufacturer.trim(),
          packSize: form.packSize.trim(),
          price,
          mrp,
          discount,
          stockStatus: form.stockStatus,
          stockOnHand:
            form.stockOnHand === "" ? undefined : Number(form.stockOnHand),
          requiresPrescription: form.requiresPrescription,
          shortDescription: form.shortDescription.trim(),
          description: form.description.trim() || form.shortDescription.trim(),
          image: form.imagePreview || "/medicines/real-pack-1.png",
          rating: 4.5,
          reviewCount: 0,
          deliveryText: "Delivered in 30 mins",
        };

        const res = await fetch("/api/medicines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newMed),
        });
        const data = (await res.json()) as { error?: string; errors?: string[] };
        if (!res.ok) {
          setFormError(
            typeof data.error === "string"
              ? data.error
              : data.errors?.join(", ") ?? "Could not create medicine.",
          );
          return;
        }
      }

      await refresh();
      setSuccessMsg(editTarget ? "Medicine updated successfully." : "Medicine added successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
      closeForm();
    } catch {
      setFormError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  /** Perform the actual DELETE after the modal confirms. */
  async function confirmDelete(m: Medicine) {
    setDeletingId(m.id);
    try {
      const res = await fetch(`/api/medicines/${encodeURIComponent(m.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setSuccessMsg("");
        setFormError(typeof data.error === "string" ? data.error : "Delete failed.");
        return;
      }
      await refresh();
      setFormError("");
      setSuccessMsg("Medicine deleted.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setDeleteTarget(null);
    } catch {
      setFormError("Network error during delete.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const rxCount = catalogue.filter((m) => m.requiresPrescription).length;
  const lowStock = catalogue.filter((m) => m.stockStatus === "Low stock").length;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
            Medicines
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Catalogue Management
          </h1>
        </div>
        <button
          onClick={openAdd}
          className="flex w-fit items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          <Plus className="h-4 w-4" /> Add Medicine
        </button>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {successMsg}
        </div>
      )}

      {/* Stats */}
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        {[
          { label: "Total Medicines", value: catalogue.length, color: "bg-brand-50 text-brand-700" },
          { label: "Rx Required", value: rxCount, color: "bg-rose-50 text-rose-700" },
          { label: "Low Stock", value: lowStock, color: "bg-amber-50 text-amber-700" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className={`w-44 shrink-0 rounded-2xl border border-slate-200 p-4 ${color.split(" ")[0]}`}
          >
            <p className={`text-3xl font-bold ${color.split(" ")[1]}`}>{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, brand, category…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="shrink-0 text-xs text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          )}
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
          {categoryChips.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition ${
                categoryFilter === cat
                  ? "bg-brand-700 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-semibold text-slate-900">{visibleRows.length}</span>{" "}
        of {filtered.length} medicines
      </p>

      {/* Table — scroll left ↔ right */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          className="w-full overflow-x-auto rounded-2xl"
          style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "thin" }}
        >
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-16 px-4 py-3">Image</th>
                <th className="min-w-[180px] px-4 py-3">Name</th>
                <th className="min-w-[110px] px-4 py-3">Category</th>
                <th className="min-w-[110px] px-4 py-3">Brand</th>
                <th className="w-20 px-4 py-3">Price</th>
                <th className="w-20 px-4 py-3">MRP</th>
                <th className="w-24 px-4 py-3">Discount</th>
                <th className="min-w-[110px] px-4 py-3">Stock</th>
                <th className="w-16 px-4 py-3">Rx</th>
                <th className="min-w-[130px] px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-slate-50">
                        {m.image.startsWith("data:") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.image}
                            alt={m.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <Image
                            src={m.image}
                            alt={m.name}
                            fill
                            className="object-contain"
                          />
                        )}
                      </div>
                    </td>
                    <td className="max-w-[180px] px-4 py-3">
                      <p className="truncate font-semibold text-slate-900">{m.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{m.packSize}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        {m.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.manufacturer}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">₹{m.price}</td>
                    <td className="px-4 py-3 text-muted-foreground line-through">₹{m.mrp}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-emerald-600">{m.discount}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          m.stockStatus === "Low stock"
                            ? "bg-amber-100 text-amber-700"
                            : m.stockStatus === "Fast moving"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {m.stockStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.requiresPrescription ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          Rx
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">OTC</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(m)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(m)}
                          className="flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="font-semibold text-slate-900">No medicines found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search or category.
              </p>
            </div>
          )}

          {canLoadMore && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-muted-foreground">
              <span>
                Showing {visibleRows.length} of {filtered.length} results.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleCount(filtered.length)}
                  className="rounded-full bg-brand-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
                >
                  Show all
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Slide-over ──────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-slate-950/40"
            onClick={closeForm}
          />

          {/* Panel */}
          <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
                  {editTarget ? "Edit Medicine" : "Add New Medicine"}
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-950">
                  {editTarget ? editTarget.name : "New Medicine"}
                </h2>
              </div>
              <button
                onClick={closeForm}
                className="rounded-full border border-border p-2 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-6">
              {/* Image upload */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-950">
                  Product Image
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-slate-50">
                    {form.imagePreview ? (
                      form.imagePreview.startsWith("data:") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.imagePreview}
                          alt="Preview"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Image
                          src={form.imagePreview}
                          alt="Preview"
                          fill
                          className="object-contain"
                        />
                      )
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {form.imagePreview ? "Change Image" : "Upload Image"}
                    </button>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      JPG, PNG — max 2 MB. Shown on website.
                    </p>
                    {form.imagePreview && (
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, imagePreview: "" }))}
                        className="mt-1 text-xs text-rose-500 hover:text-rose-700"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-950">
                  Medicine Name <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Dolo 650 mg Tablet Strip of 10"
                  className="w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300 focus:bg-white"
                />
              </div>

              {/* Category */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-950">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300 focus:bg-white"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__custom__">Other (type below)</option>
                </select>
                {form.category === "__custom__" && (
                  <input
                    value={form.customCategory}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, customCategory: e.target.value }))
                    }
                    placeholder="Enter custom category name"
                    className="mt-2 w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300"
                  />
                )}
              </div>

              {/* Manufacturer */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-950">
                  Brand / Manufacturer <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.manufacturer}
                  onChange={(e) => setForm((p) => ({ ...p, manufacturer: e.target.value }))}
                  placeholder="e.g. Sun Pharma, Cipla, Abbott"
                  className="w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300 focus:bg-white"
                />
              </div>

              {/* Pack size */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-950">
                  Pack Size <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.packSize}
                  onChange={(e) => setForm((p) => ({ ...p, packSize: e.target.value }))}
                  placeholder="e.g. Strip of 10 Tablet, Bottle 200 ml"
                  className="w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300 focus:bg-white"
                />
              </div>

              {/* Price + MRP */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-950">
                    Selling Price ₹ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.price}
                    onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                    placeholder="45"
                    className="w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-950">
                    MRP ₹ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.mrp}
                    onChange={(e) => setForm((p) => ({ ...p, mrp: e.target.value }))}
                    placeholder="55"
                    className="w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300 focus:bg-white"
                  />
                </div>
              </div>

              {/* Discount preview */}
              {form.price && form.mrp && Number(form.mrp) > 0 && Number(form.price) <= Number(form.mrp) && (
                <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                  Discount:{" "}
                  <strong>
                    {Math.round(((Number(form.mrp) - Number(form.price)) / Number(form.mrp)) * 100)}% off
                  </strong>
                </div>
              )}

              {/* Stock status */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="stockStatus"
                    className="mb-1.5 block text-sm font-semibold text-slate-950"
                  >
                    Stock Status
                  </label>
                  <select
                    id="stockStatus"
                    value={form.stockStatus}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, stockStatus: e.target.value }))
                    }
                    className="w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300 focus:bg-white"
                  >
                    {STOCK_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="stockOnHand"
                    className="mb-1.5 block text-sm font-semibold text-slate-950"
                  >
                    Stock On Hand
                  </label>
                  <input
                    id="stockOnHand"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Leave empty for untracked"
                    value={form.stockOnHand}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, stockOnHand: e.target.value }))
                    }
                    className="w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300 focus:bg-white"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Integer units. Decremented atomically on each order. Empty = unlimited.
                  </p>
                </div>
              </div>

              {/* Prescription toggle */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Requires Prescription
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Customers must upload Rx before ordering
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      requiresPrescription: !p.requiresPrescription,
                    }))
                  }
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    form.requiresPrescription ? "bg-brand-700" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      form.requiresPrescription ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Short description */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-950">
                  Short Description
                </label>
                <input
                  value={form.shortDescription}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, shortDescription: e.target.value }))
                  }
                  placeholder="One-line product summary shown on cards"
                  className="w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300 focus:bg-white"
                />
              </div>

              {/* Full description */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-950">
                  Full Description
                </label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Detailed description shown on the product page"
                  className="w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-300 focus:bg-white"
                />
              </div>

              {/* Error */}
              {formError && (
                <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </p>
              )}

              {/* Submit */}
              <div className="flex gap-3 pb-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <Package className="h-4 w-4" />
                  {editTarget ? "Save Changes" : "Add to Catalogue"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-border px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation — matches the styled-modal pattern used by the
          cancel-order flow elsewhere in the app. */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-medicine-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            // Click outside the panel to dismiss (only when not mid-delete).
            if (e.target === e.currentTarget && !deletingId) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-rose-100 p-2 text-rose-700">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2
                  id="delete-medicine-title"
                  className="text-base font-bold text-slate-950"
                >
                  Delete {deleteTarget.name}?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This removes it from the catalogue permanently. Existing
                  orders that include it are not affected.
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId !== null}
                className="flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(deleteTarget)}
                disabled={deletingId !== null}
                className="flex-1 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-rose-400"
              >
                {deletingId === deleteTarget.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
