"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, LoaderCircle, Save, Trash2, Users } from "lucide-react";

import { MessageAvatar } from "@/components/messages/message-avatar";
import { type MessageThread } from "@/lib/messages-data";
import {
  useSaveGroupConversationMutation,
} from "@/lib/hooks/use-group-settings-mutations";

type MessagesGroupSettingsSectionProps = {
  thread: MessageThread;
  canManageGroup: boolean;
};

export function MessagesGroupSettingsSection({
  thread,
  canManageGroup,
}: MessagesGroupSettingsSectionProps) {
  const [title, setTitle] = useState(thread.name);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreviewUrl, setPendingAvatarPreviewUrl] = useState<string | null>(null);
  const [isAvatarMarkedForRemoval, setIsAvatarMarkedForRemoval] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveGroupMutation = useSaveGroupConversationMutation(thread.id);

  useEffect(() => {
    return () => {
      if (pendingAvatarPreviewUrl) {
        URL.revokeObjectURL(pendingAvatarPreviewUrl);
      }
    };
  }, [pendingAvatarPreviewUrl]);

  const normalizedTitle = title.trim();
  const titleChanged = normalizedTitle !== thread.name;
  const hasChanges = titleChanged || pendingAvatarFile !== null || isAvatarMarkedForRemoval;
  const activeMembersCount = useMemo(
    () => (thread.members ?? []).filter((member) => member.membership_state === "active").length,
    [thread.members],
  );

  const handleSave = async () => {
    if (!canManageGroup || normalizedTitle.length < 2 || !hasChanges) {
      return;
    }

    await saveGroupMutation.mutateAsync({
      title: normalizedTitle,
      avatarFile: pendingAvatarFile,
      clearAvatar: isAvatarMarkedForRemoval,
    });

    if (pendingAvatarPreviewUrl) {
      URL.revokeObjectURL(pendingAvatarPreviewUrl);
    }

    setPendingAvatarFile(null);
    setPendingAvatarPreviewUrl(null);
    setIsAvatarMarkedForRemoval(false);
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !canManageGroup) {
      return;
    }

    if (pendingAvatarPreviewUrl) {
      URL.revokeObjectURL(pendingAvatarPreviewUrl);
    }

    setPendingAvatarFile(file);
    setPendingAvatarPreviewUrl(URL.createObjectURL(file));
    setIsAvatarMarkedForRemoval(false);
    event.target.value = "";
  };

  const handleRemoveAvatar = () => {
    if (!canManageGroup || (!thread.avatarObjectId && !pendingAvatarFile && !pendingAvatarPreviewUrl)) {
      return;
    }

    if (pendingAvatarPreviewUrl) {
      URL.revokeObjectURL(pendingAvatarPreviewUrl);
    }

    setPendingAvatarFile(null);
    setPendingAvatarPreviewUrl(null);
    setIsAvatarMarkedForRemoval(true);
  };

  const isSaving = saveGroupMutation.isPending;
  const errorMessage = saveGroupMutation.error?.message ?? null;
  const displayedAvatarUrl = isAvatarMarkedForRemoval ? null : (pendingAvatarPreviewUrl ?? thread.avatarUrl);
  const hasAvatar = Boolean(displayedAvatarUrl || thread.avatarObjectId || pendingAvatarFile);

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-white px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canManageGroup || isSaving}
            className={`group relative overflow-hidden rounded-full ${canManageGroup ? "cursor-pointer" : "cursor-default"}`}
            aria-label={canManageGroup ? "Upload group avatar" : "Group avatar"}
          >
            <MessageAvatar
              name={thread.name}
              imageUrl={displayedAvatarUrl}
              sizeClass="h-16 w-16"
              textClass="text-xl"
            />
            {canManageGroup ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[rgba(19,24,42,0.36)] opacity-0 transition group-hover:opacity-100">
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Camera className="h-4 w-4 text-white" />
                )}
              </span>
            ) : null}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">{thread.name}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[11px] text-[var(--accent)]">
              <Users className="h-3 w-3" />
              {activeMembersCount} members
            </span>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#7981a5]">Group name</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={!canManageGroup || isSaving}
          placeholder="Enter group name"
          className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[#fbfcff] px-3 py-2 text-sm outline-none transition focus:border-[rgba(96,91,255,0.28)] disabled:cursor-not-allowed disabled:opacity-70"
        />
      </div>

      {errorMessage ? (
        <p className="text-xs text-rose-500">{errorMessage}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {canManageGroup && hasAvatar ? (
          <button
            type="button"
            onClick={() => {
              handleRemoveAvatar();
            }}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove photo
          </button>
        ) : null}

        {canManageGroup ? (
          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={!hasChanges || normalizedTitle.length < 2 || isSaving}
            className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-3 py-1.5 text-xs font-medium text-white shadow-[0_12px_24px_rgba(96,91,255,0.16)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save changes
          </button>
        ) : null}
      </div>
    </div>
  );
}
