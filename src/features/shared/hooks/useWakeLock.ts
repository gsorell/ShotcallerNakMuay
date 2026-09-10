import { KeepAwake } from "@capacitor-community/keep-awake";
import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useVisibilityManager } from "./useVisibilityManager";

type Method = "native" | "wakeLock" | "nosleep" | "none";

/**
 * A custom React hook to manage a screen wake lock.
 * It requests a wake lock and handles re-acquisition when the document becomes visible again.
 * @returns {object} An object containing functions to request and release the wake lock.
 */
export function useWakeLock(opts: { enabled: boolean; log?: boolean }) {
  const { enabled, log } = opts;
  const [active, setActive] = useState(false);
  const [method, setMethod] = useState<Method>("none");
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const noSleepRef = useRef<any>(null); // NoSleep instance
  const enabledRef = useRef(enabled);
  const requestTimeoutRef = useRef<number | null>(null);
  const isRequestingRef = useRef(false);
  enabledRef.current = enabled;

  // The visibility manager keys handlers by id, so two hook instances sharing a
  // literal id would clobber each other in its Map -- and one unmounting would
  // delete the other's handler. App mounts a disabled instance alongside the
  // workout's real one, so the id has to be per-instance.
  const instanceId = useId();

  const debug = (...args: any[]) => {
    if (log) console.log("[WakeLock]", ...args);
  };

  const releaseAll = useCallback(async () => {
    // Cancel any pending requests
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
    isRequestingRef.current = false;

    try {
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.allowSleep();
          debug("Native keep-awake released");
        } catch {}
      }

      if (sentinelRef.current) {
        try {
          await sentinelRef.current.release();
          debug("Wake Lock released");
        } catch {}
        sentinelRef.current = null;
      }

      // Only disable NoSleep on component unmount, not on every visibility change
      // This prevents WebMediaPlayer accumulation from repeated enable/disable cycles
      if (noSleepRef.current) {
        try {
          noSleepRef.current.disable();
          debug("NoSleep disabled (keeping instance for reuse)");
          // Don't set noSleepRef.current = null here - keep the instance for reuse
        } catch {}
      }
    } finally {
      setActive(false);
      setMethod("none");
    }
  }, []); // Remove debug dependency to prevent recreation

  const requestWakeLock = useCallback(async () => {
    if (!enabledRef.current || isRequestingRef.current) {
      debug("Wake lock request skipped - disabled or already requesting");
      return;
    }

    isRequestingRef.current = true;

    try {
      // On a native shell, ask the OS directly instead of going through the web
      // APIs. WKWebView does not reliably expose the Screen Wake Lock API, and
      // the NoSleep fallback below plays a hidden <video>, which iOS only allows
      // inside a user gesture -- long gone by the time the timer flips this on.
      // isIdleTimerDisabled has neither problem.
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.keepAwake();
          setActive(true);
          setMethod("native");
          setError(null);
          debug("Native keep-awake is active.");
          return;
        } catch (e: any) {
          debug("Native keep-awake failed:", e?.message || e);
          setError(String(e?.message || e));
          // fall through to the web paths
        }
      }

      // Try Screen Wake Lock API first (preferred method)
      if ("wakeLock" in navigator && (navigator as any).wakeLock?.request) {
        try {
          // Only clean up existing wake lock, don't touch NoSleep
          if (sentinelRef.current) {
            try {
              await sentinelRef.current.release();
            } catch {}
            sentinelRef.current = null;
          }

          const sentinel: WakeLockSentinel = await (
            navigator as any
          ).wakeLock.request("screen");
          sentinelRef.current = sentinel;
          setActive(true);
          setMethod("wakeLock");
          setError(null);
          debug("Screen Wake Lock is active.");

          sentinel.addEventListener("release", () => {
            debug("Screen Wake Lock was released by the system.");
            setActive(false);

            // Debounced re-acquisition to prevent rapid recreation during tab switching
            if (enabledRef.current && document.visibilityState === "visible") {
              if (requestTimeoutRef.current) {
                clearTimeout(requestTimeoutRef.current);
              }
              requestTimeoutRef.current = window.setTimeout(() => {
                requestWakeLock().catch(() => {});
              }, 500); // Reduced timeout to prevent device sleep during transitions
            }
          });
          return;
        } catch (e: any) {
          debug("Wake Lock API failed:", e?.message || e);
          setError(String(e?.message || e));
          // fall through to NoSleep
        }
      }

      // Fallback: NoSleep.js (iOS/old Android) - REUSE existing instance
      try {
        // Create NoSleep instance only ONCE per component lifecycle
        if (!noSleepRef.current) {
          debug("Creating single NoSleep instance for component lifecycle");
          const mod = await import("nosleep.js");
          noSleepRef.current = new mod.default();
        }

        // Always enable NoSleep to ensure it's working - don't skip
        await noSleepRef.current.enable();
        setActive(true);
        setMethod("nosleep");
        setError(null);
        debug("NoSleep fallback is active (reused existing instance).");
      } catch (e: any) {
        debug("NoSleep fallback failed:", e?.message || e);
        setError(String(e?.message || e));
        setActive(false);
        setMethod("none");
      }
    } finally {
      isRequestingRef.current = false;
    }
  }, []); // Remove unstable dependencies to prevent recreation

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

    window.addEventListener("orientationchange", onOrientation);

    return () => {
      if (disposed) return;
      disposed = true;

      // Clean up all timeouts
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      }

      window.removeEventListener("orientationchange", onOrientation);

      // Proper cleanup on component unmount - destroy NoSleep instance
      const cleanup = async () => {
        try {
          if (Capacitor.isNativePlatform()) {
            try {
              await KeepAwake.allowSleep();
            } catch {}
          }
          if (sentinelRef.current) {
            await sentinelRef.current.release();
            sentinelRef.current = null;
          }
          if (noSleepRef.current) {
            noSleepRef.current.disable();
            noSleepRef.current = null; // Actually destroy the instance on unmount
            debug("NoSleep instance destroyed on component unmount");
          }
        } catch (error) {
          debug("Error during component cleanup:", error);
        }
      };
      cleanup();
    };
  }, []); // Run once and use refs for state

  // Handle enabled state changes
  useEffect(() => {
    if (enabled) {
      requestWakeLock().catch(() => {});
    } else {
      releaseAll().catch(() => {});
    }
  }, [enabled, requestWakeLock, releaseAll]);

  // Use centralized visibility manager for wake lock management with debouncing
  const onVisibleCallback = useCallback(() => {
    if (enabledRef.current && !isRequestingRef.current) {
      // Increased debouncing to prevent rapid NoSleep recreation during tab switching
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
      }
      requestTimeoutRef.current = window.setTimeout(() => {
        requestWakeLock().catch(() => {});
      }, 500); // Reduced timeout to prevent device sleep during transitions
    }
  }, [requestWakeLock]);

  const onHiddenCallback = useCallback(() => {
    // Cancel pending requests when tab becomes hidden
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
  }, []);

  useVisibilityManager(
    `wake-lock-${instanceId}`,
    onVisibleCallback,
    onHiddenCallback
  );

  return { active, method, error };
}

export default useWakeLock;

// Types for TS DOM lib gaps
interface WakeLockSentinel extends EventTarget {
  released: boolean;
  type: "screen";
  release(): Promise<void>;
}
