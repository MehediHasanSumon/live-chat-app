"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { CheckboxInput } from "@/components/ui/checkbox-input";
import { FieldLabel } from "@/components/ui/field-label";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import { useLoginMutation } from "@/lib/hooks/use-auth-mutations";

export default function LoginPage() {
  const router = useRouter();
  const loginMutation = useLoginMutation();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const fieldErrors = useMemo(
    () => (loginMutation.error instanceof ApiClientError ? loginMutation.error.errors ?? {} : {}),
    [loginMutation.error],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await loginMutation.mutateAsync({
        login,
        password,
        remember,
      });

      router.push("/");
      router.refresh();
    } catch {
      // Errors are surfaced through mutation state for inline form feedback.
    }
  }

  return (
    <main className="shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="glass-card w-full max-w-xl overflow-hidden rounded-[1rem]">
        <AuthFormShell
          eyebrow="Sign in"
          title="Welcome back"
          description="Sign in to access your account."
          footerText="New here?"
          footerHref="/register"
          footerLinkLabel="Create an account"
        >
          <form className="mt-7 space-y-3" onSubmit={handleSubmit}>
            <label className="block">
              <FieldLabel>Email or username</FieldLabel>
              <TextInput
                type="text"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="mehedi@example.com"
                autoComplete="username"
              />
              {fieldErrors.login ? (
                <p className="mt-2 text-sm text-[#b42318]">{fieldErrors.login[0]}</p>
              ) : null}
            </label>

            <label className="block">
              <FieldLabel>Password</FieldLabel>
              <TextInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="........"
                autoComplete="current-password"
              />
              {fieldErrors.password ? (
                <p className="mt-2 text-sm text-[#b42318]">{fieldErrors.password[0]}</p>
              ) : null}
            </label>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-[var(--muted)]">
                <CheckboxInput
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Remember me
              </label>
              <Button type="button" variant="ghost" className="h-auto px-0 text-sm font-medium">
                Forgot password?
              </Button>
            </div>

            {loginMutation.error instanceof ApiClientError && !fieldErrors.login && !fieldErrors.password ? (
              <p className="text-sm text-[#b42318]">{loginMutation.error.message}</p>
            ) : null}

            <Button type="submit" className="mt-2 w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </AuthFormShell>
      </div>
    </main>
  );
}
