import { ReactNode } from "react";

type MessagesShellProps = {
  sidebar: ReactNode;
  content: ReactNode;
  aside?: ReactNode;
};

export function MessagesShell({ sidebar, content, aside }: MessagesShellProps) {
  return (
    <main className="shell px-4 py-4 sm:px-6">
      <div
        className={`glass-card mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-[1600px] overflow-hidden rounded-[1.25rem] ${
          aside
            ? "lg:grid-cols-[380px_minmax(0,1fr)_380px]"
            : "lg:grid-cols-[380px_minmax(0,1fr)]"
        }`}
      >
        {sidebar}
        {content}
        {aside}
      </div>
    </main>
  );
}
