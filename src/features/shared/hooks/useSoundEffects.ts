import { useCallback, useEffect, useMemo, useRef } from "react";

// All sounds use Web Audio API to avoid:
// 1. iOS Safari autoplay blocking in setTimeout/setInterval
// 2. iOS Now Playing widget appearing
// 3. Android muted-unlock hack causing audible sound bleed

const SOUND_URLS = {
  bell: "/big-bell-330719.mp3",
  warning: "/interval.mp3",
  clack: "/clapperboard.mp3",
} as const;

// Fetch the encoded bytes. This is a plain asset read — it touches no audio
// hardware, so it is safe to run at mount, before any user gesture.
const fetchEncoded = async (url: string): Promise<ArrayBuffer | null> => {
  try {
    const response = await fetch(url);
    return await response.arrayBuffer();
  } catch (error) {
    console.warn(`[WebAudio] Failed to load ${url}:`, error);
    return null;
  }
};

// decodeAudioData detaches the ArrayBuffer, so each one may only be decoded
// once. The readyRef guard in ensureMediaUnlocked is what enforces that.
const decodeInto = async (
  bytes: ArrayBuffer | null,
  ctx: AudioContext
): Promise<AudioBuffer | null> => {
  if (!bytes) return null;
  try {
    return await ctx.decodeAudioData(bytes);
  } catch (error) {
    console.warn("[WebAudio] Failed to decode sound:", error);
    return null;
  }
};

export function useSoundEffects(_iosAudioSession: any) {
  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const bellBufferRef = useRef<AudioBuffer | null>(null);
  const warningBufferRef = useRef<AudioBuffer | null>(null);
  const clackBufferRef = useRef<AudioBuffer | null>(null);

  // Encoded bytes, prefetched at mount.
  const encodedRef = useRef<Promise<(ArrayBuffer | null)[]> | null>(null);
  // Resolves once the context exists and every buffer is decoded into it.
  const readyRef = useRef<Promise<void> | null>(null);

  // Prefetch only. Deliberately does NOT construct an AudioContext.
  //
  // Capacitor's WebView sets mediaPlaybackRequiresUserGesture(false), so unlike
  // a normal browser an AudioContext constructed here starts *running* instead
  // of *suspended*. That opens the output stream at launch — which powers up the
  // speaker path and produces an audible pop before the user has touched
  // anything, then holds the device open for ~30s. Creation is deferred to
  // ensureMediaUnlocked, which runs inside the workout-start gesture.
  useEffect(() => {
    if (!encodedRef.current) {
      encodedRef.current = Promise.all([
        fetchEncoded(SOUND_URLS.bell),
        fetchEncoded(SOUND_URLS.warning),
        fetchEncoded(SOUND_URLS.clack),
      ]);
    }

    return () => {
      try {
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        readyRef.current = null;
      } catch (error) {
        console.warn("[AudioCleanup] Error during cleanup:", error);
      }
    };
  }, []);

  // Create the context and decode into it, once. Must be called from a user
  // gesture — see the note above on why this cannot happen at mount.
  const ensureMediaUnlocked = useCallback(async () => {
    if (!readyRef.current) {
      readyRef.current = (async () => {
        const AudioCtx =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        const ctx: AudioContext = new AudioCtx();
        audioContextRef.current = ctx;

        const encoded = await (encodedRef.current ?? Promise.resolve([]));
        const [bell, warning, clack] = await Promise.all(
          encoded.map((bytes) => decodeInto(bytes, ctx))
        );

        bellBufferRef.current = bell ?? null;
        warningBufferRef.current = warning ?? null;
        clackBufferRef.current = clack ?? null;
      })().catch((error) => {
        console.warn("[WebAudio] Web Audio API init failed:", error);
      });
    }

    await readyRef.current;

    // iOS still parks a freshly created context until a gesture resumes it.
    try {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === "suspended") {
        await ctx.resume();
      }
    } catch {
      // Context resume failed
    }
  }, []);

  // Simple Web Audio fallback chime (synthesized), used when a sound file
  // failed to load. Reuses the shared context — constructing a throwaway one
  // per call would open (and leak) a fresh output stream every time.
  const webAudioChime = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    try {
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

  // Play audio using Web Audio API
  const playWebAudioBuffer = useCallback(
    async (buffer: AudioBuffer | null, volume: number = 0.5) => {
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
    },
    []
  );

  // Every sound routes through here so that a cue firing on a path that never
  // unlocked still works — it just creates the context at that point instead,
  // which is still long after launch.
  const playBuffered = useCallback(
    (
      bufferRef: React.RefObject<AudioBuffer | null>,
      volume: number,
      fallbackToChime: boolean
    ) => {
      void (async () => {
        await ensureMediaUnlocked();
        if (bufferRef.current) {
          await playWebAudioBuffer(bufferRef.current, volume);
        } else if (fallbackToChime) {
          webAudioChime();
        }
      })();
    },
    [ensureMediaUnlocked, playWebAudioBuffer, webAudioChime]
  );

  // Bell sound
  const playBell = useCallback(() => {
    playBuffered(bellBufferRef, 0.3, true);
  }, [playBuffered]);

  // 10-second warning sound (no chime fallback — a substitute tone here would
  // read as a different cue)
  const playWarningSound = useCallback(() => {
    playBuffered(warningBufferRef, 0.2, false);
  }, [playBuffered]);

  // Clapperboard clack for freestyle mode
  const playClack = useCallback(() => {
    playBuffered(clackBufferRef, 0.3, true);
  }, [playBuffered]);

  return useMemo(
    () => ({ playBell, playWarningSound, playClack, ensureMediaUnlocked }),
    [playBell, playWarningSound, playClack, ensureMediaUnlocked]
  );
}
