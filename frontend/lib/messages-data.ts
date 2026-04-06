export type MessageThread = {
  id: string;
  name: string;
  handle: string;
  lastMessage: string;
  time: string;
  unreadCount?: number;
  online?: boolean;
};

export type ChatMessage = {
  id: string;
  sender: "me" | "other";
  body: string;
  time: string;
};

export const messageThreads: MessageThread[] = [
  {
    id: "design-room",
    name: "Elizabeth Olsen",
    handle: "@elizabeth",
    lastMessage: "Let's keep the first version simple and clean.",
    time: "9:42 AM",
    unreadCount: 2,
    online: true,
  },
  {
    id: "frontend-sync",
    name: "Brad Frost",
    handle: "@brad",
    lastMessage: "Navbar spacing looks much better now.",
    time: "8:18 AM",
  },
  {
    id: "product-notes",
    name: "Lina Roy",
    handle: "@lina",
    lastMessage: "We can polish the message composer later.",
    time: "Yesterday",
  },
];

export const threadMessages: Record<string, ChatMessage[]> = {
  "design-room": [
    { id: "m1", sender: "other", body: "Let's keep the first version simple and clean.", time: "9:34 AM" },
    { id: "m2", sender: "me", body: "Agreed. We can layer in details after the basic flow feels right.", time: "9:36 AM" },
    { id: "m3", sender: "other", body: "Perfect. Start with messages routes and we'll refine from there.", time: "9:42 AM" },
  ],
  "frontend-sync": [
    { id: "m1", sender: "other", body: "Navbar spacing looks much better now.", time: "8:18 AM" },
    { id: "m2", sender: "me", body: "Nice. I'll keep the message layout simple too.", time: "8:22 AM" },
  ],
  "product-notes": [
    { id: "m1", sender: "other", body: "We can polish the message composer later.", time: "Yesterday" },
    { id: "m2", sender: "me", body: "Yes, first I'll keep the shell reusable and lightweight.", time: "Yesterday" },
  ],
};
