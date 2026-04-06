import Link from "next/link";

export default function Home() {
  return (
    <main className="shell px-4 py-6 sm:px-6">
      <nav className="glass-card mx-auto flex w-full max-w-6xl items-center justify-between rounded-[1.5rem] px-5 py-4 sm:px-6">
        <div>
          <p className="text-lg font-semibold text-[#2d3150]">Live Chat App</p>
          <p className="text-sm text-[var(--muted)]">Simple auth base</p>
        </div>

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
      </nav>
    </main>
  );
}
