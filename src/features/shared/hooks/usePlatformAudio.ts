import { useAndroidAudioDucking } from './useAndroidAudioDucking';
import { useIOSAudioSession } from './useIOSAudioSession';

export const usePlatformAudio = () => {
  useAndroidAudioDucking();
  useIOSAudioSession();
};