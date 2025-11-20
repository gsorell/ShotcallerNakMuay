import { useEffect, useRef } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';

/**
 * TypeScript definitions for the AudioSession plugin
 */
interface AudioSessionPlugin {
  /**
   * Start an audio session - requests audio focus with ducking.
   * This will lower background music (Spotify, etc.) to ~60-70% volume.
   */
  startSession(): Promise<{ success: boolean; message: string }>;
  
  /**
   * End an audio session - releases audio focus.
   * This will restore background music to full volume.
   */
  endSession(): Promise<{ success: boolean; message: string }>;
  
  /**
   * Check if currently holding audio focus
   */
  hasAudioFocus(): Promise<{ hasAudioFocus: boolean }>;
}

// Register the native plugin once (outside the hook to prevent re-registration)
const AudioSession = registerPlugin<AudioSessionPlugin>('AudioSession');

/**
 * Hook to manage audio session for workout timer
 * Automatically handles audio ducking on Android for background music apps
 */
export const useAudioSession = () => {
  const sessionActiveRef = useRef(false);

  useEffect(() => {
    // Cleanup on unmount - ensure audio focus is released
    return () => {
      if (sessionActiveRef.current) {
        // Check platform at runtime for cleanup
        if (Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform()) {
          AudioSession.endSession().catch(err => {
            console.warn('Failed to end audio session on unmount:', err);
          });
        }
      }
    };
  }, []);

  /**
   * Start an audio session - ducks background music
   */
  const startSession = async (): Promise<boolean> => {
    // Check platform at runtime, not at module load time
    if (Capacitor.getPlatform() !== 'android' || !Capacitor.isNativePlatform()) {
      return false;
    }
    
    try {
      const result = await AudioSession.startSession();
      sessionActiveRef.current = result.success;
      console.log('Audio session started:', result.message);
      return result.success;
    } catch (error) {
      console.warn('Failed to start audio session:', error);
      // Non-critical failure - app can continue without audio ducking
      return false;
    }
  };

  /**
   * End an audio session - restores background music volume
   */
  const endSession = async (): Promise<boolean> => {
    // Check platform at runtime, not at module load time
    if (Capacitor.getPlatform() !== 'android' || !Capacitor.isNativePlatform()) {
      return false;
    }
    
    try {
      const result = await AudioSession.endSession();
      sessionActiveRef.current = false;
      console.log('Audio session ended:', result.message);
      return result.success;
    } catch (error) {
      console.warn('Failed to end audio session:', error);
      return false;
    }
  };

  /**
   * Check if audio session is currently active
   */
  const isSessionActive = async (): Promise<boolean> => {
    // Check platform at runtime, not at module load time
    if (Capacitor.getPlatform() !== 'android' || !Capacitor.isNativePlatform()) {
      return false;
    }
    
    try {
      const result = await AudioSession.hasAudioFocus();
      return result.hasAudioFocus;
    } catch (error) {
      console.warn('Failed to check audio focus:', error);
      return false;
    }
  };

  return {
    startSession,
    endSession,
    isSessionActive
  };
};
