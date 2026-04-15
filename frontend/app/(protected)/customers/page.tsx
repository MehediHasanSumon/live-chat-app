"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { PencilLine, Plus, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { BoneyardSkeleton, TableSkeleton } from "@/components/ui/boneyard-loading";
import { Pagination } from "@/components/ui/pagination";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import {
  AdminCustomerRecord,
  useAdminCustomersQuery,
  useCreateAdminCustomerMutation,
  useDeleteAdminCustomerMutation,
  useUpdateAdminCustomerMutation,
} from "@/lib/hooks/use-admin-customers";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const PER_PAGE_OPTIONS = [5, 10, 20, 30, 50];
const mobilePattern = /^[0-9+\-\s()]+$/;

type CustomerFormState = {
  name: string;
  mobile: string;
  vehicle_no: string;
};

function createEmptyForm(): CustomerFormState {
  return {
    name: "",
    mobile: "",
    vehicle_no: "",
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

function CustomersPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("per_page"));
  const search = parseSearchParam(searchParams.get("search"));
  const { data: customersResponse, isLoading, error } = useAdminCustomersQuery({ page, perPage, search }, true);
  const customers = customersResponse?.data ?? [];
  const paginationMeta = customersResponse?.meta;
  const createCustomer = useCreateAdminCustomerMutation();
  const updateCustomer = useUpdateAdminCustomerMutation();
  const deleteCustomer = useDeleteAdminCustomerMutation();
  const [searchDraft, setSearchDraft] = useState(search);
  const [form, setForm] = useState<CustomerFormState>(() => createEmptyForm());
  const [editingCustomer, setEditingCustomer] = useState<AdminCustomerRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCustomerSectionOpen, setIsCustomerSectionOpen] = useState(false);

  const isSubmitting = createCustomer.isPending || updateCustomer.isPending;
  const isTableBusy = deleteCustomer.isPending;

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

  function updateFormValue<K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) {
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

  function closeCustomerSection() {
    setIsCustomerSectionOpen(false);
    setForm(createEmptyForm());
    setEditingCustomer(null);
    setFormError(null);
  }

  function openCreateSection() {
    setIsCustomerSectionOpen(true);
    setForm(createEmptyForm());
    setEditingCustomer(null);
    setFormError(null);
  }

  function openEditSection(customer: AdminCustomerRecord) {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      mobile: customer.mobile ?? "",
      vehicle_no: customer.vehicle_no ?? "",
    });
    setFormError(null);
    setIsCustomerSectionOpen(true);
  }

  function validateForm() {
    const name = form.name.trim();
    const mobile = form.mobile.trim();
    const vehicleNo = form.vehicle_no.trim();

    if (!name) {
      return "Customer name is required.";
    }

    if (name.length > 120) {
      return "Customer name must be 120 characters or fewer.";
    }

    if (mobile.length > 20) {
      return "Mobile number must be 20 characters or fewer.";
    }

    if (mobile && !mobilePattern.test(mobile)) {
      return "Mobile number can only contain numbers, spaces, plus, dashes, and brackets.";
    }

    if (vehicleNo.length > 50) {
      return "Vehicle number must be 50 characters or fewer.";
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
      name: form.name.trim(),
      mobile: form.mobile.trim() || null,
      vehicle_no: form.vehicle_no.trim() || null,
    };

    try {
      if (editingCustomer) {
        await updateCustomer.mutateAsync({
          customerId: editingCustomer.id,
          payload,
        });
      } else {
        await createCustomer.mutateAsync(payload);
      }

      closeCustomerSection();
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(
          submissionError.errors?.name?.[0] ??
            submissionError.errors?.mobile?.[0] ??
            submissionError.errors?.vehicle_no?.[0] ??
            submissionError.message,
        );
        return;
      }

      setFormError("Unable to save the customer right now.");
    }
  }

  async function handleDelete(customer: AdminCustomerRecord) {
    if (!window.confirm(`Delete customer "${customer.name}"?`)) {
      return;
    }

    setFormError(null);

    try {
      await deleteCustomer.mutateAsync(customer.id);

      if (editingCustomer?.id === customer.id) {
        closeCustomerSection();
      }
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(submissionError.message);
        return;
      }

      setFormError("Unable to delete the customer right now.");
    }
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Customers</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Manage customer contacts and vehicle details.</p>
          </div>

          <Button
            className="gap-2 self-start rounded-full px-5 sm:self-center"
            aria-controls="customer-form-section"
            aria-expanded={isCustomerSectionOpen}
            onClick={() => {
              if (isCustomerSectionOpen) {
                closeCustomerSection();
                return;
              }

              openCreateSection();
            }}
          >
            {isCustomerSectionOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isCustomerSectionOpen ? "Close" : "Create Customer"}
          </Button>
        </div>
      </section>

      <div
        className={cn(
          "mx-auto w-full max-w-[1328px] overflow-hidden transition-all duration-300 ease-out",
          isCustomerSectionOpen ? "mt-5 max-h-[420px] translate-y-0 opacity-100" : "mt-0 max-h-0 -translate-y-2 opacity-0",
        )}
      >
        <section id="customer-form-section" aria-hidden={!isCustomerSectionOpen} className="glass-card overflow-hidden rounded-[1.5rem]">
          <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
            <h2 className="text-xl font-semibold text-[#1f2440]">{editingCustomer ? "Edit Customer" : "Create Customer"}</h2>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-4 px-6 py-6 sm:px-8 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Customer Name</label>
                <TextInput
                  placeholder="Rahim Uddin"
                  value={form.name}
                  onChange={(event) => updateFormValue("name", event.target.value)}
                  autoComplete="off"
                  disabled={!isCustomerSectionOpen || isSubmitting}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Mobile Number</label>
                <TextInput
                  placeholder="+8801700000000"
                  value={form.mobile}
                  onChange={(event) => updateFormValue("mobile", event.target.value)}
                  autoComplete="off"
                  disabled={!isCustomerSectionOpen || isSubmitting}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Vehicle No</label>
                <TextInput
                  placeholder="DHAKA-123"
                  value={form.vehicle_no}
                  onChange={(event) => updateFormValue("vehicle_no", event.target.value)}
                  autoComplete="off"
                  disabled={!isCustomerSectionOpen || isSubmitting}
                />
              </div>

              {formError ? <p className="text-sm text-rose-600 md:col-span-3">{formError}</p> : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--line)] px-6 py-5 sm:px-8">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
                onClick={closeCustomerSection}
                disabled={!isCustomerSectionOpen || isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-5" disabled={!isCustomerSectionOpen || isSubmitting}>
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
              placeholder="Search customers"
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
            <BoneyardSkeleton name="customers-table" loading={isLoading} fallback={<TableSkeleton columns={6} rows={6} />}>
              <TableSkeleton columns={6} rows={6} />
            </BoneyardSkeleton>
          ) : customers.length === 0 ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">
              {search ? "No customers matched your search." : "No customers found yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <th className="px-6 py-4 font-semibold sm:px-8">#</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Mobile</th>
                    <th className="px-6 py-4 font-semibold">Vehicle No</th>
                    <th className="px-6 py-4 font-semibold">Updated</th>
                    <th className="px-6 py-4 font-semibold sm:px-8">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer, index) => (
                    <tr key={customer.id} className="border-b border-[var(--line)] text-sm text-[var(--foreground)] last:border-0">
                      <td className="px-6 py-4 text-[var(--muted)] sm:px-8">{(page - 1) * perPage + index + 1}</td>
                      <td className="px-6 py-4 font-medium text-[#2d3150]">{customer.name}</td>
                      <td className="px-6 py-4 text-[var(--muted)]">{customer.mobile ?? "-"}</td>
                      <td className="px-6 py-4 text-[var(--muted)]">{customer.vehicle_no ?? "-"}</td>
                      <td className="px-6 py-4 text-[var(--muted)]">{formatDate(customer.updated_at)}</td>
                      <td className="px-6 py-4 sm:px-8">
                        <div className="flex justify-end gap-2">
                          <Button
                            as="span"
                            variant="outline"
                            size="xs"
                            disabled={isTableBusy}
                            onClick={() => openEditSection(customer)}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            as="span"
                            variant="danger-soft"
                            size="xs"
                            disabled={isTableBusy}
                            onClick={() => void handleDelete(customer)}
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

function CustomersPageFallback() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Customers</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Manage customer contacts and vehicle details.</p>
        </div>
      </section>
    </main>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<CustomersPageFallback />}>
      <CustomersPageContent />
    </Suspense>
  );
}
