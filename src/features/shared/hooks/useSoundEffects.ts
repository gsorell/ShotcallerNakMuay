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

// The session keepalive runs a tone the speaker cannot reproduce audibly, at a
// gain far below anything a listener resolves. Its only job is to keep frames
// flowing so the output path never reaches standby.
const KEEPALIVE_FREQUENCY = 20000; // 20kHz — at/above the limit of human hearing
const KEEPALIVE_GAIN = 0.0005; // ~ -66 dBFS
const KEEPALIVE_FADE = 0.15; // ramp in/out, so the keepalive cannot itself pop

export function useSoundEffects(_iosAudioSession: any) {
  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const bellBufferRef = useRef<AudioBuffer | null>(null);
  const warningBufferRef = useRef<AudioBuffer | null>(null);
  const clackBufferRef = useRef<AudioBuffer | null>(null);

  // Keepalive nodes. Created on the first workout start and left running for
  // the life of the hook — the context close on unmount is what tears them down.
  const keepAliveRef = useRef<{
    osc: OscillatorNode;
    gain: GainNode;
  } | null>(null);

  // Encoded bytes, prefetched at mount.
  const encodedRef = useRef<Promise<(ArrayBuffer | null)[]> | null>(null);
  // Resolves once the context exists and every buffer is decoded into it.
  const readyRef = useRef<Promise<void> | null>(null);

  // Prefetch only. Deliberately does NOT construct an AudioContext.
  //
  // Capacitor's WebView sets mediaPlaybackRequiresUserGesture(false), so unlike
  // a normal browser an AudioContext constructed here starts *running* instead
  // of *suspended*, opening the output path during launch. That is audible over
  // other apps' audio, and the owner compared it directly against opening at
  // workout start and preferred the latter. Creation is therefore deferred to
  // ensureMediaUnlocked, which runs inside the workout-start gesture.
  //
  // decodeAudioData detaches the ArrayBuffers, so these can only be decoded
  // once. That is fine while one context lives for the whole app run; if the
  // context is ever torn down and rebuilt mid-life, this has to run again.
  const prefetch = useCallback(() => {
    encodedRef.current = Promise.all([
      fetchEncoded(SOUND_URLS.bell),
      fetchEncoded(SOUND_URLS.warning),
      fetchEncoded(SOUND_URLS.clack),
    ]);
  }, []);

  useEffect(() => {
    if (!encodedRef.current) {
      prefetch();
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
  }, [prefetch]);

  // Create the context and decode into it, once. Must be called from the
  // workout-start gesture — see the note on prefetch for why this cannot happen
  // at mount.
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

  // Hold the output path open from the first workout until the app goes away.
  //
  // The bell is the only thing this app renders through Web Audio, so between
  // one bell and the next the graph goes silent for a whole round. The HAL puts
  // the mmap output into standby a few seconds after frames stop arriving, and
  // the next bell has to power that path back up — which is audible as a pop,
  // and is audible *through* whatever the user has playing from another app.
  // Measured on a Pixel 9 Pro XL: one standby/start pair per round boundary.
  //
  // Keeping an inaudible source connected means frames never stop, so the path
  // never reaches standby and never has to be reopened.
  //
  // Started on the first workout start and deliberately NEVER stopped. Every
  // open and close of this path is audible over other apps' audio, so the goal
  // is the fewest possible transitions, not the shortest possible residency:
  // exactly one open, when the user first presses go, and one close when the app
  // is destroyed.
  //
  // Two other shapes were tried on device and rejected. Stopping it at the end
  // of a session bought a pop at every session end, plus another ~30s later when
  // Chromium released the idle stream into the silence afterwards. Opening it at
  // mount instead moved the single remaining pop to app launch, which the owner
  // compared directly against this and liked less.
  //
  // The cost of holding it is battery — the audio path stays powered from the
  // first workout until the app is destroyed — and that was an accepted trade.
  const startKeepAlive = useCallback(async () => {
    await ensureMediaUnlocked();
    const ctx = audioContextRef.current;
    if (!ctx || keepAliveRef.current) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(KEEPALIVE_FREQUENCY, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(
        KEEPALIVE_GAIN,
        ctx.currentTime + KEEPALIVE_FADE
      );

      osc.connect(gain).connect(ctx.destination);
      osc.start();

      keepAliveRef.current = { osc, gain };
    } catch (error) {
      console.warn("[WebAudio] Keepalive failed to start:", error);
    }
  }, [ensureMediaUnlocked]);

  return useMemo(
    () => ({ playBell, playWarningSound, playClack, ensureMediaUnlocked, startKeepAlive }),
    [playBell, playWarningSound, playClack, ensureMediaUnlocked, startKeepAlive]
  );
}
