"use client";

import Link from "next/link";
import Image from "next/image";
import { Settings, ShieldCheck, UserRound } from "lucide-react";

import { BoneyardSkeleton, PanelSkeleton } from "@/components/ui/boneyard-loading";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";

function getInitials(name: string, username: string) {
  const parts = name.split(" ").map((part) => part.trim()).filter(Boolean);
  return parts.length === 0 ? username.slice(0, 2).toUpperCase() : parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] py-3 last:border-0 last:pb-0 first:pt-0">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-right text-sm font-medium text-[#27304d]">{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { data, isLoading } = useAuthMeQuery(true);
  const user = data?.data.user;
  const displayName = user?.name?.trim() || user?.username || "Guest User";
  const displayUsername = user?.username ? `@${user.username}` : "@guest";
  const avatarUrl = user?.avatar_object?.download_url ?? null;
  const initials = getInitials(displayName, user?.username ?? "GU");

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto w-full max-w-4xl rounded-[1.5rem] p-6 sm:p-8">
        <BoneyardSkeleton name="profile-page" loading={isLoading || !user} fallback={<PanelSkeleton lines={8} />}>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={`${displayName} avatar`}
                    width={80}
                    height={80}
                    unoptimized
                    className="h-20 w-20 rounded-[1.5rem] object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[linear-gradient(135deg,#111827,#334155)] text-2xl font-semibold text-white">
                    {initials}
                  </div>
                )}

                <div>
                  <p className="text-2xl font-semibold tracking-tight text-[#1f2440]">{displayName}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{displayUsername}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{user?.email_verified_at ? "Verified email" : "Verification pending"}</span>
                    <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">{user?.status ?? "active"}</span>
                  </div>
                </div>
              </div>

              <Link href="/settings" className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]">
                <Settings className="h-4 w-4" />
                Account settings
              </Link>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <section className="rounded-[1.3rem] border border-[var(--line)] bg-white/75 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#1f2440]">Basic info</h2>
                    <p className="text-sm text-[var(--muted)]">Current account identity.</p>
                  </div>
                </div>

                <div className="mt-5">
                  <Row label="Full name" value={displayName} />
                  <Row label="Username" value={displayUsername} />
                  <Row label="Email" value={user?.email ?? "Not added"} />
                  <Row label="Phone" value={user?.phone ?? "Not added"} />
                </div>
              </section>

              <section className="rounded-[1.3rem] border border-[var(--line)] bg-white/75 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#1f2440]">Account status</h2>
                    <p className="text-sm text-[var(--muted)]">Security and presence details.</p>
                  </div>
                </div>

                <div className="mt-5">
                  <Row label="Email verification" value={user?.email_verified_at ? "Verified" : "Pending"} />
                  <Row label="Last active" value={formatDateTime(user?.last_seen_at ?? null)} />
                  <Row label="Avatar" value={user?.avatar_object_id ? `Uploaded (#${user.avatar_object_id})` : "Not added"} />
                  <Row label="Status" value={user?.status ?? "active"} />
                </div>
              </section>
            </div>
          </div>
        </BoneyardSkeleton>
      </section>
    </main>
  );
}
