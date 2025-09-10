import { useCallback, useEffect, useRef, useState } from 'react';

type UseWakeLockOpts = {
  enabled: boolean;
  log?: boolean;
};

type Method = 'wakeLock' | 'nosleep' | 'none';

/**
 * A custom React hook to manage a screen wake lock.
 * It requests a wake lock and handles re-acquisition when the document becomes visible again.
 * @returns {object} An object containing functions to request and release the wake lock.
 */
export function useWakeLock({ enabled, log }: UseWakeLockOpts) {
  const [active, setActive] = useState(false);
  const [method, setMethod] = useState<Method>('none');
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const noSleepRef = useRef<any>(null); // NoSleep instance
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const debug = (...args: any[]) => {
    if (log) console.log('[WakeLock]', ...args);
  };

  const releaseAll = useCallback(async () => {
    try {
      if (sentinelRef.current) {
        try {
          await sentinelRef.current.release();
        } catch {}
        sentinelRef.current = null;
      }
      if (noSleepRef.current) {
        try {
          noSleepRef.current.disable();
        } catch {}
        noSleepRef.current = null;
      }
    } finally {
      setActive(false);
      setMethod('none');
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!enabledRef.current) return;

    // Try Screen Wake Lock API first
    if ('wakeLock' in navigator && (navigator as any).wakeLock?.request) {
      try {
        const sentinel: WakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        sentinelRef.current = sentinel;
        setActive(true);
        setMethod('wakeLock');
        setError(null);
        debug('Screen Wake Lock is active.');
        sentinel.addEventListener('release', () => {
          debug('Screen Wake Lock was released by the system.');
          setActive(false);
          if (enabledRef.current && document.visibilityState === 'visible') {
            // Re-acquire if still enabled
            requestWakeLock().catch(() => {});
          }
        });
        return;
      } catch (e: any) {
        debug('Wake Lock API failed:', e?.message || e);
        setError(String(e?.message || e));
        // fall through to NoSleep
      }
    }

    // Fallback: NoSleep.js (iOS/old Android)
    try {
      if (!noSleepRef.current) {
        const mod = await import('nosleep.js');
        noSleepRef.current = new mod.default();
      }
      await noSleepRef.current.enable(); // must be called after a user gesture
      setActive(true);
      setMethod('nosleep');
      setError(null);
      debug('NoSleep fallback is active.');
    } catch (e: any) {
      debug('NoSleep fallback failed:', e?.message || e);
      setError(String(e?.message || e));
      setActive(false);
      setMethod('none');
    }
  }, [debug]);

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

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && enabledRef.current) {
        requestWakeLock().catch(() => {});
      }
    };

    const onOrientation = () => {
      if (enabledRef.current) requestWakeLock().catch(() => {});
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('orientationchange', onOrientation);

    return () => {
      if (disposed) return;
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('orientationchange', onOrientation);
      releaseAll();
    };
  }, [requestWakeLock, releaseAll]);

  return { active, method, error };
}

export default useWakeLock;

// Types for TS DOM lib gaps
interface WakeLockSentinel extends EventTarget {
  released: boolean;
  type: 'screen';
  release(): Promise<void>;
}