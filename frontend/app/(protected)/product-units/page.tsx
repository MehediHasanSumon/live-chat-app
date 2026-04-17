"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { PencilLine, Plus, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PdfDownloadButton } from "@/components/ui/pdf-download-button";
import { Button } from "@/components/ui/button";
import { BoneyardSkeleton, TableSkeleton } from "@/components/ui/boneyard-loading";
import { Pagination } from "@/components/ui/pagination";
import { TextInput } from "@/components/ui/text-input";
import { buildAdminListPdfPath } from "@/lib/admin-pdf";
import { ApiClientError } from "@/lib/api-client";
import {
  AdminProductUnitRecord,
  useAdminProductUnitsQuery,
  useCreateAdminProductUnitMutation,
  useDeleteAdminProductUnitMutation,
  useUpdateAdminProductUnitMutation,
} from "@/lib/hooks/use-admin-product-units";
import { usePdfDownload } from "@/lib/hooks/use-pdf-download";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const PER_PAGE_OPTIONS = [5, 10, 20, 30, 50];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type ProductUnitFormState = {
  unit_name: string;
  unit_value: string;
};

function createEmptyForm(): ProductUnitFormState {
  return {
    unit_name: "",
    unit_value: "",
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

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function ProductUnitsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("per_page"));
  const search = parseSearchParam(searchParams.get("search"));
  const { data: productUnitsResponse, isLoading, error } = useAdminProductUnitsQuery({ page, perPage, search }, true);
  const productUnits = productUnitsResponse?.data ?? [];
  const paginationMeta = productUnitsResponse?.meta;
  const createProductUnit = useCreateAdminProductUnitMutation();
  const updateProductUnit = useUpdateAdminProductUnitMutation();
  const deleteProductUnit = useDeleteAdminProductUnitMutation();
  const [searchDraft, setSearchDraft] = useState(search);
  const [form, setForm] = useState<ProductUnitFormState>(() => createEmptyForm());
  const [isUnitValueTouched, setIsUnitValueTouched] = useState(false);
  const [editingProductUnit, setEditingProductUnit] = useState<AdminProductUnitRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isProductUnitSectionOpen, setIsProductUnitSectionOpen] = useState(false);
  const [deletingProductUnitId, setDeletingProductUnitId] = useState<number | null>(null);
  const { download, downloadError, isDownloadingPdf } = usePdfDownload();

  const isSubmitting = createProductUnit.isPending || updateProductUnit.isPending;

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

  function updateFormValue<K extends keyof ProductUnitFormState>(key: K, value: ProductUnitFormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "unit_name" && !isUnitValueTouched ? { unit_value: toSlug(value) } : {}),
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

  function closeProductUnitSection() {
    setIsProductUnitSectionOpen(false);
    setForm(createEmptyForm());
    setIsUnitValueTouched(false);
    setEditingProductUnit(null);
    setFormError(null);
  }

  function openCreateSection() {
    setIsProductUnitSectionOpen(true);
    setForm(createEmptyForm());
    setIsUnitValueTouched(false);
    setEditingProductUnit(null);
    setFormError(null);
  }

  function openEditSection(productUnit: AdminProductUnitRecord) {
    setEditingProductUnit(productUnit);
    setForm({
      unit_name: productUnit.unit_name,
      unit_value: String(productUnit.unit_value),
    });
    setIsUnitValueTouched(true);
    setFormError(null);
    setIsProductUnitSectionOpen(true);
  }

  function validateForm() {
    const unitName = form.unit_name.trim();
    const unitValue = toSlug(form.unit_value);

    if (!unitName) {
      return "Unit name is required.";
    }

    if (unitName.length > 60) {
      return "Unit name must be 60 characters or fewer.";
    }

    if (!unitValue) {
      return "Unit value is required.";
    }

    if (unitValue.length > 80) {
      return "Unit value must be 80 characters or fewer.";
    }

    if (!slugPattern.test(unitValue)) {
      return "Unit value must be a valid slug.";
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
      unit_name: form.unit_name.trim(),
      unit_value: toSlug(form.unit_value),
    };

    try {
      if (editingProductUnit) {
        await updateProductUnit.mutateAsync({
          productUnitId: editingProductUnit.id,
          payload,
        });
      } else {
        await createProductUnit.mutateAsync(payload);
      }

      closeProductUnitSection();
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(
          submissionError.errors?.unit_name?.[0] ?? submissionError.errors?.unit_value?.[0] ?? submissionError.errors?.unit_code?.[0] ?? submissionError.message,
        );
        return;
      }

      setFormError("Unable to save the product unit right now.");
    }
  }

  async function handleDelete(productUnit: AdminProductUnitRecord) {
    if (!window.confirm(`Delete product unit "${productUnit.unit_name}"?`)) {
      return;
    }

    setFormError(null);

    try {
      setDeletingProductUnitId(productUnit.id);
      await deleteProductUnit.mutateAsync(productUnit.id);

      if (editingProductUnit?.id === productUnit.id) {
        closeProductUnitSection();
      }
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(submissionError.message);
        return;
      }

      setFormError("Unable to delete the product unit right now.");
    } finally {
      setDeletingProductUnitId(null);
    }
  }

  async function handleDownloadPdf() {
    await download(buildAdminListPdfPath("product-units", { search }), "product-units");
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Product Units</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Manage product measurement units and conversion values.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <PdfDownloadButton isLoading={isDownloadingPdf} onClick={() => void handleDownloadPdf()} />
            <Button
              className="gap-2 self-start rounded-full px-5 sm:self-center"
              aria-controls="product-unit-form-section"
              aria-expanded={isProductUnitSectionOpen}
              onClick={() => {
                if (isProductUnitSectionOpen) {
                  closeProductUnitSection();
                  return;
                }

                openCreateSection();
              }}
            >
              {isProductUnitSectionOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isProductUnitSectionOpen ? "Close" : "Create Product Unit"}
            </Button>
          </div>
        </div>
      </section>

      {downloadError ? <p className="mx-auto mt-3 w-full max-w-[1328px] text-sm text-rose-600">{downloadError}</p> : null}

      <div
        className={cn(
          "mx-auto w-full max-w-[1328px] overflow-hidden transition-all duration-300 ease-out",
          isProductUnitSectionOpen ? "mt-5 max-h-[420px] translate-y-0 opacity-100" : "mt-0 max-h-0 -translate-y-2 opacity-0",
        )}
      >
        <section
          id="product-unit-form-section"
          aria-hidden={!isProductUnitSectionOpen}
          className="glass-card overflow-hidden rounded-[1.5rem]"
        >
          <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
            <h2 className="text-xl font-semibold text-[#1f2440]">
              {editingProductUnit ? "Edit Product Unit" : "Create Product Unit"}
            </h2>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-4 px-6 py-6 sm:px-8 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Unit Name</label>
                <TextInput
                  placeholder="Liter"
                  value={form.unit_name}
                  onChange={(event) => updateFormValue("unit_name", event.target.value)}
                  autoComplete="off"
                  disabled={!isProductUnitSectionOpen || isSubmitting}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Unit Value</label>
                <TextInput
                  placeholder="liter"
                  value={form.unit_value}
                  onChange={(event) => {
                    setIsUnitValueTouched(true);
                    updateFormValue("unit_value", toSlug(event.target.value));
                  }}
                  autoComplete="off"
                  disabled={!isProductUnitSectionOpen || isSubmitting}
                />
                <p className="mt-1 text-xs text-[var(--muted)]">Slug value, for example liter.</p>
              </div>

              {formError ? <p className="text-sm text-rose-600 md:col-span-2">{formError}</p> : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--line)] px-6 py-5 sm:px-8">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
                onClick={closeProductUnitSection}
                disabled={!isProductUnitSectionOpen || isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-5" disabled={!isProductUnitSectionOpen || isSubmitting}>
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
              placeholder="Search product units"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="rounded-full px-5">
              Search
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
              disabled={!search && !searchDraft}
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
            <BoneyardSkeleton name="product-units-table" loading={isLoading} fallback={<TableSkeleton columns={6} rows={6} />}>
              <TableSkeleton columns={6} rows={6} />
            </BoneyardSkeleton>
          ) : productUnits.length === 0 ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">
              {search ? "No product units matched your search." : "No product units found yet."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <th className="px-6 py-4 font-semibold sm:px-8">#</th>
                    <th className="px-6 py-4 font-semibold">Unit Name</th>
                    <th className="px-6 py-4 font-semibold">Unit Value</th>
                    <th className="px-6 py-4 font-semibold">Unit Code</th>
                    <th className="px-6 py-4 font-semibold">Updated</th>
                    <th className="px-6 py-4 font-semibold sm:px-8">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productUnits.map((productUnit, index) => (
                    <tr key={productUnit.id} className="border-b border-[var(--line)] text-sm text-[var(--foreground)] last:border-0">
                      <td className="px-6 py-4 text-[var(--muted)] sm:px-8">{(page - 1) * perPage + index + 1}</td>
                      <td className="px-6 py-4 font-medium text-[#2d3150]">{productUnit.unit_name}</td>
                      <td className="px-6 py-4 text-[var(--muted)]">{productUnit.unit_value}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                          {productUnit.unit_code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--muted)]">{formatDate(productUnit.updated_at)}</td>
                      <td className="px-6 py-4 sm:px-8">
                        <div className="flex justify-end gap-2">
                          <Button
                            as="span"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Edit product unit"
                            title="Edit"
                            disabled={deletingProductUnitId === productUnit.id}
                            onClick={() => openEditSection(productUnit)}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            as="span"
                            variant="danger-soft"
                            size="icon-sm"
                            aria-label="Delete product unit"
                            title="Delete"
                            disabled={deletingProductUnitId === productUnit.id}
                            onClick={() => void handleDelete(productUnit)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {paginationMeta ? (
                <Pagination
                  meta={paginationMeta}
                  perPageOptions={PER_PAGE_OPTIONS}
                  onPageChange={(nextPage) => updatePaginationUrl(nextPage)}
                  onPerPageChange={(nextPerPage) => updatePaginationUrl(DEFAULT_PAGE, nextPerPage)}
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}

function ProductUnitsPageFallback() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Product Units</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Manage product measurement units and conversion values.</p>
        </div>
      </section>
    </main>
  );
}

export default function ProductUnitsPage() {
  return (
    <Suspense fallback={<ProductUnitsPageFallback />}>
      <ProductUnitsPageContent />
    </Suspense>
  );
}
