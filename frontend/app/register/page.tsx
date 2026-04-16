"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import { useRegisterMutation } from "@/lib/hooks/use-auth-mutations";
import { usePublicCompanySettingQuery } from "@/lib/hooks/use-public-company-setting";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registerMutation = useRegisterMutation();
  const { data: publicCompanySetting, isLoading } = usePublicCompanySettingQuery();
  const [form, setForm] = useState({
    name: "",
    username: "",
    phone: "",
    email: "",
    password: "",
    password_confirmation: "",
  });

  const fieldErrors = useMemo(
    () => (registerMutation.error instanceof ApiClientError ? registerMutation.error.errors ?? {} : {}),
    [registerMutation.error],
  );
  const registrationEnabled = publicCompanySetting?.is_registration_enable ?? false;
  const emailVerificationEnabled = publicCompanySetting?.is_email_verification_enable ?? true;

  useEffect(() => {
    if (!isLoading && !registrationEnabled) {
      router.replace("/login");
    }
  }, [isLoading, registrationEnabled, router]);

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!registrationEnabled) {
      return;
    }

    try {
      const response = await registerMutation.mutateAsync({
        ...form,
        email: form.email || undefined,
        phone: form.phone || undefined,
      });

      const redirect = searchParams.get("redirect") || "/messages";
      window.location.assign(response.data.must_verify_email ? `/email-verification?redirect=${encodeURIComponent(redirect)}` : redirect);
    } catch {
      // Errors are surfaced through mutation state for inline form feedback.
    }
  }

  if (isLoading) {
    return null;
  }

  if (!registrationEnabled) {
    return (
      <main className="shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6" suppressHydrationWarning>
        <div className="glass-card w-full max-w-xl overflow-hidden rounded-[1rem]" suppressHydrationWarning>
          <AuthFormShell
            eyebrow="Sign up"
            title="Registration unavailable"
            description="New account creation is currently disabled by the company settings."
            footerText="Already have an account?"
            footerHref="/login"
            footerLinkLabel="Sign in"
          >
            <div className="mt-7 rounded-[1rem] border border-[var(--line)] bg-white/80 px-4 py-4 text-sm leading-6 text-[var(--muted)]">
              Access to the signup page follows the public registration setting. Please contact your administrator if you need a new account.
            </div>
            <Link
              href="/login"
              className="mt-5 inline-flex text-sm font-semibold text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
            >
              Back to sign in
            </Link>
          </AuthFormShell>
        </div>
      </main>
    );
  }

  return (
    <main className="shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6" suppressHydrationWarning>
      <div className="glass-card w-full max-w-2xl rounded-[1rem]" suppressHydrationWarning>
        <AuthFormShell
          eyebrow="Sign up"
          title="Create your account"
          description="Enter your basic information to create a new account."
          footerText="Already have an account?"
          footerHref="/login"
          footerLinkLabel="Sign in"
        >
          <form className="mt-7 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block sm:col-span-2">
              <FieldLabel>Full name</FieldLabel>
              <TextInput
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Full name"
                autoComplete="name"
              />
              {fieldErrors.name ? <p className="mt-2 text-sm text-[#b42318]">{fieldErrors.name[0]}</p> : null}
            </label>

            <label className="block">
              <FieldLabel>Username</FieldLabel>
              <TextInput
                value={form.username}
                onChange={(event) => updateField("username", event.target.value)}
                placeholder="Username"
                autoComplete="username"
              />
              {fieldErrors.username ? (
                <p className="mt-2 text-sm text-[#b42318]">{fieldErrors.username[0]}</p>
              ) : null}
            </label>

            <label className="block">
              <FieldLabel>Phone</FieldLabel>
              <TextInput
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="Phone number"
                autoComplete="tel"
              />
              {fieldErrors.phone ? <p className="mt-2 text-sm text-[#b42318]">{fieldErrors.phone[0]}</p> : null}
            </label>

            <label className="block sm:col-span-2">
              <FieldLabel>{emailVerificationEnabled ? "Email*" : "Email"}</FieldLabel>
              <TextInput
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="Email address"
                autoComplete="email"
                required={emailVerificationEnabled}
              />
              {emailVerificationEnabled ? (
                <p className="mt-2 text-xs text-[var(--muted)]">Email verification is enabled, so a valid email is required to finish signup.</p>
              ) : null}
              {fieldErrors.email ? <p className="mt-2 text-sm text-[#b42318]">{fieldErrors.email[0]}</p> : null}
            </label>

            <label className="block">
              <FieldLabel>Password</FieldLabel>
              <TextInput
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="Password"
                autoComplete="new-password"
              />
              {fieldErrors.password ? (
                <p className="mt-2 text-sm text-[#b42318]">{fieldErrors.password[0]}</p>
              ) : null}
            </label>

            <label className="block">
              <FieldLabel>Confirm password</FieldLabel>
              <TextInput
                type="password"
                value={form.password_confirmation}
                onChange={(event) => updateField("password_confirmation", event.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
              />
              {fieldErrors.password_confirmation ? (
                <p className="mt-2 text-sm text-[#b42318]">{fieldErrors.password_confirmation[0]}</p>
              ) : null}
            </label>

            {registerMutation.error instanceof ApiClientError && Object.keys(fieldErrors).length === 0 ? (
              <p className="sm:col-span-2 text-sm text-[#b42318]">{registerMutation.error.message}</p>
            ) : null}

            <Button type="submit" className="mt-2 w-full sm:col-span-2" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </AuthFormShell>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}
