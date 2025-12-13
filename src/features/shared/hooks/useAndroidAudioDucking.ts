import { Capacitor } from "@capacitor/core";
import { useCallback, useMemo } from "react";

/**
 * Hook to manage Android audio ducking via native plugin
 * On Android, this requests audio focus with AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
 * to make background music (Spotify, YouTube Music, etc.) automatically lower during workouts
 *
 * iOS doesn't support ducking this way - uses cooperative mixing instead (handled in useIOSAudioSession)
 * Web/PWA can't access OS-level audio controls, so ducking only works on native Android
 */

// Access the AudioSession plugin via Capacitor's plugin registry
const getAudioSessionPlugin = () => {
  try {
    return (Capacitor as any).Plugins.AudioSession;
  } catch (error) {
    console.warn("AudioSession plugin not accessible:", error);
    return null;
  }
};

export const useAndroidAudioDucking = () => {
  const isAndroidNative = Capacitor.getPlatform() === "android";

  /**
   * Request audio focus with ducking enabled
   * Call this when a workout session starts
   */
  const requestAudioFocus = useCallback(async () => {
    if (!isAndroidNative) {
      return { success: false, message: "Not on Android native app" };
    }

    try {
      const AudioSession = getAudioSessionPlugin();

      if (!AudioSession) {
        console.warn("AudioSession plugin not available");
        return { success: false, message: "AudioSession plugin not available" };
      }

      const result = await AudioSession.requestAudioFocus();
      if (result?.success) {
        console.log("Android: Audio focus requested with ducking enabled");
      }
      return result || { success: false, message: "Unknown error" };
    } catch (error) {
      console.warn("Failed to request audio focus:", error);
      return { success: false, message: String(error) };
    }
  }, [isAndroidNative]);

  /**
   * Release audio focus
   * Call this when a workout session ends
   */
  const releaseAudioFocus = useCallback(async () => {
    if (!isAndroidNative) {
      return { success: false, message: "Not on Android native app" };
    }

    try {
      const AudioSession = getAudioSessionPlugin();

      if (!AudioSession) {
        console.warn("AudioSession plugin not available");
        return { success: false, message: "AudioSession plugin not available" };
      }

      const result = await AudioSession.releaseAudioFocus();
      if (result?.success) {
        console.log("Android: Audio focus released");
      }
      return result || { success: false, message: "Unknown error" };
    } catch (error) {
      console.warn("Failed to release audio focus:", error);
      return { success: false, message: String(error) };
    }
  }, [isAndroidNative]);

  return useMemo(
    () => ({ isAndroidNative, requestAudioFocus, releaseAudioFocus }),
    [isAndroidNative, requestAudioFocus, releaseAudioFocus]
  );
};
