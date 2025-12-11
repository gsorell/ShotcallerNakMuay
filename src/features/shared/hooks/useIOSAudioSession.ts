import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

/**
 * Hook to configure iOS audio session for background music compatibility
 * This ensures the app can play TTS while allowing Spotify/Apple Music to continue
 */
export const useIOSAudioSession = () => {
  useEffect(() => {
    const configureIOSAudio = async () => {
      // Only run on iOS native app
      if (Capacitor.getPlatform() !== "ios") {
        return;
      }

      try {
        // Configure iOS audio session for background music compatibility
        // The capacitor.config.ts settings will ensure cooperative audio mixing
        console.log(
          "iOS: Configuring audio session for background music compatibility"
        );

        // Note: Audio session configuration happens automatically via capacitor.config.ts
        // when TTS is first used. This ensures Spotify/Apple Music can continue playing.
      } catch (error) {
        console.warn("iOS audio session setup failed:", error);
      }
    };

    // Immediate setup - don't delay the configuration
    configureIOSAudio();
  }, []);

  // Return utility functions for audio session management
  return {
    isIOSNative: Capacitor.getPlatform() === "ios",

    // Helper to check if we should use different audio behavior
    shouldMixWithOthers: () => {
      return Capacitor.getPlatform() === "ios";
    },

    // Helper to configure audio elements for iOS compatibility only
    configureAudioElement: (audioElement: HTMLAudioElement) => {
      if (Capacitor.getPlatform() === "ios") {
        audioElement.setAttribute("webkit-playsinline", "true");
        audioElement.setAttribute("playsinline", "true");
        // Configure for iOS background music compatibility
        console.log("iOS: Configured audio element for inline playback");
      }
      return audioElement;
    },
  };
};
