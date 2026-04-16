import { memo } from "react";

import { AppAvatar, type AppAvatarStatus } from "@/components/ui/app-avatar";

type MessageAvatarProps = {
  name: string;
  online?: boolean;
  status?: AppAvatarStatus;
  sizeClass?: string;
  textClass?: string;
  imageUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  radiusClassName?: string;
};

function MessageAvatarComponent({
  name,
  online = false,
  status,
  sizeClass = "h-11 w-11",
  textClass = "text-sm",
  imageUrl = null,
  className,
  fallbackClassName,
  radiusClassName,
}: MessageAvatarProps) {
  return (
    <AppAvatar
      name={name}
      imageUrl={imageUrl}
      sizeClass={sizeClass}
      textClass={textClass}
      className={className}
      fallbackClassName={fallbackClassName}
      radiusClassName={radiusClassName}
      status={status ?? (online ? "online" : null)}
    />
  );
}

export const MessageAvatar = memo(MessageAvatarComponent);
