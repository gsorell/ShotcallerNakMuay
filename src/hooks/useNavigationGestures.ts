import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

export interface NavigationGesturesOptions {
  onBack: () => void;
  enabled: boolean;
  debugLog?: boolean;
}

export function useNavigationGestures({ onBack, enabled, debugLog = false }: NavigationGesturesOptions) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const isSwipeInProgress = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Hardware back button handler for mobile apps
    let backButtonListener: PluginListenerHandle | null = null;

    const setupBackButtonHandler = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Remove any existing listener first
          if (backButtonListener) {
            backButtonListener.remove();
          }

          // Add hardware back button listener
          backButtonListener = await App.addListener('backButton', () => {
            if (debugLog) {
              // Hardware back button pressed
            }
            onBack();
          });

          if (debugLog) {
            // Hardware back button listener registered
          }
        } catch (error) {
          // Failed to register hardware back button listener
        }
      }
    };

    setupBackButtonHandler();

    // Left-to-right swipe gesture detection
    const handleTouchStart = (e: TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      if (!touch) return;

      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      touchStartTime.current = Date.now();
      isSwipeInProgress.current = false;

      // Only start tracking if the swipe begins near the left edge
      const leftEdgeThreshold = 50; // pixels from left edge
      if (touch.clientX <= leftEdgeThreshold) {
        isSwipeInProgress.current = true;
        if (debugLog) {
          // Touch started near left edge
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!enabled || !isSwipeInProgress.current) return;

      const touch = e.touches[0];
      if (!touch || touchStartX.current === null || touchStartY.current === null) return;

      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;

      // If user moves more vertically than horizontally, cancel swipe
      if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        isSwipeInProgress.current = false;
        if (debugLog) {
          // Swipe cancelled: too much vertical movement
        }
        return;
      }

      // Prevent default scrolling if we're in a valid horizontal swipe
      if (Math.abs(deltaX) > 10) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!enabled || !isSwipeInProgress.current) return;

      const touch = e.changedTouches[0];
      if (!touch || touchStartX.current === null || touchStartY.current === null || touchStartTime.current === null) {
        isSwipeInProgress.current = false;
        return;
      }

      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;
      const deltaTime = Date.now() - touchStartTime.current;

      // Reset tracking state
      isSwipeInProgress.current = false;
      touchStartX.current = null;
      touchStartY.current = null;
      touchStartTime.current = null;

      // Swipe validation criteria
      const minSwipeDistance = 100; // minimum pixels
      const maxSwipeTime = 500; // maximum milliseconds
      const maxVerticalDeviation = 80; // maximum vertical movement

      const isValidSwipe = 
        deltaX > minSwipeDistance && // sufficient horizontal distance
        deltaTime < maxSwipeTime && // fast enough
        Math.abs(deltaY) < maxVerticalDeviation; // not too much vertical movement

      if (isValidSwipe) {
        if (debugLog) {
          // Valid left-to-right swipe detected
        }
        onBack();
      } else if (debugLog) {
        // Invalid swipe
      }
    };

    // Add touch event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Cleanup function
    return () => {
      // Remove touch listeners
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      // Remove hardware back button listener
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [enabled, onBack, debugLog]);

  // Keyboard support for desktop testing (Escape key)
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (debugLog) {
          // Escape key pressed
        }
        onBack();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onBack, debugLog]);
}