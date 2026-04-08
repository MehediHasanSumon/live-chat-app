"use client";

import { useState } from "react";

import { ArrowLeft, FileText } from "lucide-react";

import { useSharedFilesQuery, useSharedMediaQuery } from "@/lib/hooks/use-shared-attachments-query";
import { toThreadMediaItems, type MessageThread } from "@/lib/messages-data";

type MessagesMediaSidebarProps = {
  thread: MessageThread;
  initialTab?: "media" | "file";
  onBack: () => void;
};

export function MessagesMediaSidebar({
  thread,
  initialTab = "media",
  onBack,
}: MessagesMediaSidebarProps) {
  const [activeTab, setActiveTab] = useState<"media" | "file">(initialTab);
  const { data: media = [], isLoading: isMediaLoading } = useSharedMediaQuery(thread.id, activeTab === "media");
  const { data: files = [], isLoading: isFilesLoading } = useSharedFilesQuery(thread.id, activeTab === "file");
  const items = activeTab === "media" ? toThreadMediaItems(media) : toThreadMediaItems(files);
  const isLoading = activeTab === "media" ? isMediaLoading : isFilesLoading;

  return (
    <div className="surface h-full bg-[#fbfcff]">
      <div className="flex h-full flex-col">
        <div className="border-b border-[var(--line)] px-5 py-5">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-3 text-left text-[15px] font-semibold tracking-tight text-[var(--foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Media and files</span>
          </button>

          <div className="mt-5 flex gap-4 border-b border-[var(--line)]">
            {[
              { key: "media", label: "Media" },
              { key: "file", label: "Files" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as "media" | "file")}
                className={`border-b-2 px-1 pb-2 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
              Loading {activeTab}...
            </div>
          ) : null}

          {!isLoading && items.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
              No shared {activeTab === "media" ? "media" : "files"} yet.
            </div>
          ) : null}

          {!isLoading && activeTab === "media" ? (
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.downloadUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white"
                >
                  <div className="flex aspect-square items-center justify-center bg-[var(--accent-soft)] text-2xl font-semibold text-[var(--accent)]">
                    {item.preview ?? "M"}
                  </div>
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {item.isExpired ? "Expired file" : item.meta}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          ) : null}

          {!isLoading && activeTab === "file" ? (
            <div className="space-y-3">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.downloadUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {item.isExpired ? "Expired file" : item.meta}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
