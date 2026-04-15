"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import {
  useLogoutMutation,
  useSendEmailVerificationCodeMutation,
  useVerifyEmailCodeMutation,
} from "@/lib/hooks/use-auth-mutations";
import { queryKeys } from "@/lib/query-keys";

function EmailVerificationPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: authMe } = useAuthMeQuery(true);
  const sendCode = useSendEmailVerificationCodeMutation();
  const verifyCode = useVerifyEmailCodeMutation();
  const logout = useLogoutMutation();
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const fieldErrors = useMemo(
    () => (verifyCode.error instanceof ApiClientError ? verifyCode.error.errors ?? {} : {}),
    [verifyCode.error],
  );
  const email = authMe?.data.user?.email ?? "";

  async function handleSendCode() {
    setNotice(null);
    setClientError(null);

    try {
      const response = await sendCode.mutateAsync();
      setNotice(response.message);
    } catch {
      // Mutation state renders feedback.
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const normalizedCode = code.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      setClientError("Enter the 6 digit verification code.");
      return;
    }

    setClientError(null);

    try {
      await verifyCode.mutateAsync({ code: normalizedCode });
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      window.location.assign(searchParams.get("redirect") || "/dashboard");
    } catch {
      // Mutation state renders validation feedback.
    }
  }

  async function handleLogout() {
    await logout.mutateAsync();
    window.location.assign("/login");
  }

  const codeError = clientError ?? fieldErrors.code?.[0];

  return (
    <main className="shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="glass-card w-full max-w-xl overflow-hidden rounded-[1rem]">
        <AuthFormShell
          eyebrow="Email verification"
          title="Verify your email"
          description="A verified email is required before you can continue."
        >
          <div className="mt-7 flex items-start gap-3 rounded-lg border border-[var(--line)] bg-white/75 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Mail className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#2d3150]">Verification code sent to</p>
              <p className="mt-1 break-all text-sm leading-6 text-[var(--muted)]">{email || "your account email"}</p>
            </div>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
            <label className="block">
              <FieldLabel>Verification code</FieldLabel>
              <TextInput
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setClientError(null);
                }}
                className="h-11 text-base tracking-[0.28em]"
                aria-invalid={codeError ? "true" : "false"}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
              />
              {codeError ? <p className="mt-2 text-sm text-[#b42318]">{codeError}</p> : null}
            </label>

            {notice ? (
              <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {notice}
              </p>
            ) : null}
            {sendCode.error instanceof ApiClientError ? (
              <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-[#b42318]">
                {sendCode.error.message}
              </p>
            ) : null}
            {verifyCode.error instanceof ApiClientError && !fieldErrors.code ? (
              <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-[#b42318]">
                {verifyCode.error.message}
              </p>
            ) : null}

            <Button type="submit" className="h-11 w-full gap-2" disabled={verifyCode.isPending || code.length !== 6}>
              <ShieldCheck className="h-4 w-4" />
              {verifyCode.isPending ? "Verifying..." : "Verify email"}
            </Button>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2 rounded-md"
                disabled={sendCode.isPending}
                onClick={() => void handleSendCode()}
              >
                <RefreshCw className="h-4 w-4" />
                {sendCode.isPending ? "Sending..." : "Send code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10 gap-2 rounded-md"
                disabled={logout.isPending}
                onClick={() => void handleLogout()}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </form>
        </AuthFormShell>
      </div>
    </main>
  );
}

export default function EmailVerificationPage() {
  return (
    <Suspense fallback={null}>
      <EmailVerificationPageContent />
    </Suspense>
  );
}
