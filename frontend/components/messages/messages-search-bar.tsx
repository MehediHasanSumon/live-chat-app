import { Search } from "lucide-react";

type MessagesSearchBarProps = {
  placeholder?: string;
};

export function MessagesSearchBar({
  placeholder = "Search Messenger",
}: MessagesSearchBarProps) {
  return (
    <div className="pill-input mt-4 flex h-10 items-center gap-2 px-3 text-sm text-[var(--muted)]">
      <Search className="h-4 w-4" />
      <span>{placeholder}</span>
    </div>
  );
}
