import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shotcallernakmuay.app',
  appName: 'Shotcaller Nak Muay',
  webDir: 'dist',
  plugins: {
    TextToSpeech: {
      // iOS-only configuration to prevent music interruption
      // This allows background music (Spotify, Apple Music) to continue during TTS
      iosAudioSessionCategory: 'ambient',
      iosAudioSessionOptions: ['mixWithOthers'],
      // Note: These settings only affect iOS native apps, not Chrome/web
    }
  }
};

export default config;
