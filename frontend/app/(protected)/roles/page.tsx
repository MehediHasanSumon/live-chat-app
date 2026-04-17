"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { PencilLine, Plus, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PdfDownloadButton } from "@/components/ui/pdf-download-button";
import { Button } from "@/components/ui/button";
import { BoneyardSkeleton, PanelSkeleton, TableSkeleton } from "@/components/ui/boneyard-loading";
import { CheckboxInput } from "@/components/ui/checkbox-input";
import { Pagination } from "@/components/ui/pagination";
import { TextInput } from "@/components/ui/text-input";
import { buildAdminListPdfPath } from "@/lib/admin-pdf";
import { ApiClientError } from "@/lib/api-client";
import {
  AdminRoleRecord,
  useAdminPermissionOptionsQuery,
  useAdminRolesQuery,
  useCreateAdminRoleMutation,
  useDeleteAdminRoleMutation,
  useUpdateAdminRoleMutation,
} from "@/lib/hooks/use-admin-roles";
import { usePdfDownload } from "@/lib/hooks/use-pdf-download";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const PER_PAGE_OPTIONS = [5, 10, 20, 30, 50];

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

function RolesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("per_page"));
  const search = parseSearchParam(searchParams.get("search"));
  const { data: rolesResponse, isLoading, error } = useAdminRolesQuery({ page, perPage, search }, true);
  const { data: permissionOptions = [], isLoading: isPermissionOptionsLoading } = useAdminPermissionOptionsQuery(true);
  const roles = rolesResponse?.data ?? [];
  const paginationMeta = rolesResponse?.meta;
  const createRole = useCreateAdminRoleMutation();
  const updateRole = useUpdateAdminRoleMutation();
  const deleteRole = useDeleteAdminRoleMutation();
  const [searchDraft, setSearchDraft] = useState(search);
  const [name, setName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [editingRole, setEditingRole] = useState<AdminRoleRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isRoleSectionOpen, setIsRoleSectionOpen] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);
  const { download, downloadError, isDownloadingPdf } = usePdfDownload();

  const isSubmitting = createRole.isPending || updateRole.isPending;

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

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSearchUrl(searchDraft);
  }

  function handleClearSearch() {
    setSearchDraft("");
    updateSearchUrl("");
  }

  function closeRoleSection() {
    setIsRoleSectionOpen(false);
    setName("");
    setSelectedPermissions([]);
    setEditingRole(null);
    setFormError(null);
  }

  function togglePermission(permissionName: string) {
    setSelectedPermissions((current) =>
      current.includes(permissionName)
        ? current.filter((selectedPermission) => selectedPermission !== permissionName)
        : [...current, permissionName].sort(),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const normalizedName = name.trim().toLowerCase();

    if (!normalizedName) {
      setFormError("Role name is required.");
      return;
    }

    try {
      if (editingRole) {
        await updateRole.mutateAsync({
          roleId: editingRole.id,
          payload: { name: normalizedName, permissions: selectedPermissions },
        });
      } else {
        await createRole.mutateAsync({ name: normalizedName, permissions: selectedPermissions });
      }

      closeRoleSection();
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(
          submissionError.errors?.name?.[0] ??
            submissionError.errors?.permissions?.[0] ??
            submissionError.errors?.["permissions.0"]?.[0] ??
            submissionError.message,
        );
        return;
      }

      setFormError("Unable to save the role right now.");
    }
  }

  async function handleDelete(role: AdminRoleRecord) {
    if (!window.confirm(`Delete role "${role.name}"?`)) {
      return;
    }

    setFormError(null);

    try {
      setDeletingRoleId(role.id);
      await deleteRole.mutateAsync(role.id);

      if (editingRole?.id === role.id) {
        closeRoleSection();
      }
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(submissionError.message);
        return;
      }

      setFormError("Unable to delete the role right now.");
    } finally {
      setDeletingRoleId(null);
    }
  }

  async function handleDownloadPdf() {
    await download(buildAdminListPdfPath("roles", { search }), "roles");
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Roles</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Manage roles and their permission access.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <PdfDownloadButton isLoading={isDownloadingPdf} onClick={() => void handleDownloadPdf()} />
            <Button
              className="gap-2 self-start rounded-full px-5 sm:self-center"
              aria-controls="role-form-section"
              aria-expanded={isRoleSectionOpen}
              onClick={() => {
                if (isRoleSectionOpen) {
                  closeRoleSection();
                  return;
                }

                setIsRoleSectionOpen(true);
                setEditingRole(null);
                setName("");
                setSelectedPermissions([]);
                setFormError(null);
              }}
            >
              {isRoleSectionOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isRoleSectionOpen ? "Close" : "Create Role"}
            </Button>
          </div>
        </div>
      </section>

      {downloadError ? <p className="mx-auto mt-3 w-full max-w-[1328px] text-sm text-rose-600">{downloadError}</p> : null}

      <div
        className={cn(
          "mx-auto w-full max-w-[1328px] overflow-hidden transition-all duration-300 ease-out",
          isRoleSectionOpen ? "mt-5 max-h-[760px] translate-y-0 opacity-100" : "mt-0 max-h-0 -translate-y-2 opacity-0",
        )}
      >
        <section id="role-form-section" aria-hidden={!isRoleSectionOpen} className="glass-card overflow-hidden rounded-[1.5rem]">
          <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
            <h2 className="text-xl font-semibold text-[#1f2440]">{editingRole ? "Edit Role" : "Create Role"}</h2>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-5 px-6 py-6 sm:px-8">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Role name</label>
                <TextInput
                  placeholder="support-agent"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  disabled={!isRoleSectionOpen || isSubmitting}
                />
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#2d3150]">Permissions</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{selectedPermissions.length} selected</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 rounded-full border border-[var(--line)] bg-white px-3 text-xs text-[var(--foreground)] hover:bg-white"
                      disabled={!isRoleSectionOpen || isSubmitting || permissionOptions.length === 0}
                      onClick={() => setSelectedPermissions(permissionOptions.map((permission) => permission.name))}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 rounded-full border border-[var(--line)] bg-white px-3 text-xs text-[var(--foreground)] hover:bg-white"
                      disabled={!isRoleSectionOpen || isSubmitting || selectedPermissions.length === 0}
                      onClick={() => setSelectedPermissions([])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--line)] bg-white/70 p-4">
                  {isPermissionOptionsLoading ? (
                    <BoneyardSkeleton name="role-permissions-options" loading={isPermissionOptionsLoading} fallback={<PanelSkeleton lines={3} />}>
                      <PanelSkeleton lines={3} />
                    </BoneyardSkeleton>
                  ) : permissionOptions.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No permissions found yet.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {permissionOptions.map((permission) => (
                        <label key={permission.id} className="flex items-center gap-3 text-sm text-[#2d3150]">
                          <CheckboxInput
                            checked={selectedPermissions.includes(permission.name)}
                            disabled={!isRoleSectionOpen || isSubmitting}
                            onChange={() => togglePermission(permission.name)}
                          />
                          <span className="truncate">{permission.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--line)] px-6 py-5 sm:px-8">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
                onClick={closeRoleSection}
                disabled={!isRoleSectionOpen || isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-5" disabled={!isRoleSectionOpen || isSubmitting}>
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
              placeholder="Search roles"
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
            <BoneyardSkeleton name="roles-table" loading={isLoading} fallback={<TableSkeleton columns={6} rows={6} />}>
              <TableSkeleton columns={6} rows={6} />
            </BoneyardSkeleton>
          ) : roles.length === 0 ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">
              {search ? "No roles matched your search." : "No roles found yet."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <th className="px-6 py-4 font-semibold sm:px-8">#</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Guard</th>
                    <th className="px-6 py-4 font-semibold">Permissions</th>
                    <th className="px-6 py-4 font-semibold">Updated</th>
                    <th className="px-6 py-4 font-semibold sm:px-8">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role, index) => (
                    <tr key={role.id} className="border-b border-[var(--line)] text-sm text-[var(--foreground)] last:border-0">
                      <td className="px-6 py-4 text-[var(--muted)] sm:px-8">{(page - 1) * perPage + index + 1}</td>
                      <td className="px-6 py-4 font-medium text-[#2d3150]">{role.name}</td>
                      <td className="px-6 py-4 text-[var(--muted)]">{role.guard_name}</td>
                      <td className="px-6 py-4">
                        {role.permissions.length === 0 ? (
                          <span className="text-[var(--muted)]">No permissions</span>
                        ) : (
                          <div className="flex max-w-md flex-wrap gap-1.5">
                            {role.permissions.slice(0, 4).map((permission) => (
                              <span
                                key={permission.id}
                                className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]"
                              >
                                {permission.name}
                              </span>
                            ))}
                            {role.permissions.length > 4 ? (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                +{role.permissions.length - 4}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[var(--muted)]">{formatDate(role.updated_at)}</td>
                      <td className="px-6 py-4 sm:px-8">
                        <div className="flex justify-end gap-2">
                          <Button
                            as="span"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Edit role"
                            title="Edit"
                            disabled={deletingRoleId === role.id}
                            onClick={() => {
                              setEditingRole(role);
                              setName(role.name);
                              setSelectedPermissions(role.permissions.map((permission) => permission.name));
                              setFormError(null);
                              setIsRoleSectionOpen(true);
                            }}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            as="span"
                            variant="danger-soft"
                            size="icon-sm"
                            aria-label="Delete role"
                            title="Delete"
                            disabled={deletingRoleId === role.id}
                            onClick={() => void handleDelete(role)}
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

function RolesPageFallback() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Roles</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Manage roles and their permission access.</p>
        </div>
      </section>
    </main>
  );
}

export default function RolesPage() {
  return (
    <Suspense fallback={<RolesPageFallback />}>
      <RolesPageContent />
    </Suspense>
  );
}
