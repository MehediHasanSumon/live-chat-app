"use client";

import Image from "next/image";
import { memo } from "react";

import { cn } from "@/lib/utils";

export type AppAvatarStatus = "online" | "offline" | null;

type AppAvatarProps = {
  name: string;
  imageUrl?: string | null;
  alt?: string;
  sizeClass?: string;
  textClass?: string;
  className?: string;
  fallbackClassName?: string;
  imageClassName?: string;
  radiusClassName?: string;
  status?: AppAvatarStatus;
  statusClassName?: string;
  sizes?: string;
};

export function getAvatarInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function AppAvatarComponent({
  name,
  imageUrl = null,
  alt,
  sizeClass = "h-11 w-11",
  textClass = "text-sm",
  className,
  fallbackClassName = "bg-[var(--accent-soft)] text-[var(--accent)]",
  imageClassName,
  radiusClassName = "rounded-full",
  status = null,
  statusClassName,
  sizes = "128px",
}: AppAvatarProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden font-semibold",
        sizeClass,
        textClass,
        radiusClassName,
        !imageUrl && fallbackClassName,
        className,
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt ?? name}
          fill
          unoptimized
          sizes={sizes}
          className={cn("object-cover", radiusClassName, imageClassName)}
        />
      ) : (
        getAvatarInitials(name)
      )}

      {status ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white",
            status === "online" ? "bg-sky-500" : "bg-sky-300",
            statusClassName,
          )}
        />
      ) : null}
    </div>
  );
}

export const AppAvatar = memo(AppAvatarComponent);
