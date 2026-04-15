"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { PencilLine, Plus, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { RadioInput } from "@/components/ui/radio-input";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import {
  AdminProductRecord,
  AdminProductStatus,
  useAdminProductsQuery,
  useCreateAdminProductMutation,
  useDeleteAdminProductMutation,
  useUpdateAdminProductMutation,
} from "@/lib/hooks/use-admin-products";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const PER_PAGE_OPTIONS = [5, 10, 20, 30, 50];
const PRODUCT_STATUSES: AdminProductStatus[] = ["active", "inactive"];

type ProductFormState = {
  product_name: string;
  description: string;
  status: AdminProductStatus;
};

function createEmptyForm(): ProductFormState {
  return {
    product_name: "",
    description: "",
    status: "active",
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function ProductsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("per_page"));
  const search = parseSearchParam(searchParams.get("search"));
  const { data: productsResponse, isLoading, error } = useAdminProductsQuery({ page, perPage, search }, true);
  const products = productsResponse?.data ?? [];
  const paginationMeta = productsResponse?.meta;
  const createProduct = useCreateAdminProductMutation();
  const updateProduct = useUpdateAdminProductMutation();
  const deleteProduct = useDeleteAdminProductMutation();
  const [searchDraft, setSearchDraft] = useState(search);
  const [form, setForm] = useState<ProductFormState>(() => createEmptyForm());
  const [editingProduct, setEditingProduct] = useState<AdminProductRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isProductSectionOpen, setIsProductSectionOpen] = useState(false);

  const isSubmitting = createProduct.isPending || updateProduct.isPending;
  const isTableBusy = deleteProduct.isPending;

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

  function updateFormValue<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
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

  function closeProductSection() {
    setIsProductSectionOpen(false);
    setForm(createEmptyForm());
    setEditingProduct(null);
    setFormError(null);
  }

  function openCreateSection() {
    setIsProductSectionOpen(true);
    setForm(createEmptyForm());
    setEditingProduct(null);
    setFormError(null);
  }

  function openEditSection(product: AdminProductRecord) {
    setEditingProduct(product);
    setForm({
      product_name: product.product_name,
      description: product.description ?? "",
      status: product.status,
    });
    setFormError(null);
    setIsProductSectionOpen(true);
  }

  function validateForm() {
    const productName = form.product_name.trim();
    const description = form.description.trim();

    if (!productName) {
      return "Product name is required.";
    }

    if (productName.length > 120) {
      return "Product name must be 120 characters or fewer.";
    }

    if (description.length > 1000) {
      return "Description must be 1000 characters or fewer.";
    }

    if (!PRODUCT_STATUSES.includes(form.status)) {
      return "Status is invalid.";
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
      product_name: form.product_name.trim(),
      description: form.description.trim() || null,
      status: form.status,
    };

    try {
      if (editingProduct) {
        await updateProduct.mutateAsync({
          productId: editingProduct.id,
          payload,
        });
      } else {
        await createProduct.mutateAsync(payload);
      }

      closeProductSection();
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(
          submissionError.errors?.product_name?.[0] ??
            submissionError.errors?.description?.[0] ??
            submissionError.errors?.status?.[0] ??
            submissionError.message,
        );
        return;
      }

      setFormError("Unable to save the product right now.");
    }
  }

  async function handleDelete(product: AdminProductRecord) {
    if (!window.confirm(`Delete product "${product.product_name}"?`)) {
      return;
    }

    setFormError(null);

    try {
      await deleteProduct.mutateAsync(product.id);

      if (editingProduct?.id === product.id) {
        closeProductSection();
      }
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(submissionError.message);
        return;
      }

      setFormError("Unable to delete the product right now.");
    }
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Products</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Manage fuel products, codes, and active sale status.</p>
          </div>

          <Button
            className="gap-2 self-start rounded-full px-5 sm:self-center"
            aria-controls="product-form-section"
            aria-expanded={isProductSectionOpen}
            onClick={() => {
              if (isProductSectionOpen) {
                closeProductSection();
                return;
              }

              openCreateSection();
            }}
          >
            {isProductSectionOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isProductSectionOpen ? "Close" : "Create Product"}
          </Button>
        </div>
      </section>

      <div
        className={cn(
          "mx-auto w-full max-w-[1328px] overflow-hidden transition-all duration-300 ease-out",
          isProductSectionOpen ? "mt-5 max-h-[680px] translate-y-0 opacity-100" : "mt-0 max-h-0 -translate-y-2 opacity-0",
        )}
      >
        <section id="product-form-section" aria-hidden={!isProductSectionOpen} className="glass-card overflow-hidden rounded-[1.5rem]">
          <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
            <h2 className="text-xl font-semibold text-[#1f2440]">{editingProduct ? "Edit Product" : "Create Product"}</h2>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-5 px-6 py-6 sm:px-8">
              <div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Product Name</label>
                  <TextInput
                    placeholder="Petrol"
                    value={form.product_name}
                    onChange={(event) => updateFormValue("product_name", event.target.value)}
                    autoComplete="off"
                    disabled={!isProductSectionOpen || isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Description</label>
                <textarea
                  className="pill-input min-h-24 w-full resize-none px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]"
                  placeholder="Optional product note"
                  value={form.description}
                  onChange={(event) => updateFormValue("description", event.target.value)}
                  disabled={!isProductSectionOpen || isSubmitting}
                />
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-white/70 p-4">
                <p className="mb-3 text-sm font-semibold text-[#2d3150]">Status</p>
                <div className="flex flex-wrap items-center gap-4">
                  {PRODUCT_STATUSES.map((status) => (
                    <label key={status} className="flex items-center gap-2 text-sm capitalize text-[#2d3150]">
                      <RadioInput
                        name="status"
                        checked={form.status === status}
                        disabled={!isProductSectionOpen || isSubmitting}
                        onChange={() => updateFormValue("status", status)}
                      />
                      {status}
                    </label>
                  ))}
                </div>
              </div>

              {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--line)] px-6 py-5 sm:px-8">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
                onClick={closeProductSection}
                disabled={!isProductSectionOpen || isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-5" disabled={!isProductSectionOpen || isSubmitting}>
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
              placeholder="Search products"
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
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">
              {search ? "No products matched your search." : "No products found yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <th className="px-6 py-4 font-semibold sm:px-8">#</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Active Price</th>
                    <th className="px-6 py-4 font-semibold">Updated</th>
                    <th className="px-6 py-4 font-semibold sm:px-8">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => (
                    <tr key={product.id} className="border-b border-[var(--line)] text-sm text-[var(--foreground)] last:border-0">
                      <td className="px-6 py-4 text-[var(--muted)] sm:px-8">{(page - 1) * perPage + index + 1}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[#2d3150]">{product.product_name}</p>
                        {product.description ? <p className="mt-1 max-w-sm truncate text-xs text-[var(--muted)]">{product.description}</p> : null}
                      </td>
                      <td className="px-6 py-4 text-[var(--muted)]">{product.product_code ?? "-"}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                            product.status === "active" && "bg-emerald-50 text-emerald-700",
                            product.status === "inactive" && "bg-rose-50 text-rose-700",
                          )}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--muted)]">
                        {product.active_price ? (
                          <div>
                            <p className="font-medium text-[#2d3150]">BDT {formatPrice(product.active_price.sell_price)}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {product.active_price.unit
                                ? `${product.active_price.unit.unit_name} (${product.active_price.unit.unit_code})`
                                : "No unit"}
                            </p>
                          </div>
                        ) : (
                          "No active price"
                        )}
                      </td>
                      <td className="px-6 py-4 text-[var(--muted)]">{formatDate(product.updated_at)}</td>
                      <td className="px-6 py-4 sm:px-8">
                        <div className="flex justify-end gap-2">
                          <Button
                            as="span"
                            variant="outline"
                            size="xs"
                            disabled={isTableBusy}
                            onClick={() => openEditSection(product)}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            as="span"
                            variant="danger-soft"
                            size="xs"
                            disabled={isTableBusy}
                            onClick={() => void handleDelete(product)}
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

function ProductsPageFallback() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Products</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Manage fuel products, codes, and active sale status.</p>
        </div>
      </section>
    </main>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsPageFallback />}>
      <ProductsPageContent />
    </Suspense>
  );
}
