import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shotcallernakmuay.app',
  appName: 'Shotcaller Nak Muay',
  webDir: 'dist',
  plugins: {
    TextToSpeech: {
      // Configure iOS to use ambient audio session category
      // This allows background music to continue playing
      iosAudioSessionCategory: 'ambient',
      iosAudioSessionOptions: ['mixWithOthers']
    }
  }
};

export default config;
