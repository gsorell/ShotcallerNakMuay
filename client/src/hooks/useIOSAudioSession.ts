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
        // Don't initialize TTS immediately - this was causing the audio session
        // to be claimed exclusively before our cooperative settings could take effect
        // Instead, rely on capacitor.config.ts settings to configure the session
        // when TTS is first used naturally in the app
        
        console.log('iOS audio session will use cooperative settings from capacitor.config.ts');
      } catch (error) {
        console.warn('iOS audio session setup failed:', error);
      }
    };

    // Immediate setup - don't delay the configuration
    configureIOSAudio();
  }, []);

  // Return utility functions for audio session management
  return {
    isIOSNative: Capacitor.getPlatform() === 'ios',
    
    // Helper to check if we should use different audio behavior
    shouldMixWithOthers: () => {
      return Capacitor.getPlatform() === 'ios';
    },
    
    // Helper to configure audio elements for cross-platform compatibility
    configureAudioElement: (audioElement: HTMLAudioElement) => {
      const platform = Capacitor.getPlatform();
      
      if (platform === 'ios') {
        audioElement.setAttribute('webkit-playsinline', 'true');
        audioElement.setAttribute('playsinline', 'true');
      }
      
      // For both iOS and Android, try to prevent audio ducking
      if (platform === 'ios' || platform === 'android') {
        // Set audio context to prevent interference with background music
        if ('mozAudioChannelType' in audioElement) {
          (audioElement as any).mozAudioChannelType = 'content';
        }
        // Ensure audio plays inline and doesn't take audio focus aggressively
        audioElement.setAttribute('playsinline', 'true');
      }
      
      return audioElement;
    }
  };
};