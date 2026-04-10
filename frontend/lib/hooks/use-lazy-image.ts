import { useEffect, useRef, useState } from "react";

/**
 * Hook for lazy loading images using Intersection Observer API
 * Images are only loaded when they come into the viewport
 *
 * @param imageSrc - Source URL of the image
 * @returns Object with imgRef and isLoaded state
 *
 * @example
 * ```ts
 * const { imgRef, isLoaded } = useLazyImage('/path/to/image.jpg');
 *
 * return (
 *   <img
 *     ref={imgRef}
 *     data-src="/path/to/image.jpg"
 *     className={isLoaded ? 'opacity-100' : 'opacity-0'}
 *   />
 * );
 * ```
 */
export function useLazyImage(imageSrc: string) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleImageError = () => {
    setError(new Error("Failed to load image."));
  };

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !imageSrc) return;

    // If IntersectionObserver is not supported, load image immediately
    if (!("IntersectionObserver" in window)) {
      img.src = imageSrc;
      img.onload = () => setIsLoaded(true);
      img.onerror = handleImageError;
      return;
    }

    // Create observer to load image when visible
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && img && !img.src) {
          img.src = imageSrc;

          img.onload = () => setIsLoaded(true);
          img.onerror = handleImageError;

          if (observerRef.current) {
            observerRef.current.unobserve(img);
          }
        }
      },
      {
        rootMargin: "50px", // Start loading 50px before visible
        threshold: 0,
      },
    );

    observerRef.current.observe(img);

    return () => {
      if (observerRef.current && img) {
        observerRef.current.unobserve(img);
        observerRef.current.disconnect();
      }
    };
  }, [imageSrc]);

  return { imgRef, isLoaded, error };
}
