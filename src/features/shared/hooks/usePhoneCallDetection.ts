import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface PhoneCallState {
  isCallActive: boolean;
  isCallInterrupted: boolean;
  lastInterruption: Date | null;
  interruptionReason:
    | "phone-call"
    | "audio-interruption"
    | "visibility-change"
    | "focus-loss"
    | null;
}

export interface UsePhoneCallDetectionOptions {
  /**
   * Callback fired when a phone call or audio interruption is detected
   */
  onCallStart?: () => void;

  /**
   * Callback fired when the call/interruption ends
   */
  onCallEnd?: () => void;

  /**
   * Callback fired for any interruption event (start or end)
   */
  onInterruptionChange?: (interrupted: boolean, reason: string) => void;

  /**
   * Whether to automatically detect interruptions (default: true)
   */
  enabled?: boolean;

  /**
   * Minimum duration in ms before considering a visibility change as an interruption (default: 2000)
   * A short threshold ensures quick pause when receiving calls on mobile
   */
  interruptionThreshold?: number;

  /**
   * Whether to log debug information (default: false)
   */
  debug?: boolean;
}

/**
 * Hook to detect phone calls and audio interruptions across web and native platforms
 *
 * This hook provides comprehensive detection for:
 * - Phone calls on mobile devices
 * - Audio session interruptions (iOS/Android)
 * - App backgrounding during calls
 * - Focus loss events
 * - Audio context state changes
 *
 * Works in both web/PWA and Capacitor native environments
 */
export const usePhoneCallDetection = (
  options: UsePhoneCallDetectionOptions = {}
) => {
  const {
    onCallStart,
    onCallEnd,
    onInterruptionChange,
    enabled = true,
    interruptionThreshold = 2000,
    debug = false,
  } = options;

  const [callState, setCallState] = useState<PhoneCallState>({
    isCallActive: false,
    isCallInterrupted: false,
    lastInterruption: null,
    interruptionReason: null,
  });

  // Refs to prevent stale closures
  const interruptionTimeoutRef = useRef<number | null>(null);
  const visibilityTimeRef = useRef<number>(Date.now());
  const lastFocusTimeRef = useRef<number>(Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);
  const isNativeAppRef = useRef<boolean>(false);
  const callStateRef = useRef<PhoneCallState>(callState);

  // Update ref when state changes
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const log = useCallback(
    (message: string, ...args: any[]) => {
      if (debug) {
        console.log(`[PhoneCallDetection] ${message}`, ...args);
      }
    },
    [debug]
  );

  const updateCallState = useCallback(
    (updates: Partial<PhoneCallState>) => {
      setCallState((prev) => {
        const newState = { ...prev, ...updates };

        // Fire callbacks on state changes
        if (updates.isCallInterrupted !== undefined) {
          const wasInterrupted = prev.isCallInterrupted;
          const isNowInterrupted = updates.isCallInterrupted;

          if (wasInterrupted !== isNowInterrupted) {
            if (isNowInterrupted && onCallStart) {
              onCallStart();
            } else if (!isNowInterrupted && onCallEnd) {
              onCallEnd();
            }

            if (onInterruptionChange) {
              onInterruptionChange(
                isNowInterrupted,
                updates.interruptionReason || "unknown"
              );
            }
          }
        }

        return newState;
      });
    },
    [onCallStart, onCallEnd, onInterruptionChange]
  );

  const handleInterruption = useCallback(
    (reason: PhoneCallState["interruptionReason"]) => {
      if (!enabled) return;

      log(`Interruption detected: ${reason}`);

      // Clear any existing timeout
      if (interruptionTimeoutRef.current) {
        clearTimeout(interruptionTimeoutRef.current);
        interruptionTimeoutRef.current = null;
      }

      updateCallState({
        isCallActive: true,
        isCallInterrupted: true,
        lastInterruption: new Date(),
        interruptionReason: reason,
      });
    },
    [enabled, log, updateCallState]
  );

  const handleInterruptionEnd = useCallback(
    (reason: string) => {
      if (!enabled) return;

      log(`Interruption ended: ${reason}`);

      // Add a small delay to prevent rapid on/off cycling
      interruptionTimeoutRef.current = window.setTimeout(() => {
        updateCallState({
          isCallActive: false,
          isCallInterrupted: false,
          interruptionReason: null,
        });
      }, 200);
    },
    [enabled, log, updateCallState]
  );

  // Visibility change detection - triggers interruption when app goes to background
  // On mobile, phone calls cause the app to lose visibility
  const handleVisibilityChange = useCallback(() => {
    if (!enabled) return;

    const now = Date.now();
    const isHidden = document.hidden || document.visibilityState === "hidden";

    log(`Visibility change: ${isHidden ? "hidden" : "visible"}`);

    if (isHidden) {
      visibilityTimeRef.current = now;
      // Trigger interruption after short threshold - likely a phone call or notification
      // The short delay prevents false positives from quick app switches
      interruptionTimeoutRef.current = window.setTimeout(() => {
        if (
          document.hidden &&
          Date.now() - visibilityTimeRef.current >= interruptionThreshold
        ) {
          log(
            `Interruption detected after ${Math.round(
              (Date.now() - visibilityTimeRef.current) / 1000
            )}s`
          );
          handleInterruption("phone-call");
        }
      }, interruptionThreshold);
    } else {
      const hiddenDuration = now - visibilityTimeRef.current;
      log(`App became visible after ${Math.round(hiddenDuration / 1000)}s`);

      // Clear any pending interruption timeout
      if (interruptionTimeoutRef.current) {
        clearTimeout(interruptionTimeoutRef.current);
        interruptionTimeoutRef.current = null;
      }

      // If we were interrupted, signal that the call ended (user returned)
      if (callStateRef.current.isCallInterrupted) {
        handleInterruptionEnd("call-ended");
      }
    }
  }, [
    enabled,
    interruptionThreshold,
    log,
    handleInterruption,
    handleInterruptionEnd,
  ]);

  // Window focus/blur detection (disabled to prevent false positives)
  const handleFocusChange = useCallback((event: FocusEvent) => {
    // Completely disabled - focus/blur events are too aggressive for normal app usage
    // Users commonly switch between apps, tabs, and windows during workouts
    return;
  }, []);

  // Audio context state change detection (disabled to prevent false positives)
  const handleAudioContextStateChange = useCallback(() => {
    // Disabled - AudioContext state changes can be triggered by other apps, browser behavior,
    // or user interactions that aren't phone calls
    return;
  }, []);

  // Initialize audio context for monitoring (disabled)
  const setupAudioContextMonitoring = useCallback(() => {
    // Disabled to prevent false positives from normal browser/app behavior
    log("AudioContext monitoring disabled (too aggressive for normal usage)");
    return;
  }, [log]);

  // Native app interruption handling
  const setupNativeInterruptions = useCallback(async () => {
    if (!isNativeAppRef.current) return;

    try {
      // Use Capacitor App plugin for basic app state changes
      const { App } = await import("@capacitor/app");

      App.addListener("appStateChange", ({ isActive }) => {
        log(`App state change: ${isActive ? "active" : "inactive"}`);

        if (!isActive) {
          // Clear any existing timeout
          if (interruptionTimeoutRef.current) {
            clearTimeout(interruptionTimeoutRef.current);
          }
          // Trigger interruption after short threshold
          interruptionTimeoutRef.current = window.setTimeout(() => {
            if (!document.hasFocus()) {
              log(
                `App inactivity detected after ${interruptionThreshold / 1000}s`
              );
              handleInterruption("phone-call");
            }
          }, interruptionThreshold);
        } else {
          // Clear pending timeout
          if (interruptionTimeoutRef.current) {
            clearTimeout(interruptionTimeoutRef.current);
            interruptionTimeoutRef.current = null;
          }
          // If we were interrupted, signal call ended
          if (callStateRef.current.isCallInterrupted) {
            handleInterruptionEnd("call-ended");
          }
        }
      });

      log("Native app interruption listeners initialized");
    } catch (error) {
      log("Failed to initialize native interruption handling:", error);
    }
  }, [log, handleInterruption, handleInterruptionEnd, interruptionThreshold]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (interruptionTimeoutRef.current) {
      clearTimeout(interruptionTimeoutRef.current);
      interruptionTimeoutRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.removeEventListener(
        "statechange",
        handleAudioContextStateChange
      );
      try {
        audioContextRef.current.close();
      } catch (error) {
        // Audio context cleanup failed
      }
      audioContextRef.current = null;
    }
  }, [handleAudioContextStateChange]);

  // Setup effect
  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    // Detect environment
    isNativeAppRef.current = Capacitor.isNativePlatform();
    log(`Environment: ${isNativeAppRef.current ? "native" : "web"}`);

    // Setup event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleFocusChange);
    window.addEventListener("focus", handleFocusChange);

    // Skip audio context monitoring - too aggressive for web usage
    // if (!isNativeAppRef.current) {
    //   setupAudioContextMonitoring();
    // }

    // Setup native interruption handling
    setupNativeInterruptions();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleFocusChange);
      window.removeEventListener("focus", handleFocusChange);
      cleanup();
    };
  }, [
    enabled,
    handleVisibilityChange,
    handleFocusChange,
    setupAudioContextMonitoring,
    setupNativeInterruptions,
    cleanup,
    log,
  ]);

  const forceInterruption = useCallback(
    (reason: string = "manual") => {
      handleInterruption(reason as PhoneCallState["interruptionReason"]);
    },
    [handleInterruption]
  );

  const forceResume = useCallback(
    (reason: string = "manual") => {
      handleInterruptionEnd(reason);
    },
    [handleInterruptionEnd]
  );

  return useMemo(
    () => ({
      callState,
      forceInterruption,
      forceResume,
      isInterrupted: callState.isCallInterrupted,
      timeSinceInterruption: callState.lastInterruption
        ? Date.now() - callState.lastInterruption.getTime()
        : null,
    }),
    [callState, forceInterruption, forceResume]
  );
};

export default usePhoneCallDetection;
