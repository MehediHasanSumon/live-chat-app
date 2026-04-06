import { ReactNode } from "react";

type MessagesShellProps = {
  sidebar: ReactNode;
  content: ReactNode;
  aside?: ReactNode;
  asideVisible?: boolean;
};

export function MessagesShell({
  sidebar,
  content,
  aside,
  asideVisible = true,
}: MessagesShellProps) {
  return (
    <main className="shell px-4 py-4 sm:px-6">
      <div className="glass-card mx-auto flex h-[calc(100vh-2rem)] min-h-[calc(100vh-2rem)] w-full max-w-[1600px] overflow-hidden rounded-[1.25rem]">
        <div className="flex h-full w-[380px] shrink-0">{sidebar}</div>
        <div className="min-w-0 flex h-full flex-1">{content}</div>
        {aside ? (
          <div
            className={`hidden h-full shrink-0 overflow-hidden border-l border-[var(--line)] transition-[width,opacity] duration-300 ease-out lg:block ${
              asideVisible ? "w-[380px] opacity-100" : "w-0 opacity-0"
            }`}
          >
            <div className={`h-full transition-transform duration-300 ease-out ${asideVisible ? "translate-x-0" : "translate-x-6"}`}>
              {aside}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
