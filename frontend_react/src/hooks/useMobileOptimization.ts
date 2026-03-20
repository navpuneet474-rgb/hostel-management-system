import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isMobileDevice,
  isTouchDevice,
  getViewportSize,
  getCurrentBreakpoint,
  debounce,
  optimizeTouchTarget,
  addMobileEventListeners,
  BREAKPOINTS,
} from '../utils/mobile';

export interface UseMobileOptimizationReturn {
  /** Whether the device is mobile */
  isMobile: boolean;
  /** Whether the device supports touch */
  isTouch: boolean;
  /** Current viewport dimensions */
  viewport: { width: number; height: number };
  /** Current breakpoint */
  breakpoint: keyof typeof BREAKPOINTS;
  /** Whether the device is in landscape mode */
  isLandscape: boolean;
  /** Whether the device is in portrait mode */
  isPortrait: boolean;
  /** Optimize an element for touch */
  optimizeForTouch: (element: HTMLElement) => void;
  /** Add mobile event listeners to an element */
  addTouchListeners: (
    element: HTMLElement,
    handlers: {
      onTouchStart?: (e: TouchEvent) => void;
      onTouchEnd?: (e: TouchEvent) => void;
      onTouchMove?: (e: TouchEvent) => void;
    }
  ) => () => void;
}

/**
 * Hook for mobile optimization and responsive behavior
 * Implements Requirements 7.1, 7.2, 10.1, 10.2
 */
export function useMobileOptimization(): UseMobileOptimizationReturn {
  const [isMobile, setIsMobile] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [breakpoint, setBreakpoint] = useState<keyof typeof BREAKPOINTS>('lg');

  // Debounced resize handler for performance
  const handleResize = useCallback(
    debounce(() => {
      const newViewport = getViewportSize();
      const newBreakpoint = getCurrentBreakpoint();
      
      setViewport(newViewport);
      setBreakpoint(newBreakpoint);
      setIsMobile(isMobileDevice());
    }, 150),
    []
  );

  // Initialize and set up event listeners
  useEffect(() => {
    // Initial setup
    setIsMobile(isMobileDevice());
    setIsTouch(isTouchDevice());
    setViewport(getViewportSize());
    setBreakpoint(getCurrentBreakpoint());

    // Add resize listener
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [handleResize]);

  // Derived states
  const isLandscape = viewport.width > viewport.height;
  const isPortrait = viewport.height > viewport.width;

  // Utility functions
  const optimizeForTouch = useCallback((element: HTMLElement) => {
    optimizeTouchTarget(element);
  }, []);

  const addTouchListeners = useCallback((
    element: HTMLElement,
    handlers: {
      onTouchStart?: (e: TouchEvent) => void;
      onTouchEnd?: (e: TouchEvent) => void;
      onTouchMove?: (e: TouchEvent) => void;
    }
  ) => {
    return addMobileEventListeners(element, handlers);
  }, []);

  return {
    isMobile,
    isTouch,
    viewport,
    breakpoint,
    isLandscape,
    isPortrait,
    optimizeForTouch,
    addTouchListeners,
  };
}

/**
 * Hook for touch gesture handling
 */
export function useTouchGestures(element: React.RefObject<HTMLElement>) {
  const [isPressed, setIsPressed] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = element.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      setIsPressed(true);
      setStartPos({ x: touch.clientX, y: touch.clientY });
      setCurrentPos({ x: touch.clientX, y: touch.clientY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPressed) return;
      
      const touch = e.touches[0];
      setCurrentPos({ x: touch.clientX, y: touch.clientY });
    };

    const handleTouchEnd = () => {
      setIsPressed(false);
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [element, isPressed]);

  // Calculate gesture properties
  const deltaX = currentPos.x - startPos.x;
  const deltaY = currentPos.y - startPos.y;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  return {
    isPressed,
    startPos,
    currentPos,
    deltaX,
    deltaY,
    distance,
    angle,
  };
}

/**
 * Hook for swipe gesture detection
 */
export function useSwipeGesture(
  element: React.RefObject<HTMLElement>,
  options: {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    threshold?: number;
  } = {}
) {
  const { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 50 } = options;
  const { isPressed, deltaX, deltaY, distance } = useTouchGestures(element);

  useEffect(() => {
    if (!isPressed && distance > threshold) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    }
  }, [isPressed, deltaX, deltaY, distance, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return { deltaX, deltaY, distance, isPressed };
}

/**
 * Hook for pull-to-refresh functionality
 */
export function usePullToRefresh(
  element: React.RefObject<HTMLElement>,
  onRefresh: () => void | Promise<void>,
  options: {
    threshold?: number;
    resistance?: number;
    enabled?: boolean;
  } = {}
) {
  const { threshold = 80, resistance = 2.5, enabled = true } = options;
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { isPressed, deltaY } = useTouchGestures(element);

  useEffect(() => {
    if (!enabled) return;

    if (isPressed && deltaY > 0) {
      // Calculate pull distance with resistance
      const distance = Math.min(deltaY / resistance, threshold * 1.5);
      setPullDistance(distance);
      setIsPulling(distance > threshold);
    } else if (!isPressed && isPulling && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true);
      
      const refreshPromise = onRefresh();
      
      if (refreshPromise instanceof Promise) {
        refreshPromise.finally(() => {
          setIsRefreshing(false);
          setIsPulling(false);
          setPullDistance(0);
        });
      } else {
        setTimeout(() => {
          setIsRefreshing(false);
          setIsPulling(false);
          setPullDistance(0);
        }, 1000);
      }
    } else if (!isPressed) {
      // Reset state
      setIsPulling(false);
      setPullDistance(0);
    }
  }, [isPressed, deltaY, isPulling, isRefreshing, threshold, resistance, enabled, onRefresh]);

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    shouldTrigger: pullDistance > threshold,
  };
}