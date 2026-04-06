import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { TextInput } from "@/components/ui/text-input";

export default function RegisterPage() {
  return (
    <main className="shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="glass-card w-full max-w-2xl rounded-[1rem]">
        <AuthFormShell
          eyebrow="Sign up"
          title="Create your account"
          description="Enter your basic information to create a new account."
          footerText="Already have an account?"
          footerHref="/login"
          footerLinkLabel="Sign in"
        >
          <form className="mt-7 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <FieldLabel>Full name</FieldLabel>
              <TextInput placeholder="Full name" />
            </label>

            <label className="block">
              <FieldLabel>Username</FieldLabel>
              <TextInput placeholder="Username" />
            </label>

            <label className="block">
              <FieldLabel>Phone</FieldLabel>
              <TextInput placeholder="Phone number" />
            </label>

            <label className="block sm:col-span-2">
              <FieldLabel>Email</FieldLabel>
              <TextInput placeholder="Email address" />
            </label>

            <label className="block">
              <FieldLabel>Password</FieldLabel>
              <TextInput type="password" placeholder="Password" />
            </label>

            <label className="block">
              <FieldLabel>Confirm password</FieldLabel>
              <TextInput type="password" placeholder="Confirm password" />
            </label>

            <Button type="submit" className="mt-2 w-full sm:col-span-2">
              Create account
            </Button>
          </form>
        </AuthFormShell>
      </div>
    </main>
  );
}
