"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BadgeCheck, KeyRound, Mail, ShieldEllipsis, Sparkles } from "lucide-react";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import { useVerifyResetCodeMutation } from "@/lib/hooks/use-auth-mutations";

const RESET_PASSWORD_STORAGE_KEY = "chat-app:password-reset";

type ResetPasswordSession = {
  email: string;
  code: string;
};

type FieldErrors = Partial<Record<"email" | "code", string>>;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateForm(email: string, code: string): FieldErrors {
  const errors: FieldErrors = {};

  if (!email) {
    errors.email = "Email is required. Please request a reset code again.";
  } else if (!isValidEmail(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!code) {
    errors.code = "Verification code is required.";
  } else if (!/^\d{6}$/.test(code)) {
    errors.code = "Enter the 6 digit verification code.";
  }

  return errors;
}

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifyResetCode = useVerifyResetCodeMutation();
  const [email, setEmail] = useState(searchParams.get("email")?.trim() ?? "");
  const [code, setCode] = useState("");
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const serverErrors = useMemo(
    () => (verifyResetCode.error instanceof ApiClientError ? verifyResetCode.error.errors ?? {} : {}),
    [verifyResetCode.error],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = code.trim();
    const validationErrors = validateForm(email, normalizedCode);
    setClientErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      await verifyResetCode.mutateAsync({
        email,
        code: normalizedCode,
      });

      const resetSession: ResetPasswordSession = {
        email,
        code: normalizedCode,
      };
      window.sessionStorage.setItem(RESET_PASSWORD_STORAGE_KEY, JSON.stringify(resetSession));
      router.push("/reset-password/new-password");
    } catch {
      // Mutation state renders validation feedback.
    }
  }

  const emailError = clientErrors.email ?? serverErrors.email?.[0];
  const codeError = clientErrors.code ?? serverErrors.code?.[0];

  return (
    <main className="shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="glass-card w-full max-w-xl overflow-hidden rounded-[1rem]">
        <AuthFormShell
          eyebrow="Reset password"
          title="Enter your code"
          description="Use the 6 digit code from your email to continue."
          footerText="Need another code?"
          footerHref="/forgot-password"
          footerLinkLabel="Send again"
        >
          <div className="mt-7 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="surface rounded-[1.1rem] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#2c3353]">
                  <Mail className="h-4 w-4 text-[var(--accent)]" />
                  Email
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Confirm the address where the code was sent.</p>
              </div>

              <div className="surface rounded-[1.1rem] border-[rgba(96,91,255,0.16)] bg-[rgba(96,91,255,0.06)] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#2c3353]">
                  <KeyRound className="h-4 w-4 text-[var(--accent)]" />
                  Code
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Enter the 6 digit verification code to unlock the next step.</p>
              </div>

              <div className="surface rounded-[1.1rem] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#2c3353]">
                  <BadgeCheck className="h-4 w-4 text-emerald-600" />
                  Password
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">You will immediately continue to set a new password.</p>
              </div>
            </div>

            <form className="space-y-5 rounded-[1.4rem] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(250,251,255,0.88)_100%)] p-4 shadow-[0_18px_40px_rgba(96,109,160,0.08)] sm:p-6" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#2c3353]">Verification details</p>
                  <p className="mt-1 max-w-md text-xs leading-5 text-[var(--muted)]">If you opened this page directly, just enter your email and code manually.</p>
                </div>
                <div className="inline-flex w-fit items-center gap-2 self-start whitespace-nowrap rounded-full border border-[rgba(96,91,255,0.14)] bg-[linear-gradient(135deg,rgba(96,91,255,0.12)_0%,rgba(125,168,255,0.14)_100%)] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)] shadow-[0_10px_24px_rgba(96,91,255,0.12)]">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Step 2</span>
                </div>
              </div>

              <label className="block">
                <FieldLabel>Email</FieldLabel>
                <TextInput
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setClientErrors((current) => ({ ...current, email: undefined }));
                  }}
                  aria-invalid={emailError ? "true" : "false"}
                  autoComplete="email"
                  placeholder="mehedi@example.com"
                />
                {emailError ? <p className="mt-2 text-sm text-[#b42318]">{emailError}</p> : null}
              </label>

              <label className="block">
                <FieldLabel>Verification code</FieldLabel>
                <TextInput
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setClientErrors((current) => ({ ...current, code: undefined }));
                  }}
                  aria-invalid={codeError ? "true" : "false"}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                />
                {codeError ? <p className="mt-2 text-sm text-[#b42318]">{codeError}</p> : null}
              </label>

              <div className="rounded-[1rem] border border-dashed border-[rgba(16,185,129,0.22)] bg-[linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(240,253,248,0.9)_100%)] px-4 py-3 text-sm text-emerald-800">
                <div className="flex items-start gap-2">
                  <ShieldEllipsis className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Use the latest code from your inbox. Sending a new code usually invalidates the older one.</p>
                </div>
              </div>

              {verifyResetCode.error instanceof ApiClientError && Object.keys(serverErrors).length === 0 ? (
                <p className="text-sm text-[#b42318]">{verifyResetCode.error.message}</p>
              ) : null}

              <Button type="submit" className="w-full gap-2" disabled={verifyResetCode.isPending}>
                {verifyResetCode.isPending ? "Verifying..." : "Verify code"}
                {!verifyResetCode.isPending ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </form>

            <div className="flex flex-col items-start gap-2 rounded-[1.25rem] border border-dashed border-[rgba(96,91,255,0.22)] bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(248,249,255,0.72)_100%)] px-4 py-4 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p className="leading-6">Need another code or used the wrong email?</p>
              <Link href="/forgot-password" className="font-semibold text-[var(--accent)]">
                Request new code
              </Link>
            </div>
          </div>
        </AuthFormShell>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
