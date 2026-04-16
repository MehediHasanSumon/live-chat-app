"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MailCheck, ShieldCheck } from "lucide-react";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import { useForgotPasswordMutation } from "@/lib/hooks/use-auth-mutations";

function ForgotPasswordPageContent() {
  const router = useRouter();
  const forgotPassword = useForgotPasswordMutation();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fieldErrors = useMemo(
    () => (forgotPassword.error instanceof ApiClientError ? forgotPassword.error.errors ?? {} : {}),
    [forgotPassword.error],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setEmailError("Email is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setEmailError(null);

    try {
      const response = await forgotPassword.mutateAsync({ email: normalizedEmail });
      setNotice(response.message);
      router.push(`/reset-password?email=${encodeURIComponent(normalizedEmail)}`);
    } catch {
      // Mutation state renders validation feedback.
    }
  }

  return (
    <main className="shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="glass-card w-full max-w-xl overflow-hidden rounded-[1rem]">
        <AuthFormShell
          eyebrow="Password help"
          title="Get a reset code"
          description="Enter your account email and we will send a 6 digit verification code."
          footerText="Remembered it?"
          footerHref="/login"
          footerLinkLabel="Sign in"
        >
          <div className="mt-7 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="surface soft-hover rounded-[1.25rem] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <MailCheck className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-semibold text-[#2c3353]">Request a fresh code</p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">We will send a one time code to the email tied to your account.</p>
              </div>

              <div className="surface soft-hover rounded-[1.25rem] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-semibold text-[#2c3353]">Keep the flow moving</p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">After verification, you will continue straight to choosing a brand new password.</p>
              </div>
            </div>

            <form className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-white/70 p-4 sm:p-5" onSubmit={handleSubmit} noValidate>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#2c3353]">Account recovery</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Use the same email address you signed up with.</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Step 1
                </span>
              </div>

              <label className="block">
                <FieldLabel>Email</FieldLabel>
                <TextInput
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailError(null);
                  }}
                  aria-invalid={emailError || fieldErrors.email ? "true" : "false"}
                  placeholder="mehedi@example.com"
                  autoComplete="email"
                />
                {emailError || fieldErrors.email ? (
                  <p className="mt-2 text-sm text-[#b42318]">{emailError ?? fieldErrors.email?.[0]}</p>
                ) : null}
              </label>

              {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
              {forgotPassword.error instanceof ApiClientError && !fieldErrors.email ? (
                <p className="text-sm text-[#b42318]">{forgotPassword.error.message}</p>
              ) : null}

              <Button type="submit" className="w-full gap-2" disabled={forgotPassword.isPending}>
                {forgotPassword.isPending ? "Sending code..." : "Send reset code"}
                {!forgotPassword.isPending ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-dashed border-[rgba(96,91,255,0.22)] bg-[rgba(255,255,255,0.55)] px-4 py-3 text-sm text-[var(--muted)]">
              <p>Already received a code? Continue to verification.</p>
              <Link href="/reset-password" className="font-semibold text-[var(--accent)]">
                Verify code
              </Link>
            </div>
          </div>
        </AuthFormShell>
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}
