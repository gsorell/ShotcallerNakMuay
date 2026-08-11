import { useCallback, useEffect, useRef, useState } from "react";
import type { TechniqueWithStyle } from "@/types";
import { mirrorTechnique } from "@/utils/textUtils";
import {
  CADENCE_PER_MIN,
  SLOWEST_INTERVAL_MS,
  rampedIntervalMs,
} from "../utils/cadence";

type SpeakWithDurationFn = (
  text: string,
  speed: number,
  onEnd: (duration: number) => void
) => void;

interface UseCalloutEngineProps {
  timer: {
    running: boolean;
    paused: boolean;
    isResting: boolean;
    isPreRound: boolean;
  };
  settings: any; // We accept the full settings object to access refs like voiceSpeedRef
  speakWithDuration: SpeakWithDurationFn;
}

export function useCalloutEngine({
  timer,
  settings,
  speakWithDuration,
}: UseCalloutEngineProps) {
  const [currentCallout, setCurrentCallout] = useState<string>("");

  // Refs needed for logic
  const calloutRef = useRef<number | null>(null);
  const shotsCalledOutRef = useRef<number>(0);
  const orderedIndexRef = useRef<number>(0);
  const currentPoolRef = useRef<TechniqueWithStyle[]>([]);
  const ttsGuardRef = useRef(false);

  // Watchdog state. The scheduling loop is a chain: each callout schedules the
  // next one from its `onend`. That makes a single lost `onend` fatal — the
  // chain simply stops while the round timer keeps counting down, which is what
  // a backgrounded PWA does when the OS tears down speech mid-utterance.
  const lastCalloutAtRef = useRef<number>(0);
  const baseDelayRef = useRef<number>(2500);
  // When the current round's callouts began, so a varied-cadence round can tell
  // how far through it is and pick up pace accordingly. Set per round rather
  // than per session; each round runs its own arc.
  const roundStartedAtRef = useRef<number>(0);
  const startCalloutsRef = useRef<((delay?: number) => void) | null>(null);

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
          ? CADENCE_PER_MIN.easy
          : settings.difficulty === "hard"
          ? CADENCE_PER_MIN.hard
          : CADENCE_PER_MIN.medium;
      const baseDelayMs = Math.round(60000 / cadencePerMin);
      const minDelayMultiplier = settings.difficulty === "hard" ? 0.35 : 0.5;
      const minDelayMs = Math.round(baseDelayMs * minDelayMultiplier);
      baseDelayRef.current = baseDelayMs;

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

        // Select Technique. Ordering is read through a ref so a caller can
        // switch between sequential and random at a round boundary without
        // restarting the callout loop — see useWorkoutSettings.
        let selectedTechnique: TechniqueWithStyle;
        if (settings.readInOrderRef.current) {
          selectedTechnique = pool[orderedIndexRef.current % pool.length]!;
          orderedIndexRef.current += 1;
        } else {
          selectedTechnique = pool[Math.floor(Math.random() * pool.length)]!;
        }

        shotsCalledOutRef.current += 1;
        lastCalloutAtRef.current = Date.now();

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

        // The screen can carry more than the voice does — the guided path shows
        // "1 · Jab" while calling just one of the two.
        let displayPhrase = finalPhrase;
        if (selectedTechnique.display) {
          try {
            displayPhrase = settings.southpawModeRef.current
              ? mirrorTechnique(
                  selectedTechnique.display,
                  selectedTechnique.style
                )
              : selectedTechnique.display;
          } catch {
            displayPhrase = selectedTechnique.display;
          }
        }
        setCurrentCallout(displayPhrase);

        // Speak
        speakWithDuration(
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
            let nextDelayMs = Math.max(
              minDelayMs,
              Math.min(responsiveDelayMs, timingCap)
            );

            // Phrasing, not noise. An earlier attempt multiplied the gap by a
            // wide uniform random factor, which read as broken rather than
            // human — uncorrelated gaps have no musical logic, and it threw
            // away the duration-responsive timing that was already right.
            //
            // Instead: rest after a call in proportion to how much it asked
            // for (speech duration tracks combination length), plus a small
            // wobble, plus the occasional held beat to reset stance. The cap
            // is skipped deliberately — clamping every gap to it is what
            // flattens a four-punch combination into the same space as a jab.
            if (settings.variedCadenceRef?.current) {
              // The round picks up pace as it goes: novice at the bell,
              // near amateur by the end. See utils/cadence.
              const roundMs = Math.max(
                1,
                Math.round((settings.roundMin || 1) * 60000)
              );
              const elapsed = Date.now() - roundStartedAtRef.current;
              const rampedBase = rampedIntervalMs(elapsed / roundMs);

              const workRest = rampedBase * 0.6;
              const wobble = 1 + (Math.random() - 0.5) * 0.24; // ±12%
              let gap = workRest * wobble;
              // A smaller held beat than before, because the ceiling below now
              // absorbs most of it anyway.
              if (Math.random() < 0.16) gap += 250 + Math.random() * 350;
              nextDelayMs = Math.min(
                SLOWEST_INTERVAL_MS,
                Math.max(minDelayMs, actualDurationMs + bufferTime + gap)
              );
            }

            scheduleNext(nextDelayMs);
          }
        );
      };

      scheduleNext(initialDelay);
    },
    [
      settings.difficulty,
      settings.readInOrderRef,
      settings.variedCadenceRef,
      settings.southpawModeRef,
      settings.voiceSpeedRef,
      stopTechniqueCallouts,
      speakWithDuration,
    ]
  );

  // Keep a stable handle for the watchdog, which must not re-subscribe every
  // time the callback identity changes.
  useEffect(() => {
    startCalloutsRef.current = startTechniqueCallouts;
  }, [startTechniqueCallouts]);

  /**
   * Restart the chain if callouts have gone quiet while the round is still
   * live. Without this a single dropped `onend` — a backgrounded tab, an OS
   * that kills speech, an interrupted utterance — leaves the timer running
   * against silence until the user notices and pauses/resumes by hand.
   */
  useEffect(() => {
    if (!timer.running || timer.paused || timer.isResting || timer.isPreRound) {
      return;
    }
    const id = window.setInterval(() => {
      if (
        ttsGuardRef.current ||
        !runningRef.current ||
        pausedRef.current ||
        isRestingRef.current ||
        !currentPoolRef.current.length
      ) {
        return;
      }
      const silentFor = Date.now() - lastCalloutAtRef.current;
      // Generous: three times the expected gap, floor of six seconds, so a
      // long utterance or a held beat never trips it.
      const limit = Math.max(6000, baseDelayRef.current * 3);
      if (silentFor <= limit) return;

      try {
        window.speechSynthesis.resume();
      } catch {}
      lastCalloutAtRef.current = Date.now();
      startCalloutsRef.current?.(0);
    }, 2000);
    return () => window.clearInterval(id);
  }, [timer.running, timer.paused, timer.isResting, timer.isPreRound]);

  // Auto-start effect
  useEffect(() => {
    if (!timer.running || timer.paused || timer.isResting) return;
    lastCalloutAtRef.current = Date.now();
    // Restarts the pace ramp. This also fires on resuming from a pause, which
    // means coming back eases you in again rather than dropping you at whatever
    // speed the round had reached — the kinder of the two behaviours.
    roundStartedAtRef.current = Date.now();
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
        return;
      }

      // Coming back into view. speechSynthesis is paused per-engine, not
      // per-utterance, so a pause that is never undone silences every later
      // round: the next callout is spoken into a paused engine, its `onend`
      // never fires, and the loop — which schedules the next callout from that
      // callback — stops dead while the clock keeps running. Resuming here is
      // what keeps the session alive after a tab switch or screen blank.
      if (!isHidden && typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.resume();
        } catch {}
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
