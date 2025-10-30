import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shotcallernakmuay.app',
  appName: 'Shotcaller Nak Muay',
  webDir: 'dist',
  plugins: {
    TextToSpeech: {
      // Configure audio session for true background mixing (iOS)
      audioSessionCategory: 'playback', // Full playback capability
      audioSessionOptions: ['mixWithOthers'], // Mix without ducking background music
    },
    PhoneCallDetection: {
      // Enable background monitoring for phone calls
      enableBackgroundMonitoring: true,
      // iOS: Monitor audio session interruptions
      monitorAudioSession: true,
      // Android: Monitor phone state changes
      monitorPhoneState: true
    }
  }
};

export default config;
