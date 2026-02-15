import { useCallback, useEffect, useRef } from "react";
import type { Difficulty } from "@/types";

interface UseClackEngineProps {
  timer: {
    running: boolean;
    paused: boolean;
    isResting: boolean;
    isPreRound: boolean;
  };
  difficulty: Difficulty;
  isFreestyle: boolean;
  playClack: () => void;
}

export function useClackEngine({
  timer,
  difficulty,
  isFreestyle,
  playClack,
}: UseClackEngineProps) {
  const clackTimeoutRef = useRef<number | null>(null);

  // Refs to avoid dependency cycles in the timeout loop
  const runningRef = useRef(timer.running);
  const pausedRef = useRef(timer.paused);
  const isRestingRef = useRef(timer.isResting);
  const isFreestyleRef = useRef(isFreestyle);

  useEffect(() => {
    runningRef.current = timer.running;
    pausedRef.current = timer.paused;
    isRestingRef.current = timer.isResting;
    isFreestyleRef.current = isFreestyle;
  }, [timer.running, timer.paused, timer.isResting, isFreestyle]);

  const stopClacks = useCallback(() => {
    if (clackTimeoutRef.current) {
      clearTimeout(clackTimeoutRef.current);
      clackTimeoutRef.current = null;
    }
  }, []);

  const startClacks = useCallback(
    (initialDelay = 800) => {
      // Same cadence as callout engine
      const cadencePerMin =
        difficulty === "easy" ? 20 : difficulty === "hard" ? 42 : 26;
      const baseDelayMs = Math.round(60000 / cadencePerMin);
      const jitterMultiplier = difficulty === "hard" ? 0.05 : 0.08;

      const scheduleNext = (delay: number) => {
        if (clackTimeoutRef.current) {
          clearTimeout(clackTimeoutRef.current);
          clackTimeoutRef.current = null;
        }
        clackTimeoutRef.current = window.setTimeout(
          doClack,
          Math.max(0, delay)
        ) as unknown as number;
      };

      const doClack = () => {
        if (
          !runningRef.current ||
          pausedRef.current ||
          isRestingRef.current ||
          !isFreestyleRef.current
        ) {
          stopClacks();
          return;
        }

        playClack();

        // Schedule next clack: base delay + jitter
        const jitter = Math.floor(
          baseDelayMs * jitterMultiplier * (Math.random() - 0.5)
        );
        const nextDelay = baseDelayMs + jitter;
        scheduleNext(nextDelay);
      };

      scheduleNext(initialDelay);
    },
    [difficulty, playClack, stopClacks]
  );

  // Auto-start/stop based on timer state
  useEffect(() => {
    if (!isFreestyle) {
      stopClacks();
      return;
    }

    if (timer.running && !timer.paused && !timer.isResting) {
      startClacks(800);
    } else {
      stopClacks();
    }

    return () => {
      stopClacks();
    };
  }, [
    isFreestyle,
    timer.running,
    timer.paused,
    timer.isResting,
    startClacks,
    stopClacks,
  ]);

  return { startClacks, stopClacks };
}
