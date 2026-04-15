"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import { useResetPasswordMutation } from "@/lib/hooks/use-auth-mutations";

const RESET_PASSWORD_STORAGE_KEY = "chat-app:password-reset";

type ResetPasswordSession = {
  email: string;
  code: string;
};

type PasswordForm = {
  password: string;
  password_confirmation: string;
};

type FieldErrors = Partial<Record<keyof PasswordForm, string>>;

function readResetPasswordSession(): ResetPasswordSession | null {
  const storedSession = window.sessionStorage.getItem(RESET_PASSWORD_STORAGE_KEY);

  if (!storedSession) {
    return null;
  }

  try {
    const parsedSession = JSON.parse(storedSession) as Partial<ResetPasswordSession>;
    if (typeof parsedSession.email === "string" && typeof parsedSession.code === "string") {
      return {
        email: parsedSession.email,
        code: parsedSession.code,
      };
    }
  } catch {
    window.sessionStorage.removeItem(RESET_PASSWORD_STORAGE_KEY);
  }

  return null;
}

function validateForm(form: PasswordForm): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.password) {
    errors.password = "New password is required.";
  } else if (form.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!form.password_confirmation) {
    errors.password_confirmation = "Confirm your new password.";
  } else if (form.password !== form.password_confirmation) {
    errors.password_confirmation = "Passwords do not match.";
  }

  return errors;
}

function NewPasswordPageContent() {
  const router = useRouter();
  const resetPassword = useResetPasswordMutation();
  const [form, setForm] = useState<PasswordForm>({
    password: "",
    password_confirmation: "",
  });
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const serverErrors = useMemo(
    () => (resetPassword.error instanceof ApiClientError ? resetPassword.error.errors ?? {} : {}),
    [resetPassword.error],
  );

  useEffect(() => {
    if (!readResetPasswordSession()) {
      router.replace("/forgot-password");
    }
  }, [router]);

  function updateField<K extends keyof PasswordForm>(field: K, value: PasswordForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setClientErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);

    const validationErrors = validateForm(form);
    setClientErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const resetSession = readResetPasswordSession();
    if (!resetSession) {
      router.replace("/forgot-password");
      return;
    }

    try {
      const response = await resetPassword.mutateAsync({
        email: resetSession.email,
        code: resetSession.code,
        password: form.password,
        password_confirmation: form.password_confirmation,
      });
      window.sessionStorage.removeItem(RESET_PASSWORD_STORAGE_KEY);
      setSuccessMessage(response.message);
      setForm({ password: "", password_confirmation: "" });
    } catch {
      // Mutation state renders validation feedback.
    }
  }

  const passwordError = clientErrors.password ?? serverErrors.password?.[0];
  const confirmPasswordError = clientErrors.password_confirmation ?? serverErrors.password_confirmation?.[0];
  const resetCodeError = serverErrors.email?.[0] ?? serverErrors.code?.[0];

  return (
    <main className="shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="glass-card w-full max-w-xl overflow-hidden rounded-[1rem]">
        <AuthFormShell
          eyebrow="Reset password"
          title="Create a new password"
          description="Choose a new password for your account."
          footerText="Need another code?"
          footerHref="/forgot-password"
          footerLinkLabel="Send again"
        >
          <form className="mt-7 space-y-4" onSubmit={handleSubmit} noValidate>
            <label className="block">
              <FieldLabel>New password</FieldLabel>
              <TextInput
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                aria-invalid={passwordError ? "true" : "false"}
                autoComplete="new-password"
                placeholder="New password"
              />
              {passwordError ? <p className="mt-2 text-sm text-[#b42318]">{passwordError}</p> : null}
            </label>

            <label className="block">
              <FieldLabel>Confirm password</FieldLabel>
              <TextInput
                type="password"
                value={form.password_confirmation}
                onChange={(event) => updateField("password_confirmation", event.target.value)}
                aria-invalid={confirmPasswordError ? "true" : "false"}
                autoComplete="new-password"
                placeholder="Confirm password"
              />
              {confirmPasswordError ? <p className="mt-2 text-sm text-[#b42318]">{confirmPasswordError}</p> : null}
            </label>

            {resetCodeError ? (
              <p className="text-sm text-[#b42318]">
                {resetCodeError}{" "}
                <Link href="/forgot-password" className="font-semibold text-[var(--accent)]">
                  Send a new code
                </Link>
              </p>
            ) : null}

            {successMessage ? (
              <p className="text-sm text-emerald-700">
                {successMessage}{" "}
                <Link href="/login" className="font-semibold text-[var(--accent)]">
                  Sign in
                </Link>
              </p>
            ) : null}

            {resetPassword.error instanceof ApiClientError && Object.keys(serverErrors).length === 0 ? (
              <p className="text-sm text-[#b42318]">{resetPassword.error.message}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Saving..." : "Reset password"}
            </Button>
          </form>
        </AuthFormShell>
      </div>
    </main>
  );
}

export default function NewPasswordPage() {
  return (
    <Suspense fallback={null}>
      <NewPasswordPageContent />
    </Suspense>
  );
}
