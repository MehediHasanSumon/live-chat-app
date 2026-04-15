"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const [notice, setNotice] = useState<string | null>(null);
  const fieldErrors = useMemo(
    () => (forgotPassword.error instanceof ApiClientError ? forgotPassword.error.errors ?? {} : {}),
    [forgotPassword.error],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    try {
      const response = await forgotPassword.mutateAsync({ email: email.trim() });
      setNotice(response.message);
      router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
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
          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <FieldLabel>Email</FieldLabel>
              <TextInput
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="mehedi@example.com"
                autoComplete="email"
              />
              {fieldErrors.email ? <p className="mt-2 text-sm text-[#b42318]">{fieldErrors.email[0]}</p> : null}
            </label>

            {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
            {forgotPassword.error instanceof ApiClientError && !fieldErrors.email ? (
              <p className="text-sm text-[#b42318]">{forgotPassword.error.message}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
              {forgotPassword.isPending ? "Sending code..." : "Send reset code"}
            </Button>

            <Link href="/reset-password" className="block text-center text-sm font-semibold text-[var(--accent)]">
              Already have a code?
            </Link>
          </form>
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
