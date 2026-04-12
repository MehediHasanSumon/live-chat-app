import { Suspense } from "react";

import { AudioCallWindow } from "@/components/calls/audio-call-window";

export default function AudioCallPage() {
  return (
    <Suspense fallback={null}>
      <AudioCallWindow />
    </Suspense>
  );
}
