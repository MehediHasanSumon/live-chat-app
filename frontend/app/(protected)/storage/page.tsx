"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CheckboxInput } from "@/components/ui/checkbox-input";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import {
  useExemptStorageObjectMutation,
  useRemoveExemptionMutation,
  useRunStorageCleanupMutation,
  useStorageCleanupPreviewMutation,
  useStoragePolicyQuery,
  useStorageUsageQuery,
  useUpdateStoragePolicyMutation,
} from "@/lib/hooks/use-storage-admin";
import { type StoragePolicy } from "@/lib/storage-admin";

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = -1;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

export default function AdminStoragePage() {
  const { data: policy, isLoading: isPolicyLoading } = useStoragePolicyQuery();
  const { data: usage, isLoading: isUsageLoading } = useStorageUsageQuery();
  const updatePolicyMutation = useUpdateStoragePolicyMutation();
  const previewCleanupMutation = useStorageCleanupPreviewMutation();
  const runCleanupMutation = useRunStorageCleanupMutation();
  const exemptMutation = useExemptStorageObjectMutation();
  const removeExemptionMutation = useRemoveExemptionMutation();

  const [formState, setFormState] = useState<Partial<StoragePolicy>>({});
  const [selectedRuleKey, setSelectedRuleKey] = useState<"large_after_7d" | "small_after_30d">("large_after_7d");

  const resolvedField = <K extends keyof StoragePolicy>(key: K): StoragePolicy[K] | "" => {
    if (formState[key] !== undefined) {
      return formState[key] as StoragePolicy[K];
    }

    if (policy) {
      return policy[key];
    }

    return "";
  };
  const largeDeleteAfterDays = Number(resolvedField("large_file_delete_after_days") || 7);
  const smallDeleteAfterDays = Number(resolvedField("small_file_delete_after_days") || 30);

  const preview = previewCleanupMutation.data?.data;
  const latestRun = runCleanupMutation.data?.data;
  const updateError =
    updatePolicyMutation.error instanceof ApiClientError
      ? updatePolicyMutation.error.message
      : null;

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto w-full max-w-6xl rounded-[1.5rem] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-[#2d3150]">Storage Configuration</p>
            <p className="text-sm text-[var(--muted)]">
              Manage retention, preview cleanup, and review live attachment usage.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-5">
            <div>
              <h2 className="text-base font-semibold text-[#2d3150]">Policy</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Tune storage cap and cleanup windows for large and small files.
              </p>
            </div>

            {isPolicyLoading ? (
              <p className="mt-4 text-sm text-[var(--muted)]">Loading storage policy...</p>
            ) : null}

            {policy ? (
              <form
                className="mt-5 grid gap-4 sm:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await updatePolicyMutation.mutateAsync(formState);
                }}
              >
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">Global cap bytes</span>
                  <TextInput
                    value={String(resolvedField("global_cap_bytes"))}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        global_cap_bytes: Number(event.target.value || 0),
                      }))
                    }
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">Large file threshold bytes</span>
                  <TextInput
                    value={String(resolvedField("large_file_threshold_bytes"))}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        large_file_threshold_bytes: Number(event.target.value || 0),
                      }))
                    }
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">Large file delete after days</span>
                  <TextInput
                    value={String(resolvedField("large_file_delete_after_days"))}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        large_file_delete_after_days: Number(event.target.value || 0),
                      }))
                    }
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">Small file delete after days</span>
                  <TextInput
                    value={String(resolvedField("small_file_delete_after_days"))}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        small_file_delete_after_days: Number(event.target.value || 0),
                      }))
                    }
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">Small file threshold bytes</span>
                  <TextInput
                    value={String(resolvedField("small_file_threshold_bytes"))}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        small_file_threshold_bytes: Number(event.target.value || 0),
                      }))
                    }
                  />
                </label>

                <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)]/40 p-4 sm:col-span-2">
                  <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                    <CheckboxInput
                      checked={Boolean(resolvedField("auto_cleanup_enabled"))}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          auto_cleanup_enabled: event.target.checked,
                        }))
                      }
                    />
                    Auto cleanup enabled
                  </label>

                  <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                    <CheckboxInput
                      checked={Boolean(resolvedField("large_file_rule_enabled"))}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          large_file_rule_enabled: event.target.checked,
                        }))
                      }
                    />
                    Large file rule enabled
                  </label>

                  <label className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                    <CheckboxInput
                      checked={Boolean(resolvedField("small_file_rule_enabled"))}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          small_file_rule_enabled: event.target.checked,
                        }))
                      }
                    />
                    Small file rule enabled
                  </label>
                </div>

                {updateError ? (
                  <p className="text-sm text-rose-500 sm:col-span-2">{updateError}</p>
                ) : null}

                <div className="sm:col-span-2">
                  <Button type="submit" disabled={updatePolicyMutation.isPending}>
                    {updatePolicyMutation.isPending ? "Saving..." : "Save policy"}
                  </Button>
                </div>
              </form>
            ) : null}
          </section>

          <section className="space-y-5">
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-5">
              <h2 className="text-base font-semibold text-[#2d3150]">Usage</h2>

              {isUsageLoading ? (
                <p className="mt-4 text-sm text-[var(--muted)]">Loading usage...</p>
              ) : usage ? (
                <dl className="mt-4 grid gap-3">
                  <div>
                    <dt className="text-sm text-[var(--muted)]">Live objects</dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">{usage.live_object_count}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-[var(--muted)]">Live bytes</dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">{formatBytes(usage.live_bytes)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-[var(--muted)]">Deleted bytes total</dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                      {formatBytes(usage.deleted_bytes_total)}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>

            <div className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-5">
              <h2 className="text-base font-semibold text-[#2d3150]">Cleanup</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Preview candidates before you run the cleanup job.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { key: "large_after_7d", label: `Large > ${largeDeleteAfterDays} days` },
                  { key: "small_after_30d", label: `Small > ${smallDeleteAfterDays} days` },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedRuleKey(option.key as "large_after_7d" | "small_after_30d")}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${selectedRuleKey === option.key
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--accent-soft)] text-[var(--foreground)]"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  onClick={async () => {
                    await previewCleanupMutation.mutateAsync({ rule_key: selectedRuleKey, limit: 20 });
                  }}
                  disabled={previewCleanupMutation.isPending}
                >
                  {previewCleanupMutation.isPending ? "Previewing..." : "Preview cleanup"}
                </Button>

                <Button
                  onClick={async () => {
                    await runCleanupMutation.mutateAsync({ rule_key: selectedRuleKey });
                    await previewCleanupMutation.mutateAsync({ rule_key: selectedRuleKey, limit: 20 });
                  }}
                  disabled={runCleanupMutation.isPending}
                >
                  {runCleanupMutation.isPending ? "Running..." : "Run cleanup"}
                </Button>
              </div>

              {latestRun ? (
                <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)]/40 p-4 text-sm text-[var(--foreground)]">
                  Last run: scanned {latestRun.objects_scanned}, deleted {latestRun.objects_deleted}, freed{" "}
                  {formatBytes(latestRun.bytes_freed)}.
                </div>
              ) : null}

              {preview ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-[var(--line)] bg-white p-4 text-sm text-[var(--foreground)]">
                    Preview found {preview.objects_scanned} eligible object(s), estimated free space{" "}
                    {formatBytes(preview.bytes_freed)}.
                  </div>

                  {preview.objects.map((object) => (
                    <div key={object.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{object.display_name}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {object.media_kind} - {formatBytes(object.size_bytes)} - delete eligible{" "}
                            {object.delete_eligible_at ?? "n/a"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            retention: {object.retention_mode}
                            {object.is_expired ? ` - ${object.placeholder_text}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {object.retention_mode === "exempt" ? (
                            <Button
                              variant="ghost"
                              onClick={async () => {
                                await removeExemptionMutation.mutateAsync(object.id);
                                await previewCleanupMutation.mutateAsync({ rule_key: selectedRuleKey, limit: 20 });
                              }}
                              disabled={removeExemptionMutation.isPending}
                            >
                              Remove exemption
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              onClick={async () => {
                                await exemptMutation.mutateAsync(object.id);
                                await previewCleanupMutation.mutateAsync({ rule_key: selectedRuleKey, limit: 20 });
                              }}
                              disabled={exemptMutation.isPending}
                            >
                              Exempt file
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
