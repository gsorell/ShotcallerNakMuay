import { useAndroidAudioDucking } from './useAndroidAudioDucking';
import { useIOSAudioSession } from './useIOSAudioSession';
import { useTTS } from './useTTS';
import { useSoundEffects } from './useSoundEffects';

export const useAudioSystem = () => {
  // 1. Initialize Platform Audio
  const android = useAndroidAudioDucking();
  const ios = useIOSAudioSession();

  // 2. Initialize TTS
  const tts = useTTS();

  // 3. Initialize Sound Effects (pass ios session if required by hook)
  const sfx = useSoundEffects(ios);

  return {
    tts,
    sfx,
    platform: {
      android,
      ios
    }
  };
};