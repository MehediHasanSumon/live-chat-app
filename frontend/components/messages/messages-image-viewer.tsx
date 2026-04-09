"use client";

import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

export type MessagesImageViewerItem = {
  id: string;
  url: string;
  name: string;
};

type MessagesImageViewerProps = {
  images: MessagesImageViewerItem[];
  activeImageId: string | null;
  onClose: () => void;
  onSelectImage: (imageId: string) => void;
};

export function MessagesImageViewer({
  images,
  activeImageId,
  onClose,
  onSelectImage,
}: MessagesImageViewerProps) {
  const activeImageIndex = images.findIndex((image) => image.id === activeImageId);
  const activeImage = activeImageIndex >= 0 ? images[activeImageIndex] : null;

  if (!activeImage) {
    return null;
  }

  const showNavigation = images.length > 1;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center px-4 py-6"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-[1040px] flex-col rounded-[28px] border border-white/10 bg-[rgba(15,18,31,0.96)] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.32)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-2 px-1 pb-3">
          <a
            href={activeImage.url}
            download={activeImage.name}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(111,123,176,0.16)] bg-white/96 text-[#4c567f] shadow-[0_10px_24px_rgba(96,109,160,0.1)] transition hover:border-[rgba(96,91,255,0.18)] hover:text-[var(--accent)]"
            aria-label="Download image"
          >
            <Download className="h-4.5 w-4.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(111,123,176,0.16)] bg-white/96 text-[#4c567f] shadow-[0_10px_24px_rgba(96,109,160,0.1)] transition hover:border-[rgba(96,91,255,0.18)] hover:text-[var(--accent)]"
            aria-label="Close image viewer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[22px] bg-[rgba(255,255,255,0.03)]">
          {showNavigation ? (
            <>
              <button
                type="button"
                onClick={() =>
                  onSelectImage(images[(activeImageIndex - 1 + images.length) % images.length]?.id ?? activeImage.id)
                }
                className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(111,123,176,0.16)] bg-white/96 text-[#4c567f] shadow-[0_10px_24px_rgba(96,109,160,0.1)] transition hover:border-[rgba(96,91,255,0.18)] hover:text-[var(--accent)]"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onSelectImage(images[(activeImageIndex + 1 + images.length) % images.length]?.id ?? activeImage.id)
                }
                className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(111,123,176,0.16)] bg-white/96 text-[#4c567f] shadow-[0_10px_24px_rgba(96,109,160,0.1)] transition hover:border-[rgba(96,91,255,0.18)] hover:text-[var(--accent)]"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeImage.url} alt={activeImage.name} className="max-h-full max-w-full rounded-[24px] object-contain" />
        </div>

        {showNavigation ? (
          <div className="mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {images.map((image) => {
              const isActive = image.id === activeImage.id;

              return (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => onSelectImage(image.id)}
                  className={`overflow-hidden rounded-2xl border transition ${
                    isActive
                      ? "border-[rgba(112,106,255,0.9)] ring-2 ring-[rgba(112,106,255,0.22)]"
                      : "border-white/8 opacity-70 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.name} className="h-16 w-16 object-cover" />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
