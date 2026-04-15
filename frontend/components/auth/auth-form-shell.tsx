import Link from "next/link";
import { ReactNode } from "react";

type AuthFormShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footerText?: string;
  footerHref?: string;
  footerLinkLabel?: string;
};

export function AuthFormShell({
  eyebrow,
  title,
  description,
  children,
  footerText,
  footerHref,
  footerLinkLabel,
}: AuthFormShellProps) {
  return (
    <section className="px-5 py-6 sm:px-7 sm:py-7">
      <div className="mx-auto max-w-md">
        {eyebrow ? <p className="soft-label">{eyebrow}</p> : null}
        <h1 className={`${eyebrow ? "mt-3" : "mt-0"} text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]`}>
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>

        {children}

        {footerText && footerHref && footerLinkLabel ? (
          <p className="mt-6 text-sm text-[var(--muted)]">
            {footerText}{" "}
            <Link href={footerHref} className="font-semibold text-[var(--accent)]">
              {footerLinkLabel}
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
