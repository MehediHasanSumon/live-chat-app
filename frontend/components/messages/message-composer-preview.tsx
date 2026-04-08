"use client";

import Image from "next/image";
import { FileText, X } from "lucide-react";

import { type ComposerAttachmentInput } from "@/lib/messages-data";

type MessageComposerPreviewProps = {
  attachments: ComposerAttachmentInput[];
  onRemove: (id: string) => void;
};

export function MessageComposerPreview({
  attachments,
  onRemove,
}: MessageComposerPreviewProps) {
  return (
    <div className="mb-2 flex flex-wrap gap-2 rounded-[16px] bg-white/78 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.94)] transition-all duration-200 ease-out">
      {attachments.map((attachment) => {
        const extension = attachment.file.name.split(".").pop()?.toUpperCase() ?? "FILE";

        return (
          <div
            key={attachment.id}
            className="group relative overflow-hidden rounded-2xl border border-[rgba(111,123,176,0.12)] bg-white shadow-[0_10px_20px_rgba(96,109,160,0.08)] transition-transform duration-200 ease-out hover:-translate-y-0.5"
          >
            {attachment.kind === "image" && attachment.previewUrl ? (
              <div className="relative h-16 w-16">
                <Image
                  src={attachment.previewUrl}
                  alt={attachment.file.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 bg-[linear-gradient(180deg,rgba(248,249,255,1)_0%,rgba(241,244,255,1)_100%)] px-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <span className="text-[10px] font-semibold text-[var(--foreground)]">
                  {extension.slice(0, 4)}
                </span>
              </div>
            )}

            <button
              type="button"
              aria-label={`Remove ${attachment.file.name}`}
              onClick={() => onRemove(attachment.id)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(24,27,38,0.7)] text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
