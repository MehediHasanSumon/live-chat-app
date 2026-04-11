import { Bell, Phone, Video } from "lucide-react";

import { SidebarIconButton } from "@/components/messages/sidebar-icon-button";

const quickActions = [
  { label: "Audio call", icon: Phone },
  { label: "Video call", icon: Video },
  { label: "Mute", icon: Bell },
];

type MessagesQuickActionsProps = {
  onVoiceCallClick?: () => void;
  onVideoCallClick?: () => void;
  onMuteClick?: () => void;
};

export function MessagesQuickActions({
  onVoiceCallClick,
  onVideoCallClick,
  onMuteClick,
}: MessagesQuickActionsProps) {
  return (
    <div className="mt-5 flex gap-0.5">
      {quickActions.map(({ label, icon: Icon }) => (
        <SidebarIconButton
          key={label}
          icon={Icon}
          label={label}
          onClick={
            label === "Audio call"
              ? onVoiceCallClick
              : label === "Video call"
                ? onVideoCallClick
                : onMuteClick
          }
          disabled={
            (label === "Audio call" && !onVoiceCallClick) ||
            (label === "Video call" && !onVideoCallClick)
          }
        />
      ))}
    </div>
  );
}
