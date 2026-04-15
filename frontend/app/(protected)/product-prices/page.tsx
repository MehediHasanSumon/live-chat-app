"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { PencilLine, Plus, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Pagination } from "@/components/ui/pagination";
import { RadioInput } from "@/components/ui/radio-input";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import { useAdminProductUnitOptionsQuery } from "@/lib/hooks/use-admin-product-units";
import {
  AdminProductPriceRecord,
  useAdminProductPricesQuery,
  useCreateAdminProductPriceMutation,
  useDeleteAdminProductPriceMutation,
  useUpdateAdminProductPriceMutation,
} from "@/lib/hooks/use-admin-product-prices";
import { useAdminProductOptionsQuery } from "@/lib/hooks/use-admin-products";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const PER_PAGE_OPTIONS = [5, 10, 20, 30, 50];

type ProductPriceFormState = {
  product_id: string;
  product_unit_id: string;
  original_price: string;
  sell_price: string;
  date_time: string;
  is_active: boolean;
  note: string;
};

function createEmptyForm(): ProductPriceFormState {
  return {
    product_id: "",
    product_unit_id: "",
    original_price: "",
    sell_price: "",
    date_time: getCurrentDateLocal(),
    is_active: true,
    note: "",
  };
}

function getCurrentDateLocal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return now.toISOString().slice(0, 10);
}

function toDateLocal(value: string | null) {
  if (!value) {
    return getCurrentDateLocal();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return getCurrentDateLocal();
  }

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

  return date.toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPrice(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(numericValue);
}

function parsePageParam(value: string | null) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : DEFAULT_PAGE;
}

function parsePerPageParam(value: string | null) {
  const perPage = Number(value);

  return PER_PAGE_OPTIONS.includes(perPage) ? perPage : DEFAULT_PER_PAGE;
}

function parseSearchParam(value: string | null) {
  return (value ?? "").trim();
}

function ProductPricesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("per_page"));
  const search = parseSearchParam(searchParams.get("search"));
  const { data: productPricesResponse, isLoading, error } = useAdminProductPricesQuery({ page, perPage, search }, true);
  const { data: productOptions = [], isLoading: isProductsLoading } = useAdminProductOptionsQuery(true);
  const { data: unitOptions = [], isLoading: isUnitsLoading } = useAdminProductUnitOptionsQuery(true);
  const productPrices = productPricesResponse?.data ?? [];
  const paginationMeta = productPricesResponse?.meta;
  const createProductPrice = useCreateAdminProductPriceMutation();
  const updateProductPrice = useUpdateAdminProductPriceMutation();
  const deleteProductPrice = useDeleteAdminProductPriceMutation();
  const [searchDraft, setSearchDraft] = useState(search);
  const [form, setForm] = useState<ProductPriceFormState>(() => createEmptyForm());
  const [editingProductPrice, setEditingProductPrice] = useState<AdminProductPriceRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isProductPriceSectionOpen, setIsProductPriceSectionOpen] = useState(false);

  const isSubmitting = createProductPrice.isPending || updateProductPrice.isPending;
  const isTableBusy = deleteProductPrice.isPending;
  const isFormBusy = isSubmitting || isProductsLoading || isUnitsLoading;

  const updatePaginationUrl = useCallback(
    (nextPage: number, nextPerPage = perPage) => {
      const params = new URLSearchParams(searchParams.toString());
      const normalizedPage = Math.max(1, nextPage);

      if (normalizedPage === DEFAULT_PAGE) {
        params.delete("page");
      } else {
        params.set("page", String(normalizedPage));
      }

      if (nextPerPage === DEFAULT_PER_PAGE) {
        params.delete("per_page");
      } else {
        params.set("per_page", String(nextPerPage));
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, perPage, router, searchParams],
  );

  const updateSearchUrl = useCallback(
    (nextSearch: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const normalizedSearch = nextSearch.trim();

      params.delete("page");

      if (normalizedSearch) {
        params.set("search", normalizedSearch);
      } else {
        params.delete("search");
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    if (!paginationMeta || page <= paginationMeta.last_page) {
      return;
    }

    updatePaginationUrl(paginationMeta.last_page, perPage);
  }, [page, paginationMeta, perPage, updatePaginationUrl]);

  function updateFormValue<K extends keyof ProductPriceFormState>(key: K, value: ProductPriceFormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSearchUrl(searchDraft);
  }

  function handleClearSearch() {
    setSearchDraft("");
    updateSearchUrl("");
  }

  function closeProductPriceSection() {
    setIsProductPriceSectionOpen(false);
    setForm(createEmptyForm());
    setEditingProductPrice(null);
    setFormError(null);
  }

  function openCreateSection() {
    setIsProductPriceSectionOpen(true);
    setForm(createEmptyForm());
    setEditingProductPrice(null);
    setFormError(null);
  }

  function openEditSection(productPrice: AdminProductPriceRecord) {
    setEditingProductPrice(productPrice);
    setForm({
      product_id: String(productPrice.product_id),
      product_unit_id: productPrice.product_unit_id ? String(productPrice.product_unit_id) : "",
      original_price: String(productPrice.original_price),
      sell_price: String(productPrice.sell_price),
      date_time: toDateLocal(productPrice.date_time),
      is_active: productPrice.is_active,
      note: productPrice.note ?? "",
    });
    setFormError(null);
    setIsProductPriceSectionOpen(true);
  }

  function validateForm() {
    const productId = Number(form.product_id);
    const originalPrice = Number(form.original_price);
    const sellPrice = Number(form.sell_price);

    if (!Number.isInteger(productId) || productId <= 0) {
      return "Product is required.";
    }

    if (!Number.isFinite(originalPrice) || originalPrice < 0) {
      return "Original price must be 0 or greater.";
    }

    if (!Number.isFinite(sellPrice) || sellPrice < 0) {
      return "Sell price must be 0 or greater.";
    }

    if (!form.date_time) {
      return "Date and time is required.";
    }

    if (form.note.length > 1000) {
      return "Note must be 1000 characters or fewer.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const clientError = validateForm();

    if (clientError) {
      setFormError(clientError);
      return;
    }

    const payload = {
      product_id: Number(form.product_id),
      product_unit_id: form.product_unit_id ? Number(form.product_unit_id) : null,
      original_price: Number(form.original_price),
      sell_price: Number(form.sell_price),
      date_time: form.date_time,
      is_active: form.is_active,
      deactivated_at: null,
      note: form.note.trim() || null,
    };

    try {
      if (editingProductPrice) {
        await updateProductPrice.mutateAsync({
          productPriceId: editingProductPrice.id,
          payload,
        });
      } else {
        await createProductPrice.mutateAsync(payload);
      }

      closeProductPriceSection();
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(
          submissionError.errors?.product_id?.[0] ??
            submissionError.errors?.product_unit_id?.[0] ??
            submissionError.errors?.original_price?.[0] ??
            submissionError.errors?.sell_price?.[0] ??
            submissionError.errors?.date_time?.[0] ??
            submissionError.errors?.is_active?.[0] ??
            submissionError.errors?.note?.[0] ??
            submissionError.message,
        );
        return;
      }

      setFormError("Unable to save the product price right now.");
    }
  }

  async function handleDelete(productPrice: AdminProductPriceRecord) {
    const productName = productPrice.product?.product_name ?? "this product price";

    if (!window.confirm(`Delete price for "${productName}"?`)) {
      return;
    }

    setFormError(null);

    try {
      await deleteProductPrice.mutateAsync(productPrice.id);

      if (editingProductPrice?.id === productPrice.id) {
        closeProductPriceSection();
      }
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(submissionError.message);
        return;
      }

      setFormError("Unable to delete the product price right now.");
    }
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Product Prices</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Manage purchase cost, sale price, and active product pricing.</p>
          </div>

          <Button
            className="gap-2 self-start rounded-full px-5 sm:self-center"
            aria-controls="product-price-form-section"
            aria-expanded={isProductPriceSectionOpen}
            onClick={() => {
              if (isProductPriceSectionOpen) {
                closeProductPriceSection();
                return;
              }

              openCreateSection();
            }}
          >
            {isProductPriceSectionOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isProductPriceSectionOpen ? "Close" : "Create Product Price"}
          </Button>
        </div>
      </section>

      <div
        className={cn(
          "mx-auto w-full max-w-[1328px] overflow-hidden transition-all duration-300 ease-out",
          isProductPriceSectionOpen ? "mt-5 max-h-[820px] translate-y-0 opacity-100" : "mt-0 max-h-0 -translate-y-2 opacity-0",
        )}
      >
        <section
          id="product-price-form-section"
          aria-hidden={!isProductPriceSectionOpen}
          className="glass-card overflow-hidden rounded-[1.5rem]"
        >
          <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
            <h2 className="text-xl font-semibold text-[#1f2440]">
              {editingProductPrice ? "Edit Product Price" : "Create Product Price"}
            </h2>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-5 px-6 py-6 sm:px-8">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Product</label>
                  <select
                    className="pill-input h-9 w-full px-3 text-sm outline-none transition focus:border-[var(--accent)]"
                    value={form.product_id}
                    onChange={(event) => updateFormValue("product_id", event.target.value)}
                    disabled={!isProductPriceSectionOpen || isFormBusy}
                  >
                    <option value="">{isProductsLoading ? "Loading products..." : "Select product"}</option>
                    {productOptions.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.product_name} {product.product_code ? `(${product.product_code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Unit</label>
                  <select
                    className="pill-input h-9 w-full px-3 text-sm outline-none transition focus:border-[var(--accent)]"
                    value={form.product_unit_id}
                    onChange={(event) => updateFormValue("product_unit_id", event.target.value)}
                    disabled={!isProductPriceSectionOpen || isFormBusy}
                  >
                    <option value="">{isUnitsLoading ? "Loading units..." : "No unit"}</option>
                    {unitOptions.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit_name} ({unit.unit_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Original Price</label>
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="50"
                    value={form.original_price}
                    onChange={(event) => updateFormValue("original_price", event.target.value)}
                    autoComplete="off"
                    disabled={!isProductPriceSectionOpen || isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Sell Price</label>
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="60"
                    value={form.sell_price}
                    onChange={(event) => updateFormValue("sell_price", event.target.value)}
                    autoComplete="off"
                    disabled={!isProductPriceSectionOpen || isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Date</label>
                  <DatePicker
                    value={form.date_time}
                    onChange={(value) => updateFormValue("date_time", value)}
                    disabled={!isProductPriceSectionOpen || isSubmitting}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-white/70 p-4">
                <p className="mb-3 text-sm font-semibold text-[#2d3150]">Active Price</p>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-[#2d3150]">
                    <RadioInput
                      name="is_active"
                      checked={form.is_active}
                      disabled={!isProductPriceSectionOpen || isSubmitting}
                      onChange={() => updateFormValue("is_active", true)}
                    />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#2d3150]">
                    <RadioInput
                      name="is_active"
                      checked={!form.is_active}
                      disabled={!isProductPriceSectionOpen || isSubmitting}
                      onChange={() => updateFormValue("is_active", false)}
                    />
                    Inactive
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Note</label>
                <textarea
                  className="pill-input min-h-24 w-full resize-none px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]"
                  placeholder="Optional price note"
                  value={form.note}
                  onChange={(event) => updateFormValue("note", event.target.value)}
                  disabled={!isProductPriceSectionOpen || isSubmitting}
                />
              </div>

              {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--line)] px-6 py-5 sm:px-8">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
                onClick={closeProductPriceSection}
                disabled={!isProductPriceSectionOpen || isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-5" disabled={!isProductPriceSectionOpen || isFormBusy}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </section>
      </div>

      <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] rounded-[1.5rem] px-6 py-5 sm:px-8">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => handleSearchSubmit(event)}>
          <div className="flex-1">
            <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Search</label>
            <TextInput
              placeholder="Search product prices"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="rounded-full px-5" disabled={isTableBusy}>
              Search
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
              disabled={isTableBusy || (!search && !searchDraft)}
              onClick={handleClearSearch}
            >
              Clear
            </Button>
          </div>
        </form>
      </section>

      {!error ? (
        <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] overflow-hidden rounded-[1.5rem]">
          {isLoading ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">Loading product prices...</div>
          ) : productPrices.length === 0 ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">
              {search ? "No product prices matched your search." : "No product prices found yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <th className="px-6 py-4 font-semibold sm:px-8">#</th>
                    <th className="px-6 py-4 font-semibold">Product</th>
                    <th className="px-6 py-4 font-semibold">Unit</th>
                    <th className="px-6 py-4 font-semibold">Original</th>
                    <th className="px-6 py-4 font-semibold">Sell</th>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold sm:px-8">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productPrices.map((productPrice, index) => (
                    <tr key={productPrice.id} className="border-b border-[var(--line)] text-sm text-[var(--foreground)] last:border-0">
                      <td className="px-6 py-4 text-[var(--muted)] sm:px-8">{(page - 1) * perPage + index + 1}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[#2d3150]">{productPrice.product?.product_name ?? "Deleted product"}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{productPrice.product?.product_code ?? "-"}</p>
                      </td>
                      <td className="px-6 py-4 text-[var(--muted)]">
                        {productPrice.unit ? `${productPrice.unit.unit_name} (${productPrice.unit.unit_code})` : "-"}
                      </td>
                      <td className="px-6 py-4 text-[var(--muted)]">BDT {formatPrice(productPrice.original_price)}</td>
                      <td className="px-6 py-4 font-medium text-[#2d3150]">BDT {formatPrice(productPrice.sell_price)}</td>
                      <td className="px-6 py-4 text-[var(--muted)]">{formatDate(productPrice.date_time)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                            productPrice.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {productPrice.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 sm:px-8">
                        <div className="flex justify-end gap-2">
                          <Button
                            as="span"
                            variant="outline"
                            size="xs"
                            disabled={isTableBusy}
                            onClick={() => openEditSection(productPrice)}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            as="span"
                            variant="danger-soft"
                            size="xs"
                            disabled={isTableBusy}
                            onClick={() => void handleDelete(productPrice)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {paginationMeta ? (
                <Pagination
                  meta={paginationMeta}
                  disabled={isTableBusy}
                  perPageOptions={PER_PAGE_OPTIONS}
                  onPageChange={(nextPage) => updatePaginationUrl(nextPage)}
                  onPerPageChange={(nextPerPage) => updatePaginationUrl(DEFAULT_PAGE, nextPerPage)}
                />
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}

function ProductPricesPageFallback() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Product Prices</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Manage purchase cost, sale price, and active product pricing.</p>
        </div>
      </section>
    </main>
  );
}

export default function ProductPricesPage() {
  return (
    <Suspense fallback={<ProductPricesPageFallback />}>
      <ProductPricesPageContent />
    </Suspense>
  );
}
