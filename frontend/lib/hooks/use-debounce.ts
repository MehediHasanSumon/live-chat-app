import { useCallback, useRef } from "react";

/**
 * Hook to debounce async callback functions
 * Prevents multiple rapid requests from being sent to the server
 *
 * @param callback - Async function to debounce
 * @param delayMs - Delay in milliseconds (default: 500)
 * @returns Debounced callback function
 *
 * @example
 * ```ts
 * const debouncedSearch = useDebounce(async (query: string) => {
 *   const results = await api.search(query);
 *   setResults(results);
 * }, 300);
 *
 * // In component
 * <input onChange={(e) => debouncedSearch(e.target.value)} />
 * ```
 */
export function useDebounce<TArgs extends readonly unknown[], TResult>(
  callback: (...args: TArgs) => Promise<TResult>,
  delayMs: number = 500,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);

  return useCallback(
    (...args: TArgs) => {
      // Don't queue another request if one is already pending
      if (pendingRef.current) return;

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout for the callback
      timeoutRef.current = setTimeout(async () => {
        pendingRef.current = true;
        try {
          await callback(...args);
        } finally {
          pendingRef.current = false;
        }
      }, delayMs);
    },
    [callback, delayMs],
  );
}
