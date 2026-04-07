"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { useLogoutMutation } from "@/lib/hooks/use-auth-mutations";

export default function Home() {
  const router = useRouter();
  const { data, isLoading, isError } = useAuthMeQuery(true);
  const logoutMutation = useLogoutMutation();

  async function handleLogout() {
    await logoutMutation.mutateAsync();
    router.refresh();
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto w-full max-w-6xl rounded-[1.5rem] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-[#2d3150]">Live Chat App</p>
            <p className="text-sm text-[var(--muted)]">Session-based auth is now connected to Laravel Sanctum.</p>
          </div>

          {data?.data.user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/messages"
                className="rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--foreground)]"
              >
                Open messages
              </Link>
              <Button onClick={handleLogout} disabled={logoutMutation.isPending} className="rounded-full px-5 py-2.5">
                {logoutMutation.isPending ? "Signing out..." : "Logout"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--foreground)]"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-[1.25rem] border border-[var(--line)] bg-white/70 p-5">
          <p className="text-sm font-semibold text-[#2d3150]">Current session</p>

          {isLoading ? <p className="mt-3 text-sm text-[var(--muted)]">Loading your profile...</p> : null}

          {!isLoading && isError ? (
            <p className="mt-3 text-sm text-[var(--muted)]">No active session found. Sign in or create an account.</p>
          ) : null}

          {data?.data.user ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Name</dt>
                <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">{data.data.user.name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Username</dt>
                <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">@{data.data.user.username}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Email</dt>
                <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">{data.data.user.email ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Status</dt>
                <dd className="mt-1 text-sm font-medium text-[var(--foreground)] capitalize">{data.data.user.status}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </section>
    </main>
  );
}
