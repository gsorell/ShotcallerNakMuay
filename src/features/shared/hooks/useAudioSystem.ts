import { usePlatformAudio } from './usePlatformAudio';
import { useTTS } from './useTTS';

export const useAudioSystem = () => {
  // 1. Initialize Platform Audio (Android Ducking / iOS Session)
  usePlatformAudio();

  // 2. Initialize TTS
  const tts = useTTS();

  return {
    speak: tts.speak,
    stop: tts.stop,
    // Sound effects can be accessed separately if needed
  };
};