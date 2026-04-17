"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { PencilLine, Plus, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { BoneyardSkeleton, PanelSkeleton, TableSkeleton } from "@/components/ui/boneyard-loading";
import { CheckboxInput } from "@/components/ui/checkbox-input";
import { Pagination } from "@/components/ui/pagination";
import { RadioInput } from "@/components/ui/radio-input";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import {
  AdminUserRecord,
  AdminUserStatus,
  useAdminRoleOptionsQuery,
  useAdminUsersQuery,
  useCreateAdminUserMutation,
  useDeleteAdminUserMutation,
  useUpdateAdminUserMutation,
} from "@/lib/hooks/use-admin-users";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const PER_PAGE_OPTIONS = [5, 10, 20, 30, 50];
const USER_STATUSES: AdminUserStatus[] = ["active", "suspended", "deleted"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UserFormState = {
  name: string;
  email: string;
  phone: string;
  email_verified: boolean;
  password: string;
  password_confirmation: string;
  status: AdminUserStatus;
};

function createEmptyForm(): UserFormState {
  return {
    name: "",
    email: "",
    phone: "",
    email_verified: false,
    password: "",
    password_confirmation: "",
    status: "active",
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not verified";
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

function UsersPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("per_page"));
  const search = parseSearchParam(searchParams.get("search"));
  const { data: usersResponse, isLoading, error } = useAdminUsersQuery({ page, perPage, search }, true);
  const { data: roleOptions = [], isLoading: isRoleOptionsLoading } = useAdminRoleOptionsQuery(true);
  const users = usersResponse?.data ?? [];
  const paginationMeta = usersResponse?.meta;
  const createUser = useCreateAdminUserMutation();
  const updateUser = useUpdateAdminUserMutation();
  const deleteUser = useDeleteAdminUserMutation();
  const [searchDraft, setSearchDraft] = useState(search);
  const [form, setForm] = useState<UserFormState>(() => createEmptyForm());
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUserSectionOpen, setIsUserSectionOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  const isSubmitting = createUser.isPending || updateUser.isPending;

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

  function updateFormValue<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
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

  function closeUserSection() {
    setIsUserSectionOpen(false);
    setForm(createEmptyForm());
    setSelectedRoles([]);
    setEditingUser(null);
    setFormError(null);
  }

  function openCreateSection() {
    setIsUserSectionOpen(true);
    setForm(createEmptyForm());
    setSelectedRoles([]);
    setEditingUser(null);
    setFormError(null);
  }

  function openEditSection(user: AdminUserRecord) {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      email_verified: Boolean(user.email_verified_at),
      password: "",
      password_confirmation: "",
      status: user.status,
    });
    setSelectedRoles(user.roles.map((role) => role.name));
    setFormError(null);
    setIsUserSectionOpen(true);
  }

  function toggleRole(roleName: string) {
    setSelectedRoles((current) =>
      current.includes(roleName) ? current.filter((selectedRole) => selectedRole !== roleName) : [...current, roleName].sort(),
    );
  }

  function validateForm() {
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const password = form.password;

    if (!name) {
      return "Name is required.";
    }

    if (name.length > 80) {
      return "Name must be 80 characters or fewer.";
    }

    if (!email) {
      return "Email is required.";
    }

    if (!emailPattern.test(email)) {
      return "Enter a valid email address.";
    }

    if (email.length > 120) {
      return "Email must be 120 characters or fewer.";
    }

    if (phone.length > 20) {
      return "Phone must be 20 characters or fewer.";
    }

    if (!editingUser && password.length < 8) {
      return "Password must be at least 8 characters.";
    }

    if (editingUser && password && password.length < 8) {
      return "Password must be at least 8 characters.";
    }

    if (password !== form.password_confirmation) {
      return "Password confirmation does not match.";
    }

    if (!USER_STATUSES.includes(form.status)) {
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

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        email_verified: form.email_verified,
        password: form.password,
        password_confirmation: form.password_confirmation,
        status: form.status,
        roles: selectedRoles,
      };

      if (editingUser) {
        await updateUser.mutateAsync({
          userId: editingUser.id,
          payload,
        });
      } else {
        await createUser.mutateAsync(payload);
      }

      closeUserSection();
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(
          submissionError.errors?.name?.[0] ??
            submissionError.errors?.email?.[0] ??
            submissionError.errors?.phone?.[0] ??
            submissionError.errors?.email_verified?.[0] ??
            submissionError.errors?.password?.[0] ??
            submissionError.errors?.status?.[0] ??
            submissionError.errors?.roles?.[0] ??
            submissionError.errors?.["roles.0"]?.[0] ??
            submissionError.message,
        );
        return;
      }

      setFormError("Unable to save the user right now.");
    }
  }

  async function handleDelete(user: AdminUserRecord) {
    if (!window.confirm(`Delete user "${user.name}"?`)) {
      return;
    }

    setFormError(null);

    try {
      setDeletingUserId(user.id);
      await deleteUser.mutateAsync(user.id);

      if (editingUser?.id === user.id) {
        closeUserSection();
      }
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(submissionError.message);
        return;
      }

      setFormError("Unable to delete the user right now.");
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Users</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Manage users, status, and role access.</p>
          </div>

          <Button
            className="gap-2 self-start rounded-full px-5 sm:self-center"
            aria-controls="user-form-section"
            aria-expanded={isUserSectionOpen}
            onClick={() => {
              if (isUserSectionOpen) {
                closeUserSection();
                return;
              }

              openCreateSection();
            }}
          >
            {isUserSectionOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isUserSectionOpen ? "Close" : "Create User"}
          </Button>
        </div>
      </section>

      <div
        className={cn(
          "mx-auto w-full max-w-[1328px] overflow-hidden transition-all duration-300 ease-out",
          isUserSectionOpen ? "mt-5 max-h-[960px] translate-y-0 opacity-100" : "mt-0 max-h-0 -translate-y-2 opacity-0",
        )}
      >
        <section id="user-form-section" aria-hidden={!isUserSectionOpen} className="glass-card overflow-hidden rounded-[1.5rem]">
          <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
            <h2 className="text-xl font-semibold text-[#1f2440]">{editingUser ? "Edit User" : "Create User"}</h2>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-5 px-6 py-6 sm:px-8">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Name</label>
                  <TextInput
                    placeholder="Sumon Ahmed"
                    value={form.name}
                    onChange={(event) => updateFormValue("name", event.target.value)}
                    autoComplete="off"
                    disabled={!isUserSectionOpen || isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Email</label>
                  <TextInput
                    type="email"
                    placeholder="sumon@example.com"
                    value={form.email}
                    onChange={(event) => updateFormValue("email", event.target.value)}
                    autoComplete="off"
                    disabled={!isUserSectionOpen || isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Phone</label>
                  <TextInput
                    placeholder="+8801700000000"
                    value={form.phone}
                    onChange={(event) => updateFormValue("phone", event.target.value)}
                    autoComplete="off"
                    disabled={!isUserSectionOpen || isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Password</label>
                  <TextInput
                    type="password"
                    placeholder={editingUser ? "Leave blank to keep current" : "At least 8 characters"}
                    value={form.password}
                    onChange={(event) => updateFormValue("password", event.target.value)}
                    autoComplete="new-password"
                    disabled={!isUserSectionOpen || isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Confirm password</label>
                  <TextInput
                    type="password"
                    placeholder={editingUser ? "Leave blank to keep current" : "Confirm password"}
                    value={form.password_confirmation}
                    onChange={(event) => updateFormValue("password_confirmation", event.target.value)}
                    autoComplete="new-password"
                    disabled={!isUserSectionOpen || isSubmitting}
                  />
                </div>
              </div>

              <div className="grid gap-4 rounded-lg border border-[var(--line)] bg-white/70 p-4 md:grid-cols-2">
                <div>
                  <p className="mb-3 text-sm font-semibold text-[#2d3150]">Email verified</p>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-[#2d3150]">
                      <RadioInput
                        name="email_verified"
                        checked={form.email_verified}
                        disabled={!isUserSectionOpen || isSubmitting}
                        onChange={() => updateFormValue("email_verified", true)}
                      />
                      Verified
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[#2d3150]">
                      <RadioInput
                        name="email_verified"
                        checked={!form.email_verified}
                        disabled={!isUserSectionOpen || isSubmitting}
                        onChange={() => updateFormValue("email_verified", false)}
                      />
                      Not verified
                    </label>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-semibold text-[#2d3150]">Status</p>
                  <div className="flex flex-wrap items-center gap-4">
                    {USER_STATUSES.map((status) => (
                      <label key={status} className="flex items-center gap-2 text-sm capitalize text-[#2d3150]">
                        <RadioInput
                          name="status"
                          checked={form.status === status}
                          disabled={!isUserSectionOpen || isSubmitting}
                          onChange={() => updateFormValue("status", status)}
                        />
                        {status}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#2d3150]">Roles</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{selectedRoles.length} selected</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 rounded-full border border-[var(--line)] bg-white px-3 text-xs text-[var(--foreground)] hover:bg-white"
                      disabled={!isUserSectionOpen || isSubmitting || roleOptions.length === 0}
                      onClick={() => setSelectedRoles(roleOptions.map((role) => role.name))}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 rounded-full border border-[var(--line)] bg-white px-3 text-xs text-[var(--foreground)] hover:bg-white"
                      disabled={!isUserSectionOpen || isSubmitting || selectedRoles.length === 0}
                      onClick={() => setSelectedRoles([])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--line)] bg-white/70 p-4">
                  {isRoleOptionsLoading ? (
                    <BoneyardSkeleton name="user-role-options" loading={isRoleOptionsLoading} fallback={<PanelSkeleton lines={3} />}>
                      <PanelSkeleton lines={3} />
                    </BoneyardSkeleton>
                  ) : roleOptions.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No roles found yet.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {roleOptions.map((role) => (
                        <label key={role.id} className="flex items-center gap-3 text-sm text-[#2d3150]">
                          <CheckboxInput
                            checked={selectedRoles.includes(role.name)}
                            disabled={!isUserSectionOpen || isSubmitting}
                            onChange={() => toggleRole(role.name)}
                          />
                          <span className="truncate">{role.name}</span>
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
                onClick={closeUserSection}
                disabled={!isUserSectionOpen || isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-5" disabled={!isUserSectionOpen || isSubmitting}>
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
              placeholder="Search users"
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
            <BoneyardSkeleton name="users-table" loading={isLoading} fallback={<TableSkeleton columns={7} rows={6} />}>
              <TableSkeleton columns={7} rows={6} />
            </BoneyardSkeleton>
          ) : users.length === 0 ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">
              {search ? "No users matched your search." : "No users found yet."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <th className="px-6 py-4 font-semibold sm:px-8">#</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Email</th>
                    <th className="px-6 py-4 font-semibold">Phone</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Verified</th>
                    <th className="px-6 py-4 font-semibold">Roles</th>
                    <th className="px-6 py-4 font-semibold sm:px-8">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr key={user.id} className="border-b border-[var(--line)] text-sm text-[var(--foreground)] last:border-0">
                      <td className="px-6 py-4 text-[var(--muted)] sm:px-8">{(page - 1) * perPage + index + 1}</td>
                      <td className="px-6 py-4 font-medium text-[#2d3150]">{user.name}</td>
                      <td className="px-6 py-4 text-[var(--muted)]">{user.email}</td>
                      <td className="px-6 py-4 text-[var(--muted)]">{user.phone ?? "-"}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                            user.status === "active" && "bg-emerald-50 text-emerald-700",
                            user.status === "suspended" && "bg-amber-50 text-amber-700",
                            user.status === "deleted" && "bg-rose-50 text-rose-700",
                          )}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--muted)]">{formatDate(user.email_verified_at)}</td>
                      <td className="px-6 py-4">
                        {user.roles.length === 0 ? (
                          <span className="text-[var(--muted)]">No roles</span>
                        ) : (
                          <div className="flex max-w-md flex-wrap gap-1.5">
                            {user.roles.slice(0, 3).map((role) => (
                              <span
                                key={role.id}
                                className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]"
                              >
                                {role.name}
                              </span>
                            ))}
                            {user.roles.length > 3 ? (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                +{user.roles.length - 3}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 sm:px-8">
                        <div className="flex justify-end gap-2">
                          <Button
                            as="span"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Edit user"
                            title="Edit"
                            disabled={deletingUserId === user.id}
                            onClick={() => openEditSection(user)}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            as="span"
                            variant="danger-soft"
                            size="icon-sm"
                            aria-label="Delete user"
                            title="Delete"
                            disabled={deletingUserId === user.id}
                            onClick={() => void handleDelete(user)}
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

function UsersPageFallback() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Users</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Manage users, status, and role access.</p>
        </div>
      </section>
    </main>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<UsersPageFallback />}>
      <UsersPageContent />
    </Suspense>
  );
}
