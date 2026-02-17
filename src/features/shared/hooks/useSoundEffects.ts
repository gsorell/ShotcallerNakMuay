import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// You will pass the iosAudioSession object from your existing hook into this one
export function useSoundEffects(iosAudioSession: any) {
  const bellSoundRef = useRef<HTMLAudioElement | null>(null);
  const warningSoundRef = useRef<HTMLAudioElement | null>(null);
  const clackSoundRef = useRef<HTMLAudioElement | null>(null);
  const silenceRef = useRef<HTMLAudioElement | null>(null);
  const mediaUnlockedRef = useRef(false);
  
  // Debug: Track clack events
  const [clackDebugState, setClackDebugState] = useState({
    lastClackTime: 0,
    clackCount: 0,
  });

  // Web Audio API refs for iOS native (avoids Now Playing widget)
  const audioContextRef = useRef<AudioContext | null>(null);
  const bellBufferRef = useRef<AudioBuffer | null>(null);
  const warningBufferRef = useRef<AudioBuffer | null>(null);
  const clackBufferRef = useRef<AudioBuffer | null>(null);

  const isIOSNative = Capacitor.getPlatform() === "ios";

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
      // Files are in the local app bundle, fetch is instant
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await ctx.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.warn(`[WebAudio] Failed to load ${url}:`, error);
      return null;
    }
  }, []);

  // Play audio using Web Audio API (doesn't trigger Now Playing)
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

  // Initialize audio - Web Audio API for all platforms (needed for clack to avoid autoplay blocking), HTMLAudioElement as backup
  useEffect(() => {
    const initAudio = async () => {
      // Initialize Web Audio API for ALL platforms (not just iOS native)
      // Needed for clack to bypass iOS Safari autoplay restrictions
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx && !audioContextRef.current) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;

          // Load audio from local bundle into buffers
          bellBufferRef.current = await loadAudioBuffer("/big-bell-330719.mp3", ctx);
          warningBufferRef.current = await loadAudioBuffer("/interval.mp3", ctx);
          // TEMP TEST: Use warning sound for clack to test if file is the issue
          clackBufferRef.current = await loadAudioBuffer("/interval.mp3", ctx);

          console.log("[WebAudio] Web Audio API initialized", {
            isIOSNative,
            bellLoaded: !!bellBufferRef.current,
            warningLoaded: !!warningBufferRef.current,
            clackLoaded: !!clackBufferRef.current,
            clackDuration: clackBufferRef.current?.duration
          });
        }
      } catch (error) {
        console.warn("[WebAudio] Web Audio API init failed:", error);
      }

      // Also init HTMLAudioElement for bell/warning (not affected by autoplay issues)
      if (!isIOSNative) {
        // Non-iOS: Use HTMLAudioElement (works fine without Now Playing issues)
        try {
          if (!bellSoundRef.current) {
            bellSoundRef.current = new Audio("/big-bell-330719.mp3");
            bellSoundRef.current.preload = "auto";
            bellSoundRef.current.volume = 0.5;
            if (iosAudioSession && iosAudioSession.configureAudioElement) {
              iosAudioSession.configureAudioElement(bellSoundRef.current);
            }
          }

          if (!warningSoundRef.current) {
            warningSoundRef.current = new Audio("/interval.mp3");
            warningSoundRef.current.preload = "auto";
            warningSoundRef.current.volume = 0.4;
            if (iosAudioSession && iosAudioSession.configureAudioElement) {
              iosAudioSession.configureAudioElement(warningSoundRef.current);
            }
          }

          if (!clackSoundRef.current) {
            // TEMP TEST: Use warning sound for clack to test if file is the issue
            clackSoundRef.current = new Audio("/interval.mp3");
            clackSoundRef.current.preload = "auto";
            clackSoundRef.current.volume = 0.6;
            if (iosAudioSession && iosAudioSession.configureAudioElement) {
              iosAudioSession.configureAudioElement(clackSoundRef.current);
            }
          }

          if (!silenceRef.current) {
            silenceRef.current = new Audio("/silence.wav");
            silenceRef.current.preload = "auto";
            if (iosAudioSession && iosAudioSession.configureAudioElement) {
              iosAudioSession.configureAudioElement(silenceRef.current);
            }
          }
        } catch (error) {
          console.warn("[AudioInit] Failed to initialize audio elements:", error);
        }
      }
    };

    initAudio();

    // Cleanup on unmount
    return () => {
      try {
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
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
        if (clackSoundRef.current) {
          clackSoundRef.current.pause();
          clackSoundRef.current.src = "";
          clackSoundRef.current.load();
          clackSoundRef.current = null;
        }
        if (silenceRef.current) {
          silenceRef.current.pause();
          silenceRef.current.src = "";
          silenceRef.current.load();
          silenceRef.current = null;
        }
      } catch (error) {
        console.warn("[AudioCleanup] Error during cleanup:", error);
      }
    };
  }, [isIOSNative, iosAudioSession, loadAudioBuffer]);

  // Update volume based on iOS session (only for non-iOS native)
  useEffect(() => {
    if (!isIOSNative) {
      if (bellSoundRef.current && iosAudioSession.shouldMixWithOthers()) {
        bellSoundRef.current.volume = 0.3;
        iosAudioSession.configureAudioElement(bellSoundRef.current);
      }

      if (warningSoundRef.current && iosAudioSession.shouldMixWithOthers()) {
        warningSoundRef.current.volume = 0.2;
        iosAudioSession.configureAudioElement(warningSoundRef.current);
      }

      if (clackSoundRef.current && iosAudioSession.shouldMixWithOthers()) {
        clackSoundRef.current.volume = 0.4;
        iosAudioSession.configureAudioElement(clackSoundRef.current);
      }
    }
  }, [isIOSNative, iosAudioSession]);

  // Bell - use Web Audio API on iOS native, HTMLAudioElement otherwise
  const playBell = useCallback(() => {
    if (isIOSNative) {
      // iOS native: Web Audio API (no Now Playing widget)
      if (bellBufferRef.current) {
        playWebAudioBuffer(bellBufferRef.current, 0.3);
      } else {
        webAudioChime();
      }
    } else {
      // Other platforms: HTMLAudioElement
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
    }
  }, [isIOSNative, playWebAudioBuffer, webAudioChime]);

  // 10-second warning sound
  const playWarningSound = useCallback(() => {
    if (isIOSNative) {
      // iOS native: Web Audio API (no Now Playing widget)
      if (warningBufferRef.current) {
        playWebAudioBuffer(warningBufferRef.current, 0.2);
      }
    } else {
      // Other platforms: HTMLAudioElement
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
    }
  }, [isIOSNative, playWebAudioBuffer]);

  // Clapperboard clack for freestyle mode - Use Web Audio for all platforms to avoid iOS Safari autoplay blocking
  const playClack = useCallback(() => {
    console.log("[SFX] playClack called", { 
      isIOSNative, 
      hasBuffer: !!clackBufferRef.current, 
      hasElement: !!clackSoundRef.current,
      hasContext: !!audioContextRef.current
    });
    
    // Update debug state
    setClackDebugState(prev => ({
      lastClackTime: Date.now(),
      clackCount: prev.clackCount + 1,
    }));
    
    // Use Web Audio API for ALL platforms (not just iOS native)
    // HTMLAudioElement gets blocked by iOS Safari autoplay policy in setTimeout
    if (clackBufferRef.current && audioContextRef.current) {
      console.log("[SFX] Playing clack via Web Audio API");
      playWebAudioBuffer(clackBufferRef.current, 0.3);
    } else if (isIOSNative) {
      // iOS native fallback (shouldn't happen)
      console.warn("[SFX] No clack buffer on iOS native - using fallback");
      webAudioChime();
    } else {
      // Desktop fallback to HTMLAudioElement
      console.log("[SFX] Using HTMLAudioElement fallback (desktop)");
      try {
        const clack = clackSoundRef.current;
        if (clack) {
          clack.currentTime = 0;
          const p = clack.play();
          if (p && typeof p.then === "function") {
            p.then(() => {
              console.log("[SFX] Clack play SUCCESS");
            }).catch((err) => {
              console.error("[SFX] Clack play FAILED:", {
                name: err.name,
                message: err.message,
                code: err.code,
                toString: err.toString()
              });
              webAudioChime();
            });
          }
        } else {
          webAudioChime();
        }
      } catch (err) {
        console.error("[SFX] Clack error:", err);
        webAudioChime();
      }
    }
  }, [isIOSNative, playWebAudioBuffer, webAudioChime]);

  // Proactively unlock audio on user gesture
  const ensureMediaUnlocked = useCallback(async () => {
    // Only unlock once per session
    if (mediaUnlockedRef.current) return;
    mediaUnlockedRef.current = true;

    // Resume Web Audio context for ALL platforms (needed for clack)
    try {
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
        console.log("[WebAudio] Audio context resumed");
      }
    } catch {
      // Context resume failed
    }

    // Also unlock HTMLAudioElements for non-iOS native
    if (!isIOSNative) {
      // Other platforms: Unlock HTMLAudioElements
      try {
        const bell = bellSoundRef.current;
        if (bell) {
          const origVol = bell.volume;
          bell.muted = true;
          bell.volume = 0;
          bell.currentTime = 0;
          try {
            await bell.play();
            bell.pause();
            bell.currentTime = 0;
            bell.muted = false;
            bell.volume = origVol;
          } catch {
            bell.muted = false;
            bell.volume = origVol;
          }
        }

        const warn = warningSoundRef.current;
        if (warn) {
          const origVol = warn.volume;
          warn.muted = true;
          warn.volume = 0;
          warn.currentTime = 0;
          try {
            await warn.play();
            warn.pause();
            warn.currentTime = 0;
            warn.muted = false;
            warn.volume = origVol;
          } catch {
            warn.muted = false;
            warn.volume = origVol;
          }
        }

        const clack = clackSoundRef.current;
        if (clack) {
          const origVol = clack.volume;
          clack.muted = true;
          clack.volume = 0;
          clack.currentTime = 0;
          try {
            await clack.play();
            clack.pause();
            clack.currentTime = 0;
            clack.muted = false;
            clack.volume = origVol;
          } catch {
            clack.muted = false;
            clack.volume = origVol;
          }
        }
      } catch {
        // Unlock failed but we continue
      }
    }
  }, [isIOSNative]);

  return useMemo(
    () => ({ playBell, playWarningSound, playClack, ensureMediaUnlocked, clackDebugState }),
    [playBell, playWarningSound, playClack, ensureMediaUnlocked, clackDebugState]
  );
}
