import { Bell } from "lucide-react";

import { SidebarIconButton } from "@/components/messages/sidebar-icon-button";

const quickActions = [
  { label: "Mute", icon: Bell },
];

type MessagesQuickActionsProps = {
  onMuteClick?: () => void;
};

export function MessagesQuickActions({ onMuteClick }: MessagesQuickActionsProps) {
  return (
    <div className="mt-5 flex gap-0.5">
      {quickActions.map(({ label, icon: Icon }) => (
        <SidebarIconButton
          key={label}
          icon={Icon}
          label={label}
          onClick={label === "Mute" ? onMuteClick : undefined}
        />
      ))}
    </div>
  );
}
