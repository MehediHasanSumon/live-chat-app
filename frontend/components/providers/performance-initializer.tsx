'use client';

import { useEffect } from 'react';
import { initWebVitals } from '@/lib/web-vitals';
import { useServiceWorker } from '@/lib/hooks/use-service-worker';

/**
 * Client-side performance and offline support initializer
 * This component should be rendered in the root layout
 */
export function PerformanceInitializer() {
    // Initialize service worker for offline support and caching
    useServiceWorker();

    // Initialize web vitals monitoring
    useEffect(() => {
        // Only initialize in production
        if (process.env.NODE_ENV === 'production') {
            initWebVitals();
        } else {
            // In development, log when initialized
            console.debug('[Performance] Web Vitals tracking initialized (dev)');
        }
    }, []);

    return null;
}
