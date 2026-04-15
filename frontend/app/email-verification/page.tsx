"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import { useAuthMeQuery } from "@/lib/hooks/use-auth-me-query";
import { useLogoutMutation, useSendEmailVerificationCodeMutation, useVerifyEmailCodeMutation } from "@/lib/hooks/use-auth-mutations";
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
  const fieldErrors = useMemo(
    () => (verifyCode.error instanceof ApiClientError ? verifyCode.error.errors ?? {} : {}),
    [verifyCode.error],
  );
  const email = authMe?.data.user?.email ?? "your email";

  async function handleSendCode() {
    setNotice(null);

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

    try {
      await verifyCode.mutateAsync({ code });
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

  return (
    <main className="shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="glass-card w-full max-w-xl overflow-hidden rounded-[1rem]">
        <AuthFormShell
          eyebrow="Email verification"
          title="Verify your email"
          description={`Enter the 6 digit code sent to ${email}.`}
          footerText="Wrong account?"
          footerHref="/login"
          footerLinkLabel="Sign in again"
        >
          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <FieldLabel>Verification code</FieldLabel>
              <TextInput
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
              />
              {fieldErrors.code ? <p className="mt-2 text-sm text-[#b42318]">{fieldErrors.code[0]}</p> : null}
            </label>

            {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
            {sendCode.error instanceof ApiClientError ? <p className="text-sm text-[#b42318]">{sendCode.error.message}</p> : null}
            {verifyCode.error instanceof ApiClientError && !fieldErrors.code ? (
              <p className="text-sm text-[#b42318]">{verifyCode.error.message}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={verifyCode.isPending || code.length !== 6}>
              {verifyCode.isPending ? "Verifying..." : "Verify email"}
            </Button>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="flex-1 rounded-full" disabled={sendCode.isPending} onClick={() => void handleSendCode()}>
                {sendCode.isPending ? "Sending..." : "Send code"}
              </Button>
              <Button type="button" variant="ghost" className="flex-1 rounded-full" disabled={logout.isPending} onClick={() => void handleLogout()}>
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
