import { useEffect } from "react";

/**
 * Hook to monitor component rendering performance
 * Logs performance metrics and marks to help identify bottlenecks
 *
 * @param componentName - Name of the component being monitored
 *
 * @example
 * ```ts
 * export function MyComponent() {
 *   usePerformanceMonitoring('MyComponent');
 *   // ... component logic
 * }
 * ```
 */
export function usePerformanceMonitoring(componentName: string) {
  useEffect(() => {
    // Mark component render start
    performance.mark(`${componentName}:start`);

    return () => {
      // Mark component render end
      performance.mark(`${componentName}:end`);

      try {
        // Measure the time between start and end
        performance.measure(`${componentName}:render`, `${componentName}:start`, `${componentName}:end`);

        // Get the measurement
        const measure = performance.getEntriesByName(`${componentName}:render`)[0];

        if (measure && measure.duration > 16.67) {
          // If render takes longer than one frame (16.67ms for 60fps)
          console.warn(`[Performance] ${componentName} took ${measure.duration.toFixed(2)}ms to render`);
        }
      } catch (error) {
        // Gracefully handle errors in performance measurement
        console.error(`[Performance] Error measuring ${componentName}:`, error);
      }
    };
  }, [componentName]);
}

/**
 * Hook to observe and report performance entries
 * Useful for tracking navigation timing, resource loading, etc.
 *
 * @param entryTypes - Types of entries to observe (e.g., 'navigation', 'resource')
 *
 * @example
 * ```ts
 * usePerformanceObserver(['navigation', 'resource']);
 * ```
 */
export function usePerformanceObserver(entryTypes: readonly string[]) {
  useEffect(() => {
    if (!("PerformanceObserver" in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 100) {
          // Log entries that took more than 100ms
          console.log(`[Perf] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
        }
      }
    });

    try {
      observer.observe({ entryTypes: [...entryTypes] });
    } catch (error) {
      console.debug("[Performance] EntryTypes not supported:", error);
    }

    return () => {
      observer.disconnect();
    };
  }, [entryTypes]);
}
