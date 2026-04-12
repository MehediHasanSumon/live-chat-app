"use client";

import { useEffect, useRef, useState } from "react";

const MIN_VISIBLE_MS = 320;

function isModifiedEvent(event: MouseEvent | PointerEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function NavigationProgress() {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [locationKey, setLocationKey] = useState("");
  const isNavigatingRef = useRef(false);
  const navigationStartedAtRef = useRef(0);
  const progressTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const startTimerRef = useRef<number | null>(null);

  function getLocationKey() {
    if (typeof window === "undefined") {
      return "";
    }

    return `${window.location.pathname}${window.location.search}`;
  }

  function clearTimers() {
    if (startTimerRef.current) {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }

    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  }

  useEffect(() => {
    setLocationKey(getLocationKey());

    function startNavigation() {
      if (isNavigatingRef.current) {
        return;
      }

      clearTimers();
      isNavigatingRef.current = true;
      navigationStartedAtRef.current = Date.now();
      setIsVisible(true);
      setProgress(18);

      progressTimerRef.current = window.setInterval(() => {
        setProgress((value) => {
          if (value >= 90) {
            return value;
          }

          if (value < 45) {
            return value + 10;
          }

          if (value < 72) {
            return value + 5;
          }

          return value + 2;
        });
      }, 160);
    }

    function scheduleStartNavigation() {
      if (startTimerRef.current || isNavigatingRef.current) {
        return;
      }

      startTimerRef.current = window.setTimeout(() => {
        startTimerRef.current = null;
        startNavigation();
      }, 0);
    }

    function handlePointerDown(event: PointerEvent) {
      if (isModifiedEvent(event)) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");

      if (!href || href.startsWith("#") || targetAttr === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);

      if (destination.origin !== current.origin) {
        return;
      }

      if (`${destination.pathname}${destination.search}` === `${current.pathname}${current.search}`) {
        return;
      }

      startNavigation();
    }

    function handleHistoryNavigation() {
      scheduleStartNavigation();
      setLocationKey(getLocationKey());
    }

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(...args) {
      scheduleStartNavigation();
      const result = originalPushState.apply(this, args);
      setLocationKey(getLocationKey());
      return result;
    };

    window.history.replaceState = function replaceState(...args) {
      scheduleStartNavigation();
      const result = originalReplaceState.apply(this, args);
      setLocationKey(getLocationKey());
      return result;
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("popstate", handleHistoryNavigation);

    return () => {
      clearTimers();
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("popstate", handleHistoryNavigation);
    };
  }, []);

  useEffect(() => {
    if (!isNavigatingRef.current) {
      return;
    }

    const elapsed = Date.now() - navigationStartedAtRef.current;
    const remaining = Math.max(MIN_VISIBLE_MS - elapsed, 0);

    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    finishTimerRef.current = window.setTimeout(() => {
      clearTimers();
      setProgress(100);

      window.setTimeout(() => {
        isNavigatingRef.current = false;
        setIsVisible(false);
        setProgress(0);
      }, 220);
    }, remaining);
  }, [locationKey]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 transition-opacity duration-150 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="navigation-progress-bar h-full"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );
}
