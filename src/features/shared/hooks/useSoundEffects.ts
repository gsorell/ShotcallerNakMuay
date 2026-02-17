import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// All sounds use Web Audio API to avoid:
// 1. iOS Safari autoplay blocking in setTimeout/setInterval
// 2. iOS Now Playing widget appearing
// 3. Android muted-unlock hack causing audible sound bleed
export function useSoundEffects(_iosAudioSession: any) {
  const mediaUnlockedRef = useRef(false);

  // Debug: Track clack events
  const [clackDebugState, setClackDebugState] = useState({
    lastClackTime: 0,
    clackCount: 0,
  });

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const bellBufferRef = useRef<AudioBuffer | null>(null);
  const warningBufferRef = useRef<AudioBuffer | null>(null);
  const clackBufferRef = useRef<AudioBuffer | null>(null);

  // Simple Web Audio fallback chime (synthesized)
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

  // Load audio file into Web Audio API buffer from local bundle
  const loadAudioBuffer = useCallback(async (url: string, ctx: AudioContext): Promise<AudioBuffer | null> => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await ctx.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.warn(`[WebAudio] Failed to load ${url}:`, error);
      return null;
    }
  }, []);

  // Play audio using Web Audio API
  const playWebAudioBuffer = useCallback(async (buffer: AudioBuffer | null, volume: number = 0.5) => {
    if (!buffer || !audioContextRef.current) return;

    try {
      const ctx = audioContextRef.current;

      // Resume context if suspended (iOS requirement) - MUST await
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();

      source.buffer = buffer;
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
    } catch (error) {
      console.warn("[WebAudio] Playback failed:", error);
    }
  }, []);

  // Initialize Web Audio API and load all sound buffers
  useEffect(() => {
    const initAudio = async () => {
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx && !audioContextRef.current) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;

          bellBufferRef.current = await loadAudioBuffer("/big-bell-330719.mp3", ctx);
          warningBufferRef.current = await loadAudioBuffer("/interval.mp3", ctx);
          clackBufferRef.current = await loadAudioBuffer("/clapperboard.mp3", ctx);

          console.log("[WebAudio] All sounds initialized via Web Audio API", {
            bellLoaded: !!bellBufferRef.current,
            warningLoaded: !!warningBufferRef.current,
            clackLoaded: !!clackBufferRef.current,
          });
        }
      } catch (error) {
        console.warn("[WebAudio] Web Audio API init failed:", error);
      }
    };

    initAudio();

    return () => {
      try {
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      } catch (error) {
        console.warn("[AudioCleanup] Error during cleanup:", error);
      }
    };
  }, [loadAudioBuffer]);

  // Bell sound
  const playBell = useCallback(() => {
    if (bellBufferRef.current && audioContextRef.current) {
      playWebAudioBuffer(bellBufferRef.current, 0.3);
    } else {
      webAudioChime();
    }
  }, [playWebAudioBuffer, webAudioChime]);

  // 10-second warning sound
  const playWarningSound = useCallback(() => {
    if (warningBufferRef.current && audioContextRef.current) {
      playWebAudioBuffer(warningBufferRef.current, 0.2);
    }
  }, [playWebAudioBuffer]);

  // Clapperboard clack for freestyle mode
  const playClack = useCallback(() => {
    setClackDebugState(prev => ({
      lastClackTime: Date.now(),
      clackCount: prev.clackCount + 1,
    }));

    if (clackBufferRef.current && audioContextRef.current) {
      playWebAudioBuffer(clackBufferRef.current, 0.3);
    } else {
      webAudioChime();
    }
  }, [playWebAudioBuffer, webAudioChime]);

  // Unlock audio context on user gesture
  const ensureMediaUnlocked = useCallback(async () => {
    if (mediaUnlockedRef.current) return;
    mediaUnlockedRef.current = true;

    try {
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
        console.log("[WebAudio] Audio context resumed");
      }
    } catch {
      // Context resume failed
    }
  }, []);

  return useMemo(
    () => ({ playBell, playWarningSound, playClack, ensureMediaUnlocked, clackDebugState }),
    [playBell, playWarningSound, playClack, ensureMediaUnlocked, clackDebugState]
  );
}
