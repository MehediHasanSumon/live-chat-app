"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  const [email] = useState(searchParams.get("email")?.trim() ?? "");
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
          <form className="mt-7 space-y-4" onSubmit={handleSubmit} noValidate>
            <label className="block">
              <FieldLabel>Email</FieldLabel>
              <TextInput
                type="email"
                value={email}
                disabled
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

            {verifyResetCode.error instanceof ApiClientError && Object.keys(serverErrors).length === 0 ? (
              <p className="text-sm text-[#b42318]">{verifyResetCode.error.message}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={verifyResetCode.isPending}>
              {verifyResetCode.isPending ? "Verifying..." : "Verify code"}
            </Button>
          </form>
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
