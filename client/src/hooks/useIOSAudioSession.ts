import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to configure iOS audio session for background music compatibility
 * This ensures the app can play TTS while allowing Spotify/Apple Music to continue
 */
export const useIOSAudioSession = () => {
  useEffect(() => {
    const configureIOSAudio = async () => {
      // Only run on iOS native app
      if (Capacitor.getPlatform() !== 'ios') {
        return;
      }

      try {
        // Use our custom AudioSessionManager plugin
        const { Capacitor: CapacitorCore } = await import('@capacitor/core');
        
        // Register our custom AudioSessionManager plugin
        const AudioSessionManager = CapacitorCore.registerPlugin('AudioSessionManager') as any;
        
        // Configure iOS audio session for background music compatibility
        await AudioSessionManager.configureMixingMode();
        
        console.log('iOS audio session configured for background compatibility');
      } catch (error) {
        // Fallback: audio session configuration not available
        // The app will still work, but might interrupt background music
        console.warn('Could not configure iOS audio session:', error);
      }
    };

    configureIOSAudio();
  }, []);

  // Return utility functions for audio session management
  return {
    isIOSNative: Capacitor.getPlatform() === 'ios',
    
    // Helper to check if we should use different audio behavior
    shouldMixWithOthers: () => {
      return Capacitor.getPlatform() === 'ios';
    },
    
    // Helper to configure audio elements for iOS compatibility
    configureAudioElement: (audioElement: HTMLAudioElement) => {
      if (Capacitor.getPlatform() === 'ios') {
        audioElement.setAttribute('webkit-playsinline', 'true');
        audioElement.setAttribute('playsinline', 'true');
        // Don't modify volume - let the caller control it
        // audioElement.volume = Math.min(0.7, audioElement.volume);
      }
      return audioElement;
    }
  };
};