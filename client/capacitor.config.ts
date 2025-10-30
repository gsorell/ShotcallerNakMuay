import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shotcallernakmuay.app',
  appName: 'Shotcaller Nak Muay',
  webDir: 'dist',
  plugins: {
    TextToSpeech: {
      // Configure audio session to allow mixing with other audio (iOS)
      audioSessionCategory: 'ambient', // Allows background music to continue
      audioSessionOptions: ['mixWithOthers'], // Mix with Spotify/Apple Music
    }
  }
};

export default config;
