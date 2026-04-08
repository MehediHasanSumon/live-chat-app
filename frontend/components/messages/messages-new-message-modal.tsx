"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Check, Search, X } from "lucide-react";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { useConversationsQuery } from "@/lib/hooks/use-conversations-query";
import { toConversationThread } from "@/lib/messages-data";

type MessagesNewMessageModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function MessagesNewMessageModal({
  isOpen,
  onClose,
}: MessagesNewMessageModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: conversations = [], isLoading } = useConversationsQuery(isOpen);

  const contacts = useMemo(
    () =>
      conversations.map((conversation) => {
        const thread = toConversationThread(conversation);

        return {
          id: thread.id,
          name: thread.name,
          subtitle: thread.lastMessage,
          online: thread.online,
        };
      }),
    [conversations],
  );

  const filteredContacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return contacts;
    }

    return contacts.filter((contact) => contact.name.toLowerCase().includes(normalized));
  }, [contacts, query]);

  function selectConversation(id: string) {
    setSelectedId((current) => (current === id ? null : id));
  }

  function handleOpenConversation() {
    if (!selectedId) {
      return;
    }

    onClose();
    router.push(`/messages/t/${selectedId}`);
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(35,37,58,0.28)] px-4 backdrop-blur-sm">
      <div className="w-full max-w-[460px] overflow-hidden rounded-[1rem] border border-[var(--line)] bg-[rgba(255,255,255,0.97)] text-[var(--foreground)] shadow-[0_24px_60px_rgba(35,37,58,0.16)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-[16px] font-semibold">Open conversation</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new message modal"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] transition hover:bg-[rgba(96,91,255,0.16)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="pill-input flex h-10 items-center gap-2 px-3 text-sm text-[var(--muted)]">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--muted)]"
            />
          </div>

          <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
                Loading conversations...
              </div>
            ) : null}

            {!isLoading && filteredContacts.length === 0 ? (
              <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
                No conversations found yet.
              </div>
            ) : null}

            {filteredContacts.map((contact) => {
              const isSelected = selectedId === contact.id;

              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => selectConversation(contact.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-[rgba(96,91,255,0.24)] bg-[var(--accent-soft)]"
                      : "border-[var(--line)] bg-white hover:bg-[var(--accent-soft)]/50"
                  }`}
                >
                  <MessageAvatar name={contact.name} online={contact.online} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{contact.name}</p>
                    <p className="mt-1 truncate text-[13px] text-[var(--muted)]">{contact.subtitle}</p>
                  </div>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--line)] text-transparent"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
            <p className="text-[13px] text-[var(--muted)]">
              {selectedId ? "1 conversation selected" : "Select a conversation to open"}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-soft)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOpenConversation}
                disabled={!selectedId}
                className="h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open conversation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
