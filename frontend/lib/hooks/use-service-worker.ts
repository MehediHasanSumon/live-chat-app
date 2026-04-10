import { useEffect } from "react";

/**
 * Hook to register and manage service worker
 * Handles offline support and static asset caching
 *
 * @example
 * ```ts
 * export default function RootLayout() {
 *   useServiceWorker();
 *   return <div>...</div>;
 * }
 * ```
 */
export function useServiceWorker() {
  useEffect(() => {
    // Only run in browser and production
    if (typeof window === "undefined" || process.env.NODE_ENV !== "production") {
      return;
    }

    // Check if service workers are supported
    if (!("serviceWorker" in navigator)) {
      console.debug("[ServiceWorker] Not supported in this browser");
      return;
    }

    const registerServiceWorker = async () => {
      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        console.debug("[ServiceWorker] Registration successful:", registration.scope);

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;

          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated") {
                console.debug("[ServiceWorker] Updated and activated");

                // Optionally notify user of update
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("sw:updated"));
                }
              }
            });
          }
        });

        // Handle controller change (new service worker took over)
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      } catch (error) {
        console.debug("[ServiceWorker] Registration failed:", error);
      }
    };

    // Register on load
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", registerServiceWorker);
    } else {
      registerServiceWorker();
    }

    // Cleanup
    return () => {
      document.removeEventListener("DOMContentLoaded", registerServiceWorker);
    };
  }, []);
}
