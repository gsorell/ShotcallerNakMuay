import { useCallback, useEffect, useRef, useState } from "react";
import type { TechniqueWithStyle } from "../types";
import { mirrorTechnique } from "../utils/textUtils";

interface UseCalloutEngineProps {
  timer: {
    running: boolean;
    paused: boolean;
    isResting: boolean;
    isPreRound: boolean;
  };
  settings: any; // We accept the full settings object to access refs like voiceSpeedRef
  tts: {
    speakSystemWithDuration: (
      text: string,
      speed: number,
      onEnd: (duration: number) => void
    ) => void;
  };
}

export function useCalloutEngine({
  timer,
  settings,
  tts,
}: UseCalloutEngineProps) {
  const [currentCallout, setCurrentCallout] = useState<string>("");

  // Refs needed for logic
  const calloutRef = useRef<number | null>(null);
  const shotsCalledOutRef = useRef<number>(0);
  const orderedIndexRef = useRef<number>(0);
  const currentPoolRef = useRef<TechniqueWithStyle[]>([]);
  const ttsGuardRef = useRef(false);

  // Helper refs to avoid dependency cycles in the timeout loop
  const runningRef = useRef(timer.running);
  const pausedRef = useRef(timer.paused);
  const isRestingRef = useRef(timer.isResting);

  // Sync refs with state
  useEffect(() => {
    runningRef.current = timer.running;
    pausedRef.current = timer.paused;
    isRestingRef.current = timer.isResting;

    // Guard: If we shouldn't be speaking, clean up
    ttsGuardRef.current = !timer.running || timer.paused || timer.isResting;
    if (ttsGuardRef.current) {
      stopTechniqueCallouts();
      setCurrentCallout("");
    }
  }, [timer.running, timer.paused, timer.isResting]);

  const stopTechniqueCallouts = useCallback(() => {
    if (calloutRef.current) {
      clearTimeout(calloutRef.current);
      calloutRef.current = null;
    }
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch {}
  }, []);

  const stopAllNarration = useCallback(() => {
    stopTechniqueCallouts();
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }, [stopTechniqueCallouts]);

  const startTechniqueCallouts = useCallback(
    (initialDelay = 800) => {
      // Calculate delays based on difficulty
      const cadencePerMin =
        settings.difficulty === "easy"
          ? 20
          : settings.difficulty === "hard"
          ? 42
          : 26;
      const baseDelayMs = Math.round(60000 / cadencePerMin);
      const minDelayMultiplier = settings.difficulty === "hard" ? 0.35 : 0.5;
      const minDelayMs = Math.round(baseDelayMs * minDelayMultiplier);

      const scheduleNext = (delay: number) => {
        if (calloutRef.current) {
          clearTimeout(calloutRef.current);
          calloutRef.current = null;
        }
        calloutRef.current = window.setTimeout(
          doCallout,
          Math.max(0, delay)
        ) as unknown as number;
      };

      const doCallout = () => {
        // Immediate guards
        if (
          ttsGuardRef.current ||
          !runningRef.current ||
          pausedRef.current ||
          isRestingRef.current
        ) {
          stopTechniqueCallouts();
          return;
        }

        const pool = currentPoolRef.current;
        if (!pool.length) {
          stopTechniqueCallouts();
          return;
        }

        // Select Technique
        let selectedTechnique: TechniqueWithStyle;
        if (settings.readInOrder) {
          selectedTechnique = pool[orderedIndexRef.current % pool.length]!;
          orderedIndexRef.current += 1;
        } else {
          selectedTechnique = pool[Math.floor(Math.random() * pool.length)]!;
        }

        shotsCalledOutRef.current += 1;

        // Determine Text
        let finalPhrase = "";
        try {
          finalPhrase = settings.southpawModeRef.current
            ? mirrorTechnique(selectedTechnique.text, selectedTechnique.style)
            : selectedTechnique.text;
        } catch (e) {
          finalPhrase = selectedTechnique.text || "";
        }

        if (!finalPhrase || finalPhrase.trim() === "") {
          setCurrentCallout(selectedTechnique.text || "");
          return;
        }

        setCurrentCallout(finalPhrase);

        // Speak
        tts.speakSystemWithDuration(
          finalPhrase,
          settings.voiceSpeedRef.current,
          (actualDurationMs: number) => {
            // Calculate Wait Time for Next Shot
            const isPro = settings.difficulty === "hard";
            const bufferMultiplier = isPro ? 0.12 : 0.2;
            const bufferTime = Math.max(
              isPro ? 120 : 200,
              Math.min(isPro ? 500 : 800, baseDelayMs * bufferMultiplier)
            );
            const jitterMultiplier = isPro ? 0.05 : 0.08;
            const jitter = Math.floor(
              baseDelayMs * jitterMultiplier * (Math.random() - 0.5)
            );
            const responsiveDelayMs = actualDurationMs + bufferTime + jitter;
            const timingCap = isPro ? baseDelayMs * 0.85 : baseDelayMs * 1.1;
            const nextDelayMs = Math.max(
              minDelayMs,
              Math.min(responsiveDelayMs, timingCap)
            );
            scheduleNext(nextDelayMs);
          }
        );
      };

      scheduleNext(initialDelay);
    },
    [
      settings.difficulty,
      settings.readInOrder,
      settings.southpawModeRef,
      settings.voiceSpeedRef,
      stopTechniqueCallouts,
      tts,
    ]
  );

  // Auto-start effect
  useEffect(() => {
    if (!timer.running || timer.paused || timer.isResting) return;
    startTechniqueCallouts(800);
    return () => {
      stopTechniqueCallouts();
    };
  }, [
    timer.running,
    timer.paused,
    timer.isResting,
    startTechniqueCallouts,
    stopTechniqueCallouts,
  ]);

  // Visibility Change (Pause audio when tab hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden || document.visibilityState === "hidden";
      if (
        isHidden &&
        timer.running &&
        !timer.paused &&
        !timer.isResting &&
        !timer.isPreRound
      ) {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          try {
            window.speechSynthesis.pause();
          } catch {}
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [timer.running, timer.paused, timer.isResting, timer.isPreRound]);

  return {
    currentCallout,
    setCurrentCallout,
    startTechniqueCallouts,
    stopTechniqueCallouts,
    stopAllNarration,
    shotsCalledOutRef,
    orderedIndexRef,
    currentPoolRef,
  };
}
