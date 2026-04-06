import { KeyboardEvent as ReactKeyboardEvent } from "react";

type MessagesFilterTabsProps = {
  filters: readonly string[];
  activeFilter: string;
  onChange: (filter: string) => void;
};

export function MessagesFilterTabs({
  filters,
  activeFilter,
  onChange,
}: MessagesFilterTabsProps) {
  return (
    <div className="mt-4 flex gap-1.5 overflow-x-auto whitespace-nowrap pb-1">
      {filters.map((filter) => (
        <span
          key={filter}
          role="button"
          tabIndex={0}
          onClick={() => onChange(filter)}
          onKeyDown={(event: ReactKeyboardEvent<HTMLSpanElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onChange(filter);
            }
          }}
          className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-[12px] leading-none font-medium transition ${
            activeFilter === filter
              ? "bg-[var(--accent)] text-white"
              : "bg-transparent text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]"
          }`}
        >
          {filter}
        </span>
      ))}
    </div>
  );
}
