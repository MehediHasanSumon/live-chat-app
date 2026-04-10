/**
 * Web Vitals monitoring
 * Reports Core Web Vitals and other key metrics
 * See: https://web.dev/vitals/
 */

export interface WebVitalsMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  navigationType: string;
}

/**
 * Send web vitals to analytics endpoint
 * @param metric - Web Vitals metric from web-vitals library
 */
export async function reportWebVital(metric: WebVitalsMetric) {
  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value.toFixed(2),
      rating: metric.rating,
    });
  }

  // Send to analytics in production
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_API_URL) {
    try {
      // Use sendBeacon for reliability - data sent even if page unloads
      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${process.env.NEXT_PUBLIC_API_URL}/api/analytics/web-vitals`, JSON.stringify(metric));
      }
    } catch (error) {
      console.error("[Web Vitals] Failed to report metric:", error);
    }
  }
}

/**
 * Initialize Web Vitals tracking
 * Call this in your root layout or app component
 *
 * @example
 * ```ts
 * // In app/layout.tsx
 * import { initWebVitals } from '@/lib/web-vitals';
 *
 * export default function RootLayout() {
 *   useEffect(() => {
 *     initWebVitals();
 *   }, []);
 *
 *   return (
 *     <html>
 *       <body>...</body>
 *     </html>
 *   );
 * }
 * ```
 */
export async function initWebVitals() {
  if (typeof window === "undefined") return;

  try {
    // Dynamically import web-vitals library
    const webVitals = await import("web-vitals");
    webVitals.onCLS(reportWebVital);
    webVitals.onFCP(reportWebVital);
    webVitals.onINP(reportWebVital);
    webVitals.onLCP(reportWebVital);
    webVitals.onTTFB(reportWebVital);
  } catch (error) {
    console.debug("[Web Vitals] Library not available:", error);
  }
}
