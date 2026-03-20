/**
 * Mobile optimization utilities
 * Implements Requirements 7.1, 7.2, 10.1, 10.2 - mobile responsiveness and performance
 */

// Touch target minimum size (44px as per WCAG guidelines)
export const TOUCH_TARGET_MIN_SIZE = 44;

// Breakpoints for responsive design
export const BREAKPOINTS = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Detect if the device is mobile based on screen size and user agent
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check screen size
  const isMobileScreen = window.innerWidth <= BREAKPOINTS.md;
  
  // Check user agent for mobile indicators
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
  
  return isMobileScreen || isMobileUA;
};

/**
 * Detect if the device supports touch
 */
export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - legacy property
    navigator.msMaxTouchPoints > 0
  );
};

/**
 * Get the current viewport size
 */
export const getViewportSize = () => {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }
  
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

/**
 * Check if the current viewport matches a breakpoint
 */
export const matchesBreakpoint = (breakpoint: keyof typeof BREAKPOINTS): boolean => {
  const { width } = getViewportSize();
  return width >= BREAKPOINTS[breakpoint];
};

/**
 * Get the current breakpoint
 */
export const getCurrentBreakpoint = (): keyof typeof BREAKPOINTS => {
  const { width } = getViewportSize();
  
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
};

/**
 * Optimize touch targets for mobile devices
 */
export const optimizeTouchTarget = (element: HTMLElement): void => {
  if (!isTouchDevice()) return;
  
  const rect = element.getBoundingClientRect();
  const minSize = TOUCH_TARGET_MIN_SIZE;
  
  // Ensure minimum touch target size
  if (rect.width < minSize || rect.height < minSize) {
    element.style.minWidth = `${minSize}px`;
    element.style.minHeight = `${minSize}px`;
    element.style.padding = element.style.padding || '8px';
  }
};

/**
 * Add mobile-specific event listeners
 */
export const addMobileEventListeners = (
  element: HTMLElement,
  handlers: {
    onTouchStart?: (e: TouchEvent) => void;
    onTouchEnd?: (e: TouchEvent) => void;
    onTouchMove?: (e: TouchEvent) => void;
  }
): (() => void) => {
  const { onTouchStart, onTouchEnd, onTouchMove } = handlers;
  
  if (onTouchStart) {
    element.addEventListener('touchstart', onTouchStart, { passive: true });
  }
  
  if (onTouchEnd) {
    element.addEventListener('touchend', onTouchEnd, { passive: true });
  }
  
  if (onTouchMove) {
    element.addEventListener('touchmove', onTouchMove, { passive: true });
  }
  
  // Return cleanup function
  return () => {
    if (onTouchStart) {
      element.removeEventListener('touchstart', onTouchStart);
    }
    if (onTouchEnd) {
      element.removeEventListener('touchend', onTouchEnd);
    }
    if (onTouchMove) {
      element.removeEventListener('touchmove', onTouchMove);
    }
  };
};

/**
 * Prevent zoom on double tap for specific elements
 */
export const preventDoubleTabZoom = (element: HTMLElement): void => {
  let lastTouchEnd = 0;
  
  element.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
};

/**
 * Optimize scrolling performance on mobile
 */
export const optimizeScrolling = (element: HTMLElement): void => {
  // Enable momentum scrolling on iOS
  (element.style as any).webkitOverflowScrolling = 'touch';
  
  // Improve scroll performance
  element.style.transform = 'translateZ(0)';
  element.style.willChange = 'scroll-position';
};

/**
 * Debounce function for performance optimization
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function for performance optimization
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Lazy load images for better performance
 */
export const lazyLoadImage = (img: HTMLImageElement, src: string): void => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          img.src = src;
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    },
    { threshold: 0.1 }
  );
  
  observer.observe(img);
};

/**
 * Preload critical resources
 */
export const preloadResource = (href: string, as: string): void => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  document.head.appendChild(link);
};

/**
 * Check if reduced motion is preferred
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Get safe area insets for devices with notches
 */
export const getSafeAreaInsets = () => {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  
  const style = getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0', 10),
    right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0', 10),
    bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0', 10),
    left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0', 10),
  };
};

/**
 * Hook for responsive behavior
 */
export const useResponsive = () => {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      breakpoint: 'lg' as keyof typeof BREAKPOINTS,
    };
  }
  
  const breakpoint = getCurrentBreakpoint();
  
  return {
    isMobile: breakpoint === 'xs' || breakpoint === 'sm',
    isTablet: breakpoint === 'md',
    isDesktop: breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === '2xl',
    breakpoint,
  };
};