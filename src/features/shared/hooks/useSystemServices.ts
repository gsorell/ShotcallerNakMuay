import { usePWA } from './usePWA';
import { useWakeLock } from './useWakeLock';

export const useSystemServices = () => {
  const pwa = usePWA();
  useWakeLock({ enabled: true });
  // useVisibilityManager might need to remain separate if it depends on specific UI state

  return {
    pwa,
    // ...
  };
};