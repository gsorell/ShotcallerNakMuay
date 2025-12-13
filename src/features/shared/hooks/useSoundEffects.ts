import { useCallback, useEffect, useMemo, useRef } from "react";

// You will pass the iosAudioSession object from your existing hook into this one
export function useSoundEffects(iosAudioSession: any) {
  const bellSoundRef = useRef<HTMLAudioElement | null>(null);
  const warningSoundRef = useRef<HTMLAudioElement | null>(null);

  // Simple Web Audio fallback chime
  const webAudioChime = useCallback(() => {
    try {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;

      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      /* noop */
    }
  }, []);

  // Initialize audio instances ONCE on component mount
  useEffect(() => {
    try {
      // Create bell audio instance once
      if (!bellSoundRef.current) {
        bellSoundRef.current = new Audio("/big-bell-330719.mp3");
        bellSoundRef.current.preload = "auto";
        bellSoundRef.current.volume = 0.5;
        // Configure for iOS compatibility
        if (iosAudioSession && iosAudioSession.configureAudioElement) {
          iosAudioSession.configureAudioElement(bellSoundRef.current);
        }
      }

      // Create warning audio instance once
      if (!warningSoundRef.current) {
        warningSoundRef.current = new Audio("/interval.mp3");
        warningSoundRef.current.preload = "auto";
        warningSoundRef.current.volume = 0.4;
        // Configure for iOS compatibility
        if (iosAudioSession && iosAudioSession.configureAudioElement) {
          iosAudioSession.configureAudioElement(warningSoundRef.current);
        }
      }
    } catch (error) {
      console.warn("[AudioInit] Failed to initialize audio elements:", error);
    }

    // Cleanup on unmount
    return () => {
      try {
        if (bellSoundRef.current) {
          bellSoundRef.current.pause();
          bellSoundRef.current.src = "";
          bellSoundRef.current.load();
          bellSoundRef.current = null;
        }
        if (warningSoundRef.current) {
          warningSoundRef.current.pause();
          warningSoundRef.current.src = "";
          warningSoundRef.current.load();
          warningSoundRef.current = null;
        }
      } catch (error) {
        console.warn("[AudioCleanup] Error during cleanup:", error);
      }
    };
  }, [iosAudioSession]);

  // Update volume based on iOS session
  useEffect(() => {
    if (bellSoundRef.current && iosAudioSession.shouldMixWithOthers()) {
      bellSoundRef.current.volume = 0.3;
      iosAudioSession.configureAudioElement(bellSoundRef.current);
    }

    if (warningSoundRef.current && iosAudioSession.shouldMixWithOthers()) {
      warningSoundRef.current.volume = 0.2;
      iosAudioSession.configureAudioElement(warningSoundRef.current);
    }
  }, [iosAudioSession]);

  // Bell - reuse existing instance
  const playBell = useCallback(() => {
    try {
      const bell = bellSoundRef.current;
      if (bell) {
        bell.currentTime = 0;
        const p = bell.play();
        if (p && typeof p.then === "function") {
          p.catch(() => {
            webAudioChime();
          });
        }
      } else {
        webAudioChime();
      }
    } catch {
      webAudioChime();
    }
  }, [webAudioChime]);

  // 10-second warning sound
  const playWarningSound = useCallback(() => {
    try {
      const warn = warningSoundRef.current;
      if (warn) {
        warn.currentTime = 0;
        const p = warn.play();
        if (p && typeof p.then === "function") {
          p.catch(() => {
            /* no critical fallback for warning */
          });
        }
      }
    } catch {
      /* noop */
    }
  }, []);

  // Proactively unlock audio on user gesture
  const ensureMediaUnlocked = useCallback(async () => {
    try {
      const bell = bellSoundRef.current;
      if (bell) {
        const bellPrevVol = bell.volume;
        bell.volume = 0;
        bell.muted = true;
        try {
          await bell.play();
          bell.pause();
        } catch {
          // Play failed (autoplay policy, etc.) - don't call pause
        }
        bell.currentTime = 0;
        bell.muted = false;
        bell.volume = bellPrevVol;
      }

      const warn = warningSoundRef.current;
      if (warn) {
        const warnPrevVol = warn.volume;
        warn.volume = 0;
        warn.muted = true;
        try {
          await warn.play();
          warn.pause();
        } catch {
          // Play failed - don't call pause
        }
        warn.currentTime = 0;
        warn.muted = false;
        warn.volume = warnPrevVol;
      }
    } catch {
      /* noop */
    }
  }, []);

  return useMemo(
    () => ({ playBell, playWarningSound, ensureMediaUnlocked }),
    [playBell, playWarningSound, ensureMediaUnlocked]
  );
}
