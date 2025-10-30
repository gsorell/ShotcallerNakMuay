import { useEffect, useCallback, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export interface PhoneCallState {
  isCallActive: boolean;
  isCallInterrupted: boolean;
  lastInterruption: Date | null;
  interruptionReason: 'phone-call' | 'audio-interruption' | 'visibility-change' | 'focus-loss' | null;
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
   * Minimum duration in ms before considering a visibility change as an interruption (default: 5000)
   * This prevents false positives from quick tab switches
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
export const usePhoneCallDetection = (options: UsePhoneCallDetectionOptions = {}) => {
  const {
    onCallStart,
    onCallEnd,
    onInterruptionChange,
    enabled = true,
    interruptionThreshold = 5000,
    debug = false
  } = options;

  const [callState, setCallState] = useState<PhoneCallState>({
    isCallActive: false,
    isCallInterrupted: false,
    lastInterruption: null,
    interruptionReason: null
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

  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[PhoneCallDetection] ${message}`, ...args);
    }
  }, [debug]);

  const updateCallState = useCallback((updates: Partial<PhoneCallState>) => {
    setCallState(prev => {
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
            onInterruptionChange(isNowInterrupted, updates.interruptionReason || 'unknown');
          }
        }
      }
      
      return newState;
    });
  }, [onCallStart, onCallEnd, onInterruptionChange]);

  const handleInterruption = useCallback((reason: PhoneCallState['interruptionReason']) => {
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
      interruptionReason: reason
    });
  }, [enabled, log, updateCallState]);

  const handleInterruptionEnd = useCallback((reason: string) => {
    if (!enabled) return;
    
    log(`Interruption ended: ${reason}`);
    
    // Add a small delay to prevent rapid on/off cycling
    interruptionTimeoutRef.current = window.setTimeout(() => {
      updateCallState({
        isCallActive: false,
        isCallInterrupted: false,
        interruptionReason: null
      });
    }, 200);
  }, [enabled, log, updateCallState]);

  // Visibility change detection (conservative - only for very long interruptions)
  const handleVisibilityChange = useCallback(() => {
    if (!enabled || isNativeAppRef.current) return; // Skip on native apps - use app state instead
    
    const now = Date.now();
    const isHidden = document.hidden || document.visibilityState === 'hidden';
    
    log(`Visibility change: ${isHidden ? 'hidden' : 'visible'}`);
    
    if (isHidden) {
      visibilityTimeRef.current = now;
      // Only trigger for very long periods (likely phone calls, not tab switches)
      setTimeout(() => {
        if (document.hidden && (Date.now() - visibilityTimeRef.current) >= interruptionThreshold) {
          // Additional check: only if page has been hidden for the full duration
          handleInterruption('visibility-change');
        }
      }, interruptionThreshold);
    } else {
      const hiddenDuration = now - visibilityTimeRef.current;
      if (hiddenDuration >= interruptionThreshold && callStateRef.current.isCallInterrupted) {
        handleInterruptionEnd('visibility-restored');
      }
    }
  }, [enabled, interruptionThreshold, log, handleInterruption, handleInterruptionEnd]);

  // Window focus/blur detection (disabled for web to prevent false positives)
  const handleFocusChange = useCallback((event: FocusEvent) => {
    // Disable focus/blur detection as it's too aggressive for normal usage
    // Only use this on native apps where it's more reliable
    if (!enabled || !isNativeAppRef.current) return;
    
    const now = Date.now();
    const isFocused = event.type === 'focus';
    
    log(`Focus change: ${isFocused ? 'focused' : 'blurred'}`);
    
    if (!isFocused) {
      lastFocusTimeRef.current = now;
      setTimeout(() => {
        const blurDuration = Date.now() - lastFocusTimeRef.current;
        if (blurDuration >= interruptionThreshold) {
          handleInterruption('focus-loss');
        }
      }, interruptionThreshold);
    } else {
      const blurDuration = now - lastFocusTimeRef.current;
      if (blurDuration >= interruptionThreshold && callStateRef.current.isCallInterrupted) {
        handleInterruptionEnd('focus-restored');
      }
    }
  }, [enabled, interruptionThreshold, log, handleInterruption, handleInterruptionEnd]);

  // Audio context state change detection
  const handleAudioContextStateChange = useCallback(() => {
    if (!audioContextRef.current) return;
    
    const audioContext = audioContextRef.current;
    const state = audioContext.state;
    
    log(`AudioContext state change: ${state}`);
    
    if (state === 'interrupted' || state === 'suspended') {
      handleInterruption('audio-interruption');
    } else if (state === 'running' && callStateRef.current.isCallInterrupted) {
      handleInterruptionEnd('audio-restored');
    }
  }, [log, handleInterruption, handleInterruptionEnd]);

  // Initialize audio context for monitoring
  const setupAudioContextMonitoring = useCallback(() => {
    if (typeof window === 'undefined' || !window.AudioContext) {
      return;
    }

    try {
      // Create a minimal audio context just for monitoring
      audioContextRef.current = new AudioContext();
      audioContextRef.current.addEventListener('statechange', handleAudioContextStateChange);
      
      log('AudioContext monitoring initialized');
    } catch (error) {
      log('Failed to initialize AudioContext monitoring:', error);
    }
  }, [handleAudioContextStateChange, log]);

  // Native app interruption handling
  const setupNativeInterruptions = useCallback(async () => {
    if (!isNativeAppRef.current) return;

    try {
      // Try to use our custom phone call detection plugin first
      try {
        const { PhoneCallDetection } = await import('../plugins/PhoneCallDetection');
        
        await PhoneCallDetection.startMonitoring();
        
        PhoneCallDetection.addListener('callStateChanged', (event) => {
          log(`Native phone call state: ${event.isActive ? 'active' : 'inactive'} (${event.reason})`);
          
          if (event.isActive) {
            handleInterruption('phone-call');
          } else if (callStateRef.current.isCallInterrupted) {
            handleInterruptionEnd(`call-ended-${event.reason}`);
          }
        });

        log('Native phone call detection plugin initialized');
        return; // Successfully set up native plugin, no need for fallback
      } catch (pluginError) {
        log('Phone call detection plugin not available, using fallback:', pluginError);
      }
      
      // Fallback: Use Capacitor App plugin for basic app state changes
      const { App } = await import('@capacitor/app');
      
      App.addListener('appStateChange', ({ isActive }) => {
        log(`App state change: ${isActive ? 'active' : 'inactive'}`);
        
        // Only trigger interruption if app goes inactive for a reasonable duration
        if (!isActive) {
          setTimeout(() => {
            // Check if app is still inactive after delay - this filters out brief switches
            if (!document.hasFocus()) {
              handleInterruption('phone-call');
            }
          }, 2000); // 2 second delay to avoid false positives
        } else if (callStateRef.current.isCallInterrupted) {
          handleInterruptionEnd('app-restored');
        }
      });

      log('Native app interruption listeners initialized (fallback mode)');
    } catch (error) {
      log('Failed to initialize native interruption handling:', error);
    }
  }, [log, handleInterruption, handleInterruptionEnd]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (interruptionTimeoutRef.current) {
      clearTimeout(interruptionTimeoutRef.current);
      interruptionTimeoutRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.removeEventListener('statechange', handleAudioContextStateChange);
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
    log(`Environment: ${isNativeAppRef.current ? 'native' : 'web'}`);

    // Setup event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleFocusChange);
    window.addEventListener('focus', handleFocusChange);

    // Skip audio context monitoring - too aggressive for web usage
    // if (!isNativeAppRef.current) {
    //   setupAudioContextMonitoring();
    // }

    // Setup native interruption handling
    setupNativeInterruptions();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleFocusChange);
      window.removeEventListener('focus', handleFocusChange);
      cleanup();
    };
  }, [
    enabled,
    handleVisibilityChange,
    handleFocusChange,
    setupAudioContextMonitoring,
    setupNativeInterruptions,
    cleanup,
    log
  ]);

  return {
    callState,
    
    // Utility methods
    forceInterruption: useCallback((reason: string = 'manual') => {
      handleInterruption(reason as PhoneCallState['interruptionReason']);
    }, [handleInterruption]),
    
    forceResume: useCallback((reason: string = 'manual') => {
      handleInterruptionEnd(reason);
    }, [handleInterruptionEnd]),
    
    // Check if currently interrupted
    isInterrupted: callState.isCallInterrupted,
    
    // Get time since last interruption
    timeSinceInterruption: callState.lastInterruption 
      ? Date.now() - callState.lastInterruption.getTime() 
      : null
  };
};

export default usePhoneCallDetection;