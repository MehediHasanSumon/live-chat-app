import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { CheckboxInput } from "@/components/ui/checkbox-input";
import { FieldLabel } from "@/components/ui/field-label";
import { TextInput } from "@/components/ui/text-input";

export default function LoginPage() {
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
          <form className="mt-7 space-y-3">
            <label className="block">
              <FieldLabel>Email or username</FieldLabel>
              <TextInput type="text" placeholder="mehedi@example.com" />
            </label>

            <label className="block">
              <FieldLabel>Password</FieldLabel>
              <TextInput type="password" placeholder="........" />
            </label>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-[var(--muted)]">
                <CheckboxInput />
                Remember me
              </label>
              <Button type="button" variant="ghost" className="h-auto px-0 text-sm font-medium">
                Forgot password?
              </Button>
            </div>

            <Button type="submit" className="mt-2 w-full">
              Sign in
            </Button>
          </form>
        </AuthFormShell>
      </div>
    </main>
  );
}
