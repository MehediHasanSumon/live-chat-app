"use client";

import { useState } from "react";

import { type MessageThread } from "@/lib/messages-data";
import { MessagesAsidePanel } from "@/components/messages/messages-aside-panel";
import { MessagesMediaSidebar } from "@/components/messages/messages-media-sidebar";
import { MessagesShell } from "@/components/messages/messages-shell";
import { MessagesSidebar } from "@/components/messages/messages-sidebar";
import { MessagesThreadView } from "@/components/messages/messages-thread-view";
import { MessagesUserSidebar } from "@/components/messages/messages-user-sidebar";

type MessagesThreadLayoutProps = {
  thread: MessageThread;
};

type AsideView = "info" | "media" | "file";

export function MessagesThreadLayout({ thread }: MessagesThreadLayoutProps) {
  const [isInfoSidebarOpen, setIsInfoSidebarOpen] = useState(true);
  const [asideView, setAsideView] = useState<AsideView>("info");

  const aside =
    asideView === "info" ? (
      <MessagesAsidePanel key="info">
        <MessagesUserSidebar
          thread={thread}
          onOpenMediaPanel={(tab) => {
            setAsideView(tab);
            setIsInfoSidebarOpen(true);
          }}
        />
      </MessagesAsidePanel>
    ) : (
      <MessagesAsidePanel key={asideView}>
        <MessagesMediaSidebar
          thread={thread}
          initialTab={asideView}
          onBack={() => {
            setAsideView("info");
            setIsInfoSidebarOpen(true);
          }}
        />
      </MessagesAsidePanel>
    );

  return (
    <MessagesShell
      sidebar={<MessagesSidebar activeThreadId={thread.id} />}
      content={
        <MessagesThreadView
          thread={thread}
          isInfoSidebarOpen={isInfoSidebarOpen}
          onToggleInfoSidebar={() => {
            setIsInfoSidebarOpen((value) => {
              const next = !value;
              if (next) {
                setAsideView("info");
              }
              return next;
            });
          }}
        />
      }
      aside={aside}
      asideVisible={isInfoSidebarOpen}
    />
  );
}
