/**
 * Performance optimization utilities
 * Implements Requirements 10.1, 10.2 - loading times and performance optimization
 */

// Performance metrics tracking
interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  interactionTime: number;
  memoryUsage?: number;
}

/**
 * Measure page load performance
 */
export const measurePageLoad = (): Promise<PerformanceMetrics> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ loadTime: 0, renderTime: 0, interactionTime: 0 });
      return;
    }

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const navigation = entries.find(entry => entry.entryType === 'navigation') as PerformanceNavigationTiming;
      
      if (navigation) {
        const metrics: PerformanceMetrics = {
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          renderTime: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          interactionTime: navigation.domInteractive - (navigation as any).domLoading,
        };

        // Add memory usage if available
        if ('memory' in performance) {
          // @ts-ignore - memory is not in standard types
          metrics.memoryUsage = performance.memory.usedJSHeapSize;
        }

        resolve(metrics);
        observer.disconnect();
      }
    });

    observer.observe({ entryTypes: ['navigation'] });

    // Fallback timeout
    setTimeout(() => {
      observer.disconnect();
      resolve({ loadTime: 0, renderTime: 0, interactionTime: 0 });
    }, 5000);
  });
};

/**
 * Optimize images for faster loading
 */
export const optimizeImage = (
  src: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}
): string => {
  // In a real implementation, this would integrate with an image optimization service
  // For now, we'll return the original src with some basic optimizations
  
  const { width, height, quality = 80, format = 'webp' } = options;
  
  // If it's already optimized or external, return as-is
  if (src.includes('optimized') || src.startsWith('http')) {
    return src;
  }
  
  // Add optimization parameters (this would work with a service like Cloudinary)
  let optimizedSrc = src;
  
  if (width || height) {
    const dimensions = [];
    if (width) dimensions.push(`w_${width}`);
    if (height) dimensions.push(`h_${height}`);
    optimizedSrc += `?${dimensions.join(',')}&q_${quality}&f_${format}`;
  }
  
  return optimizedSrc;
};

/**
 * Lazy load component with intersection observer
 */
export const createLazyComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) => {
  const LazyComponent = React.lazy(importFn);
  
  return (props: React.ComponentProps<T>) => (
    <React.Suspense fallback={fallback ? React.createElement(fallback) : <div>Loading...</div>}>
      <LazyComponent {...props} />
    </React.Suspense>
  );
};

/**
 * Preload critical resources
 */
export const preloadCriticalResources = (resources: Array<{
  href: string;
  as: 'script' | 'style' | 'font' | 'image';
  type?: string;
  crossorigin?: 'anonymous' | 'use-credentials';
}>) => {
  if (typeof document === 'undefined') return;

  resources.forEach(({ href, as, type, crossorigin }) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    
    if (type) link.type = type;
    if (crossorigin) link.crossOrigin = crossorigin;
    
    document.head.appendChild(link);
  });
};

/**
 * Optimize bundle loading with dynamic imports
 */
export const loadChunk = async (chunkName: string): Promise<any> => {
  try {
    switch (chunkName) {
      case 'charts':
        // Commented out recharts import since it's not installed
        // return await import(/* webpackChunkName: "charts" */ 'recharts');
        return Promise.resolve({});
      case 'qr':
        return await import(/* webpackChunkName: "qr" */ 'qrcode');
      case 'scanner':
        return await import(/* webpackChunkName: "scanner" */ 'qr-scanner');
      default:
        throw new Error(`Unknown chunk: ${chunkName}`);
    }
  } catch (error) {
    console.error(`Failed to load chunk ${chunkName}:`, error);
    throw error;
  }
};

/**
 * Memory management utilities
 */
export const cleanupMemory = () => {
  // Clear any cached data that's no longer needed
  if (typeof window !== 'undefined') {
    // Clear old cache entries
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('old') || name.includes('temp')) {
            caches.delete(name);
          }
        });
      });
    }
    
    // Force garbage collection if available (development only)
    if (process.env.NODE_ENV === 'development' && 'gc' in window) {
      // @ts-ignore
      window.gc();
    }
  }
};

/**
 * Network-aware loading
 */
export const getNetworkInfo = () => {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return { effectiveType: '4g', downlink: 10, rtt: 100 };
  }
  
  // @ts-ignore - connection is not in standard types
  const connection = (navigator as any).connection;

  return {
    effectiveType: (connection as any)?.effectiveType || '4g',
    downlink: (connection as any)?.downlink || 10,
    rtt: (connection as any)?.rtt || 100,
  };
};

/**
 * Adaptive loading based on network conditions
 */
export const shouldLoadHighQuality = (): boolean => {
  const { effectiveType, downlink } = getNetworkInfo();
  
  // Load high quality on fast connections
  return effectiveType === '4g' && downlink > 5;
};

/**
 * Service Worker utilities for caching
 */
export const registerServiceWorker = async (swPath: string = '/sw.js') => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  
  try {
    const registration = await navigator.serviceWorker.register(swPath);
    
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content available, prompt user to refresh
            if (window.confirm('New version available. Refresh to update?')) {
              window.location.reload();
            }
          }
        });
      }
    });
    
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

/**
 * Critical CSS inlining utility
 */
export const inlineCriticalCSS = (css: string) => {
  if (typeof document === 'undefined') return;
  
  const style = document.createElement('style');
  style.textContent = css;
  style.setAttribute('data-critical', 'true');
  document.head.appendChild(style);
};

/**
 * Resource hints for better loading
 */
export const addResourceHints = (hints: Array<{
  rel: 'dns-prefetch' | 'preconnect' | 'prefetch';
  href: string;
  crossorigin?: boolean;
}>) => {
  if (typeof document === 'undefined') return;
  
  hints.forEach(({ rel, href, crossorigin }) => {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    
    if (crossorigin) {
      link.crossOrigin = 'anonymous';
    }
    
    document.head.appendChild(link);
  });
};

// React import for lazy component creation
import React from 'react';