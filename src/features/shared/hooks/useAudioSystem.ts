import { useMemo } from 'react';
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

  // Memoize platform object
  const platform = useMemo(() => ({ android, ios }), [android, ios]);

  // Memoize return object to prevent unnecessary re-renders downstream
  return useMemo(() => ({ tts, sfx, platform }), [tts, sfx, platform]);
};