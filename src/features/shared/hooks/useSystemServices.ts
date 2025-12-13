import { useMemo } from 'react';
import { usePWA } from './usePWA';
import { useWakeLock } from './useWakeLock';

export const useSystemServices = () => {
  const pwa = usePWA();
  // WakeLock is managed conditionally in WorkoutProvider, so disable globally
  useWakeLock({ enabled: false });
  // useVisibilityManager might need to remain separate if it depends on specific UI state

  return useMemo(() => ({ pwa }), [pwa]);
};