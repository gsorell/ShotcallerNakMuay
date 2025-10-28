import { useEffect, useState, useRef, useCallback } from 'react';
import { useVisibilityManager } from './hooks/useVisibilityManager';


type Method = 'wakeLock' | 'nosleep' | 'none';

/**
 * A custom React hook to manage a screen wake lock.
 * It requests a wake lock and handles re-acquisition when the document becomes visible again.
 * @returns {object} An object containing functions to request and release the wake lock.
 */
export function useWakeLock(opts: { enabled: boolean; log?: boolean }) {
  const { enabled, log } = opts;
  const [active, setActive] = useState(false);
  const [method, setMethod] = useState<Method>('none');
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const noSleepRef = useRef<any>(null); // NoSleep instance
  const enabledRef = useRef(enabled);
  const requestTimeoutRef = useRef<number | null>(null);
  const isRequestingRef = useRef(false);
  enabledRef.current = enabled;

  const debug = (...args: any[]) => {
    // Debug logging removed for production
  };

  const releaseAll = useCallback(async () => {
    // Cancel any pending requests
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
    isRequestingRef.current = false;

    try {
      if (sentinelRef.current) {
        try {
          await sentinelRef.current.release();
          debug('Wake Lock released');
        } catch {}
        sentinelRef.current = null;
      }
      
      // Only disable NoSleep on component unmount, not on every visibility change
      // This prevents WebMediaPlayer accumulation from repeated enable/disable cycles
      if (noSleepRef.current) {
        try {
          noSleepRef.current.disable();
          debug('NoSleep disabled (keeping instance for reuse)');
          // Don't set noSleepRef.current = null here - keep the instance for reuse
        } catch {}
      }
    } finally {
      setActive(false);
      setMethod('none');
    }
  }, [debug]);

  const requestWakeLock = useCallback(async () => {
    if (!enabledRef.current || isRequestingRef.current) {
      debug('Wake lock request skipped - disabled or already requesting');
      return;
    }

    isRequestingRef.current = true;

    try {
      // Try Screen Wake Lock API first (preferred method)
      if ('wakeLock' in navigator && (navigator as any).wakeLock?.request) {
        try {
          // Only clean up existing wake lock, don't touch NoSleep
          if (sentinelRef.current) {
            try {
              await sentinelRef.current.release();
            } catch {}
            sentinelRef.current = null;
          }

          const sentinel: WakeLockSentinel = await (navigator as any).wakeLock.request('screen');
          sentinelRef.current = sentinel;
          setActive(true);
          setMethod('wakeLock');
          setError(null);
          debug('Screen Wake Lock is active.');
          
          sentinel.addEventListener('release', () => {
            debug('Screen Wake Lock was released by the system.');
            setActive(false);
            
            // Debounced re-acquisition to prevent rapid recreation during tab switching
            if (enabledRef.current && document.visibilityState === 'visible') {
              if (requestTimeoutRef.current) {
                clearTimeout(requestTimeoutRef.current);
              }
              requestTimeoutRef.current = window.setTimeout(() => {
                requestWakeLock().catch(() => {});
              }, 2000); // Increased to 2 seconds for better debouncing
            }
          });
          return;
        } catch (e: any) {
          debug('Wake Lock API failed:', e?.message || e);
          setError(String(e?.message || e));
          // fall through to NoSleep
        }
      }

      // Fallback: NoSleep.js (iOS/old Android) - REUSE existing instance
      try {
        // Create NoSleep instance only ONCE per component lifecycle
        if (!noSleepRef.current) {
          debug('Creating single NoSleep instance for component lifecycle');
          const mod = await import('nosleep.js');
          noSleepRef.current = new mod.default();
        }
        
        // Check if NoSleep is already enabled before enabling
        if (!active || method !== 'nosleep') {
          await noSleepRef.current.enable();
          setActive(true);
          setMethod('nosleep');
          setError(null);
          debug('NoSleep fallback is active (reused existing instance).');
        } else {
          debug('NoSleep already active, skipping re-enable');
        }
      } catch (e: any) {
        debug('NoSleep fallback failed:', e?.message || e);
        setError(String(e?.message || e));
        setActive(false);
        setMethod('none');
      }
    } finally {
      isRequestingRef.current = false;
    }
  }, [debug, active, method]);

  // Manage lifecycle
  useEffect(() => {
    let disposed = false;
    const ensure = async () => {
      if (!enabledRef.current) {
        await releaseAll();
        return;
      }
      await requestWakeLock();
    };
    ensure();

    const onOrientation = () => {
      if (enabledRef.current) requestWakeLock().catch(() => {});
    };

    window.addEventListener('orientationchange', onOrientation);

    return () => {
      if (disposed) return;
      disposed = true;
      
      // Clean up all timeouts
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      }
      
      window.removeEventListener('orientationchange', onOrientation);
      
      // Proper cleanup on component unmount - destroy NoSleep instance
      const cleanup = async () => {
        try {
          if (sentinelRef.current) {
            await sentinelRef.current.release();
            sentinelRef.current = null;
          }
          if (noSleepRef.current) {
            noSleepRef.current.disable();
            noSleepRef.current = null; // Actually destroy the instance on unmount
            debug('NoSleep instance destroyed on component unmount');
          }
        } catch (error) {
          debug('Error during component cleanup:', error);
        }
      };
      cleanup();
    };
  }, [requestWakeLock, releaseAll]);

  // Use centralized visibility manager for wake lock management with debouncing
  const onVisibleCallback = useCallback(() => {
    if (enabledRef.current && !isRequestingRef.current) {
      // Increased debouncing to prevent rapid NoSleep recreation during tab switching
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
      }
      requestTimeoutRef.current = window.setTimeout(() => {
        requestWakeLock().catch(() => {});
      }, 2000); // Wait 2 seconds for rapid tab switching to fully settle
    }
  }, [requestWakeLock]);

  const onHiddenCallback = useCallback(() => {
    // Cancel pending requests when tab becomes hidden
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
  }, []);

  useVisibilityManager('wake-lock', onVisibleCallback, onHiddenCallback);

  return { active, method, error };
}

export default useWakeLock;

// Types for TS DOM lib gaps
interface WakeLockSentinel extends EventTarget {
  released: boolean;
  type: 'screen';
  release(): Promise<void>;
}

