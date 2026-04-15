"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import { useResetPasswordMutation } from "@/lib/hooks/use-auth-mutations";

function ResetPasswordPageContent() {
  const searchParams = useSearchParams();
  const resetPassword = useResetPasswordMutation();
  const [form, setForm] = useState({
    email: searchParams.get("email") ?? "",
    code: "",
    password: "",
    password_confirmation: "",
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fieldErrors = useMemo(
    () => (resetPassword.error instanceof ApiClientError ? resetPassword.error.errors ?? {} : {}),
    [resetPassword.error],
  );

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);

    try {
      const response = await resetPassword.mutateAsync({
        ...form,
        email: form.email.trim(),
        code: form.code.trim(),
      });
      setSuccessMessage(response.message);
      setForm((current) => ({ ...current, code: "", password: "", password_confirmation: "" }));
    } catch {
      // Mutation state renders validation feedback.
    }
  }

  return (
    <main className="shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="glass-card w-full max-w-xl overflow-hidden rounded-[1rem]">
        <AuthFormShell
          eyebrow="Reset password"
          title="Enter your code"
          description="Use the 6 digit code from your email and choose a new password."
          footerText="Need another code?"
          footerHref="/forgot-password"
          footerLinkLabel="Send again"
        >
          <form className="mt-7 space-y-3" onSubmit={handleSubmit}>
            <AuthTextField
              label="Email"
              type="email"
              value={form.email}
              error={fieldErrors.email?.[0]}
              autoComplete="email"
              placeholder="mehedi@example.com"
              onChange={(value) => updateField("email", value)}
            />
            <AuthTextField
              label="Verification code"
              value={form.code}
              error={fieldErrors.code?.[0]}
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              onChange={(value) => updateField("code", value.replace(/\D/g, "").slice(0, 6))}
            />
            <AuthTextField
              label="New password"
              type="password"
              value={form.password}
              error={fieldErrors.password?.[0]}
              autoComplete="new-password"
              placeholder="New password"
              onChange={(value) => updateField("password", value)}
            />
            <AuthTextField
              label="Confirm password"
              type="password"
              value={form.password_confirmation}
              error={fieldErrors.password_confirmation?.[0]}
              autoComplete="new-password"
              placeholder="Confirm password"
              onChange={(value) => updateField("password_confirmation", value)}
            />

            {successMessage ? (
              <p className="text-sm text-emerald-700">
                {successMessage}{" "}
                <Link href="/login" className="font-semibold text-[var(--accent)]">
                  Sign in
                </Link>
              </p>
            ) : null}
            {resetPassword.error instanceof ApiClientError && Object.keys(fieldErrors).length === 0 ? (
              <p className="text-sm text-[#b42318]">{resetPassword.error.message}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Resetting..." : "Reset password"}
            </Button>
          </form>
        </AuthFormShell>
      </div>
    </main>
  );
}

function AuthTextField({
  autoComplete,
  error,
  inputMode,
  label,
  maxLength,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  autoComplete?: string;
  error?: string;
  inputMode?: "numeric";
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
      />
      {error ? <p className="mt-2 text-sm text-[#b42318]">{error}</p> : null}
    </label>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
