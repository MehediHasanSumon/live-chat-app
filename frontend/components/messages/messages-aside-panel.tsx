"use client";

import { ReactNode, useEffect, useState } from "react";

type MessagesAsidePanelProps = {
  children: ReactNode;
};

export function MessagesAsidePanel({ children }: MessagesAsidePanelProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={`h-full transition-all duration-300 ease-out ${
        isVisible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}
