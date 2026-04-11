import { memo } from "react";
import { Search } from "lucide-react";

type MessagesSearchBarProps = {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
};

function MessagesSearchBarComponent({
  placeholder = "Search Messenger",
  value = "",
  onChange,
}: MessagesSearchBarProps) {
  return (
    <div className="pill-input mt-4 flex h-10 items-center gap-2 px-3 text-sm text-[var(--muted)]">
      <Search className="h-4 w-4" />
      <input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--muted)]"
      />
    </div>
  );
}

export const MessagesSearchBar = memo(MessagesSearchBarComponent);
