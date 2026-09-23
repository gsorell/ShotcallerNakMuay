import { Capacitor } from "@capacitor/core";
import { useCallback, useMemo } from "react";

/**
 * iOS platform helpers. Despite the name this configures nothing - the audio
 * session belongs to AppDelegate.swift - it just reports whether we are on iOS
 * and tags audio elements for inline playback.
 */
export const useIOSAudioSession = () => {
  // There is deliberately no session setup here. The audio session is
  // configured natively, once, in AppDelegate.swift.
  //
  // This hook used to claim the configuration "happens automatically via
  // capacitor.config.ts when TTS is first used". That was never true -
  // capacitor.config.ts carries no audio settings of any kind - and the claim
  // cost real time: when the app turned out to be muted by the Ring/Silent
  // switch, this file is where the hunt for the session's owner started, and
  // very nearly where it stopped. The category lives in AppDelegate, and the
  // comment there explains why it is what it is.

  const isIOSNative = useMemo(() => Capacitor.getPlatform() === "ios", []);

  // Helper to check if we should use different audio behavior
  const shouldMixWithOthers = useCallback(() => {
    return Capacitor.getPlatform() === "ios";
  }, []);

  // Helper to configure audio elements for iOS compatibility only
  const configureAudioElement = useCallback((audioElement: HTMLAudioElement) => {
    if (Capacitor.getPlatform() === "ios") {
      audioElement.setAttribute("webkit-playsinline", "true");
      audioElement.setAttribute("playsinline", "true");
      // Configure for iOS background music compatibility
      console.log("iOS: Configured audio element for inline playback");
    }
    return audioElement;
  }, []);

  // Return memoized object to prevent unnecessary re-renders
  return useMemo(() => ({
    isIOSNative,
    shouldMixWithOthers,
    configureAudioElement,
  }), [isIOSNative, shouldMixWithOthers, configureAudioElement]);
};
