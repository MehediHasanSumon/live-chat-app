import { redirect } from "next/navigation";

export default function LegacyArchivedPage() {
  redirect("/messages/archived-chats");
}
