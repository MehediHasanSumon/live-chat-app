"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { Check, Search, X } from "lucide-react";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { BoneyardSkeleton, ListSkeleton } from "@/components/ui/boneyard-loading";
import { apiClient } from "@/lib/api-client";
import { useUserSearchQuery } from "@/lib/hooks/use-user-search-query";
import { type ConversationApiItem } from "@/lib/messages-data";
import { queryKeys } from "@/lib/query-keys";

type MessagesNewMessageModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function MessagesNewMessageModal({
  isOpen,
  onClose,
}: MessagesNewMessageModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedPreviewById, setSelectedPreviewById] = useState<Record<number, { name: string; subtitle: string; online: boolean }>>({});
  const [isOpening, setIsOpening] = useState(false);
  const usersQuery = query.trim();
  const { data: users = [], isLoading } = useUserSearchQuery(usersQuery, isOpen);

  const contacts = useMemo(
    () =>
      users.map((user) => ({
        id: user.id,
        name: user.name,
        subtitle: user.username ? `@${user.username}` : user.email ?? "User",
        online: false,
      })),
    [users],
  );
  const selectedContacts = useMemo(
    () =>
      selectedIds.map((id) => {
        const liveContact = contacts.find((contact) => contact.id === id);

        if (liveContact) {
          return liveContact;
        }

        return {
          id,
          name: selectedPreviewById[id]?.name ?? `User #${id}`,
          subtitle: selectedPreviewById[id]?.subtitle ?? "User",
          online: selectedPreviewById[id]?.online ?? false,
        };
      }),
    [contacts, selectedIds, selectedPreviewById],
  );
  const selectedCount = selectedIds.length;
  const isGroupSelection = selectedCount > 1;

  function resetModal() {
    setQuery("");
    setSelectedIds([]);
    setSelectedPreviewById({});
  }

  function buildGroupTitle() {
    const names = selectedContacts.map((contact) => contact.name.trim()).filter(Boolean);

    if (names.length === 0) {
      return "New group";
    }

    if (names.length <= 3) {
      return names.join(", ").slice(0, 120);
    }

    const preview = names.slice(0, 3).join(", ");
    return `${preview} +${names.length - 3}`.slice(0, 120);
  }

  function selectConversation(contact: (typeof contacts)[number]) {
    setSelectedIds((current) =>
      current.includes(contact.id)
        ? current.filter((value) => value !== contact.id)
        : [...current, contact.id],
    );
    setSelectedPreviewById((current) => {
      if (contact.id in current) {
        const next = { ...current };
        delete next[contact.id];
        return next;
      }

      return {
        ...current,
        [contact.id]: {
          name: contact.name,
          subtitle: contact.subtitle,
          online: contact.online,
        },
      };
    });
  }

  async function handleOpenConversation() {
    if (selectedIds.length === 0) {
      return;
    }

    setIsOpening(true);

    try {
      const response = selectedIds.length === 1
        ? await apiClient.post<{ data: ConversationApiItem }>("/api/conversations/direct", {
            target_user_id: selectedIds[0],
          })
        : await apiClient.post<{ data: ConversationApiItem }>("/api/groups", {
            title: buildGroupTitle(),
            member_ids: selectedIds,
          });

      await queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all,
      });

      resetModal();
      onClose();
      router.push(`/messages/t/${response.data.id}`);
    } finally {
      setIsOpening(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(35,37,58,0.28)] px-4 backdrop-blur-sm">
      <div className="w-full max-w-[520px] overflow-hidden rounded-[1.6rem] border border-[rgba(111,123,176,0.16)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(247,249,255,0.98)_100%)] text-[var(--foreground)] shadow-[0_28px_80px_rgba(35,37,58,0.18)]">
        <div className="flex items-start justify-between border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[1.25rem] font-semibold tracking-tight text-[#2f3655]">Open conversation</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              resetModal();
              onClose();
            }}
            aria-label="Close new message modal"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(96,91,255,0.08)] bg-[var(--accent-soft)] text-[var(--accent)] transition hover:border-[rgba(96,91,255,0.18)] hover:bg-[rgba(96,91,255,0.16)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="pill-input flex h-12 items-center gap-2 rounded-2xl px-4 text-sm text-[var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--muted)]"
            />
          </div>

          <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              <BoneyardSkeleton name="new-message-user-search" loading={isLoading} fallback={<ListSkeleton rows={4} />}>
                <ListSkeleton rows={4} />
              </BoneyardSkeleton>
            ) : null}

            {!isLoading && contacts.length === 0 ? (
              <div className="rounded-[1.25rem] border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
                {usersQuery ? "No users matched your search." : "No users available yet."}
              </div>
            ) : null}

            {contacts.map((contact) => {
              const isSelected = selectedIds.includes(contact.id);

              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => selectConversation(contact)}
                  className={`flex w-full items-center gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-[rgba(96,91,255,0.24)] bg-[linear-gradient(180deg,rgba(238,240,255,0.92)_0%,rgba(245,247,255,0.98)_100%)] shadow-[0_14px_30px_rgba(96,91,255,0.08)]"
                      : "border-[var(--line)] bg-white hover:bg-[var(--accent-soft)]/50"
                  }`}
                >
                  <MessageAvatar name={contact.name} online={contact.online} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{contact.name}</p>
                    <p className="mt-1 truncate text-[13px] text-[var(--muted)]">{contact.subtitle}</p>
                  </div>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
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

          <div className="mt-5 flex flex-col gap-4 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex w-full items-center gap-3 sm:w-auto sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  resetModal();
                  onClose();
                }}
                className="h-11 min-w-[112px] flex-1 rounded-2xl border border-[var(--line)] bg-white px-5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-soft)] sm:flex-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleOpenConversation();
                }}
                disabled={selectedCount === 0 || isOpening}
                className="h-11 min-w-[178px] flex-1 whitespace-nowrap rounded-2xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(96,91,255,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                {isOpening ? "Opening..." : isGroupSelection ? "Open group chat" : "Open conversation"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
