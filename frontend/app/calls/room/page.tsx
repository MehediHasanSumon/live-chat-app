import { Suspense } from "react";

import { AudioCallWindow } from "@/components/calls/audio-call-window";

export default function CallRoomPage() {
  return (
    <Suspense fallback={null}>
      <AudioCallWindow />
    </Suspense>
  );
}
