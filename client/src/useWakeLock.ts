import { useState, useEffect, useCallback } from 'react';

/**
 * A custom React hook to manage a screen wake lock.
 * It requests a wake lock and handles re-acquisition when the document becomes visible again.
 * @returns {object} An object containing functions to request and release the wake lock.
 */
export const useWakeLock = () => {
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  // Function to request the wake lock
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      console.warn('Screen Wake Lock API not supported on this browser.');
      return;
    }
    try {
      const lock = await navigator.wakeLock.request('screen');
      setWakeLock(lock);
      console.log('Screen Wake Lock is active.');

      // Listen for the release event
      lock.addEventListener('release', () => {
        console.log('Screen Wake Lock was released by the system.');
        setWakeLock(null);
      });
    } catch (err: any) {
      console.error(`Failed to acquire Screen Wake Lock: ${err.name}, ${err.message}`);
    }
  }, []);

  // Function to release the wake lock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
      console.log('Screen Wake Lock released.');
    }
  }, [wakeLock]);

  useEffect(() => {
    // Re-acquire the lock if the page becomes visible again
    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [wakeLock, requestWakeLock, releaseWakeLock]);

  return { requestWakeLock, releaseWakeLock };
};