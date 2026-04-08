"use client";

import Link from "next/link";

import { useAdminOpsHealthQuery, useAdminOpsStatusQuery } from "@/lib/hooks/use-admin-ops";

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

export default function AdminOpsPage() {
  const { data: health, isLoading: isHealthLoading } = useAdminOpsHealthQuery(true);
  const { data: status, isLoading: isStatusLoading } = useAdminOpsStatusQuery(true);

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto w-full max-w-6xl rounded-[1.5rem] px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-[#2d3150]">Admin ops</p>
            <p className="text-sm text-[var(--muted)]">Quick health checks for queue, notifications, storage, Reverb, LiveKit, and Horizon.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/storage"
              className="rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--foreground)]"
            >
              Storage admin
            </Link>
            <Link
              href="/messages"
              className="rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--foreground)]"
            >
              Back to messages
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-5">
            <h2 className="text-base font-semibold text-[#2d3150]">Health</h2>
            {isHealthLoading || !health ? (
              <p className="mt-4 text-sm text-[var(--muted)]">Loading health status...</p>
            ) : (
              <div className="mt-4 space-y-2 text-sm text-[var(--foreground)]">
                <p>Overall status: {health.overall_status}</p>
                {Object.entries(health.services).map(([service, payload]) => (
                  <p key={service}>
                    {service}: {String(payload.status)}
                  </p>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-5">
            <h2 className="text-base font-semibold text-[#2d3150]">Queue</h2>
            {isStatusLoading || !status ? (
              <p className="mt-4 text-sm text-[var(--muted)]">Loading queue metrics...</p>
            ) : (
              <div className="mt-4 space-y-2 text-sm text-[var(--foreground)]">
                <p>Connection: {status.queues.connection}</p>
                <p>Failed jobs: {status.queues.failed_jobs}</p>
                {Object.entries(status.queues.pending_jobs).map(([queue, count]) => (
                  <p key={queue}>
                    {queue}: {count}
                  </p>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-5">
            <h2 className="text-base font-semibold text-[#2d3150]">Realtime & calls</h2>
            {isStatusLoading || !status ? (
              <p className="mt-4 text-sm text-[var(--muted)]">Loading realtime status...</p>
            ) : (
              <div className="mt-4 space-y-2 text-sm text-[var(--foreground)]">
                <p>Reverb configured: {status.reverb.configured ? "Yes" : "No"}</p>
                <p>LiveKit configured: {status.livekit.configured ? "Yes" : "No"}</p>
                <p>Active calls: {status.calls.active}</p>
                <p>Ended calls: {status.calls.ended}</p>
              </div>
            )}
          </section>

          <section className="rounded-[1.25rem] border border-[var(--line)] bg-white/75 p-5">
            <h2 className="text-base font-semibold text-[#2d3150]">Storage & Horizon</h2>
            {isStatusLoading || !status ? (
              <p className="mt-4 text-sm text-[var(--muted)]">Loading storage metrics...</p>
            ) : (
              <div className="mt-4 space-y-2 text-sm text-[var(--foreground)]">
                <p>Live objects: {status.storage.usage.live_object_count}</p>
                <p>Live bytes: {formatBytes(status.storage.usage.live_bytes)}</p>
                <p>Auto cleanup: {status.storage.policy.auto_cleanup_enabled ? "Enabled" : "Disabled"}</p>
                <p>Horizon configured: {status.horizon.configured ? "Yes" : "No"}</p>
                <p>Horizon enabled: {status.horizon.enabled ? "Yes" : "No"}</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
