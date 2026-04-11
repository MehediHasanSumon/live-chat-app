import { Bell, BellOff, Phone, Video } from "lucide-react";

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
  isMuteActive?: boolean;
  muteLabel?: string;
};

export function MessagesQuickActions({
  onVoiceCallClick,
  onVideoCallClick,
  onMuteClick,
  isMuteActive = false,
  muteLabel = "Mute",
}: MessagesQuickActionsProps) {
  return (
    <div className="mt-5 flex gap-0.5">
      {quickActions.map(({ label, icon: Icon }) => (
        <SidebarIconButton
          key={label}
          icon={label === "Mute" && isMuteActive ? BellOff : Icon}
          label={label === "Mute" ? muteLabel : label}
          onClick={
            label === "Audio call"
              ? onVoiceCallClick
              : label === "Video call"
                ? onVideoCallClick
                : onMuteClick
          }
          active={label === "Mute" && isMuteActive}
          disabled={
            (label === "Audio call" && !onVoiceCallClick) ||
            (label === "Video call" && !onVideoCallClick)
          }
        />
      ))}
    </div>
  );
}
