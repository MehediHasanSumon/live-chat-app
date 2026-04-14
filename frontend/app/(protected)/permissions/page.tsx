"use client";

import { FormEvent, useState } from "react";
import { PencilLine, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import {
  AdminPermissionRecord,
  useAdminPermissionsQuery,
  useCreateAdminPermissionMutation,
  useDeleteAdminPermissionMutation,
  useUpdateAdminPermissionMutation,
} from "@/lib/hooks/use-admin-permissions";
import { cn } from "@/lib/utils";

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

export default function PermissionsPage() {
  const { data: permissions = [], isLoading, error } = useAdminPermissionsQuery(true);
  const createPermission = useCreateAdminPermissionMutation();
  const updatePermission = useUpdateAdminPermissionMutation();
  const deletePermission = useDeleteAdminPermissionMutation();
  const [name, setName] = useState("");
  const [editingPermission, setEditingPermission] = useState<AdminPermissionRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreateSectionOpen, setIsCreateSectionOpen] = useState(false);

  const isSubmitting = createPermission.isPending || updatePermission.isPending;

  function closeCreateSection() {
    setIsCreateSectionOpen(false);
    setName("");
    setEditingPermission(null);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const normalizedName = name.trim().toLowerCase();

    if (!normalizedName) {
      setFormError("Permission name is required.");
      return;
    }

    try {
      if (editingPermission) {
        await updatePermission.mutateAsync({
          permissionId: editingPermission.id,
          payload: { name: normalizedName },
        });
      } else {
        await createPermission.mutateAsync({ name: normalizedName });
      }

      setName("");
      setFormError(null);
      closeCreateSection();
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(submissionError.errors?.name?.[0] ?? submissionError.errors?.permission?.[0] ?? submissionError.message);
        return;
      }

      setFormError("Unable to save the permission right now.");
    }
  }

  async function handleDelete(permission: AdminPermissionRecord) {
    if (!window.confirm(`Delete permission "${permission.name}"?`)) {
      return;
    }

    setFormError(null);

    try {
      await deletePermission.mutateAsync(permission.id);

      if (editingPermission?.id === permission.id) {
        closeCreateSection();
      }
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(submissionError.errors?.permission?.[0] ?? submissionError.message);
        return;
      }

      setFormError("Unable to delete the permission right now.");
    }
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">Permissions</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Manage and organize permission access for your application.</p>
          </div>

          <Button
            className="gap-2 self-start rounded-full px-5 sm:self-center"
            aria-controls="create-permission-section"
            aria-expanded={isCreateSectionOpen}
            onClick={() => {
              if (isCreateSectionOpen) {
                closeCreateSection();
                return;
              }

              setIsCreateSectionOpen(true);
              setEditingPermission(null);
              setName("");
              setFormError(null);
            }}
          >
            {isCreateSectionOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isCreateSectionOpen ? "Close" : "Create Permission"}
          </Button>
        </div>
      </section>

      <div
        className={cn(
          "mx-auto w-full max-w-[1328px] overflow-hidden transition-all duration-300 ease-out",
          isCreateSectionOpen ? "mt-5 max-h-[320px] translate-y-0 opacity-100" : "mt-0 max-h-0 -translate-y-2 opacity-0",
        )}
      >
        <section
          id="create-permission-section"
          aria-hidden={!isCreateSectionOpen}
          className="glass-card overflow-hidden rounded-[1.5rem]"
        >
          <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
            <h2 className="text-xl font-semibold text-[#1f2440]">
              {editingPermission ? "Edit Permission" : "Create Permission"}
            </h2>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)}>
            <div className="px-6 py-6 sm:px-8">
              <TextInput
                placeholder="reports.view"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
                disabled={!isCreateSectionOpen || isSubmitting}
              />

              {formError ? <p className="mt-3 text-sm text-rose-600">{formError}</p> : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--line)] px-6 py-5 sm:px-8">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
                onClick={closeCreateSection}
                disabled={!isCreateSectionOpen || isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-5" disabled={!isCreateSectionOpen || isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </section>
      </div>

      {!error ? (
        <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] overflow-hidden rounded-[1.5rem]">
          {isLoading ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">Loading permissions...</div>
          ) : permissions.length === 0 ? (
            <div className="px-6 py-8 text-sm text-[var(--muted)] sm:px-8">No permissions found yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <th className="px-6 py-4 font-semibold sm:px-8">#</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Guard</th>
                    <th className="px-6 py-4 font-semibold">Updated</th>
                    <th className="px-6 py-4 font-semibold sm:px-8">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((permission, index) => (
                    <tr key={permission.id} className="border-b border-[var(--line)] text-sm text-[var(--foreground)] last:border-0">
                      <td className="px-6 py-4 text-[var(--muted)] sm:px-8">{index + 1}</td>
                      <td className="px-6 py-4 font-medium text-[#2d3150]">{permission.name}</td>
                      <td className="px-6 py-4 text-[var(--muted)]">{permission.guard_name}</td>
                      <td className="px-6 py-4 text-[var(--muted)]">{formatDate(permission.updated_at)}</td>
                      <td className="px-6 py-4 sm:px-8">
                        <div className="flex justify-end gap-2">
                          <Button
                          variant="ghost"
                          className="h-8 gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 text-xs text-[var(--foreground)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                          onClick={() => {
                            setEditingPermission(permission);
                            setName(permission.name);
                              setFormError(null);
                              setIsCreateSectionOpen(true);
                            }}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-3 text-xs text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45"
                          disabled={deletePermission.isPending}
                          onClick={() => void handleDelete(permission)}
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
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
