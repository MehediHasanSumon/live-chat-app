import { redirect } from "next/navigation";

export default function LegacyBlockedPage() {
  redirect("/messages/blocked-account");
}
