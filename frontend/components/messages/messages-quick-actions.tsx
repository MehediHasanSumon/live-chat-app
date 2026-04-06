import { Bell, Phone, Video } from "lucide-react";

import { SidebarIconButton } from "@/components/messages/sidebar-icon-button";

const quickActions = [
  { label: "Audio call", icon: Phone },
  { label: "Video call", icon: Video },
  { label: "Mute", icon: Bell },
];

export function MessagesQuickActions() {
  return (
    <div className="mt-5 flex gap-0.5">
      {quickActions.map(({ label, icon: Icon }) => (
        <SidebarIconButton key={label} icon={Icon} label={label} />
      ))}
    </div>
  );
}
