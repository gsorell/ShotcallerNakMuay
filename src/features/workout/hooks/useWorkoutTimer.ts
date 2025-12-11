// src/hooks/useWorkoutTimer.ts
import { useCallback, useEffect, useRef, useState } from "react";

interface TimerProps {
  roundMin: number;
  restMinutes: number;
  roundsCount: number;
  onRoundStart?: () => void;
  onRoundEnd?: () => void;
  onRestStart?: (duration: number) => void;
  onRestEnd?: () => void;
  onWorkoutComplete?: () => void;
  onRestWarning?: () => void; // 10s warning
  onRestBell?: () => void; // 5s warning
}

export function useWorkoutTimer({
  roundMin,
  restMinutes,
  roundsCount,
  onRoundStart,
  onRoundEnd,
  onRestStart,
  onRestEnd,
  onWorkoutComplete,
  onRestWarning,
  onRestBell,
}: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [isPreRound, setIsPreRound] = useState(false);
  const [preRoundTimeLeft, setPreRoundTimeLeft] = useState(0);

  // Refs to track audio played state during rest
  const warningPlayedRef = useRef(false);
  const intervalBellPlayedRef = useRef(false);

  // --- Actions ---

  const startTimer = useCallback(() => {
    setCurrentRound(1);
    setIsPreRound(true);
    setPreRoundTimeLeft(5);
    // Note: Caller handles scrolling/audio
  }, []);

  const pauseTimer = useCallback(() => {
    if (!running) return;
    setPaused((prev) => !prev);
  }, [running]);

  const stopTimer = useCallback(() => {
    setPaused(false);
    setRunning(false);
    setCurrentRound(0);
    setTimeLeft(0);
    setIsResting(false);
    setIsPreRound(false);
    setPreRoundTimeLeft(0);
  }, []);

  const resumeTimerState = useCallback((logEntry: any) => {
    setCurrentRound(logEntry.roundsCompleted + 1);
    setIsPreRound(true);
    setPreRoundTimeLeft(5);
  }, []);

  // --- Effects ---

  // 1. Pre-round Logic
  useEffect(() => {
    if (!isPreRound) return;
    if (preRoundTimeLeft <= 0) {
      setIsPreRound(false);
      setTimeLeft(Math.max(1, Math.round(roundMin * 60)));
      setIsResting(false);
      setPaused(false);
      setRunning(true);
      if (onRoundStart) onRoundStart();
      return;
    }
    const id = window.setTimeout(() => setPreRoundTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(id);
  }, [isPreRound, preRoundTimeLeft, roundMin, onRoundStart]);

  // 2. Main Timer Tick
  useEffect(() => {
    if (!running || paused) return;
    let id: number | null = null;

    if (!isResting) {
      // Round Timer
      id = window.setInterval(
        () => setTimeLeft((prev) => Math.max(prev - 1, 0)),
        1000
      );
    } else {
      // Rest Timer
      id = window.setInterval(
        () => setRestTimeLeft((prev) => Math.max(prev - 1, 0)),
        1000
      );
    }
    return () => {
      if (id) window.clearInterval(id);
    };
  }, [running, paused, isResting]);

  // 3. Round End / Workout End Logic
  useEffect(() => {
    if (!running || paused || isResting) return;
    if (timeLeft > 0) return;

    // Round ended
    if (onRoundEnd) onRoundEnd();

    if (currentRound >= roundsCount) {
      // Workout Finished
      setRunning(false);
      setPaused(false);
      setIsResting(false);
      if (onWorkoutComplete) onWorkoutComplete();
      return;
    }

    // Start Rest
    setIsResting(true);
    const restDuration = Math.max(1, Math.round(restMinutes * 60));
    setRestTimeLeft(restDuration);
    if (onRestStart) onRestStart(restDuration);
  }, [
    timeLeft,
    running,
    paused,
    isResting,
    currentRound,
    roundsCount,
    restMinutes,
    onRoundEnd,
    onWorkoutComplete,
    onRestStart,
  ]);

  // 4. Rest Logic
  useEffect(() => {
    if (isResting) {
      // Reset flags when rest starts
      if (restTimeLeft === Math.max(1, Math.round(restMinutes * 60))) {
        warningPlayedRef.current = false;
        intervalBellPlayedRef.current = false;
      }
    }
  }, [isResting, restMinutes, restTimeLeft]);

  useEffect(() => {
    if (!running || paused || !isResting) return;

    // Warnings
    if (restTimeLeft === 10 && !warningPlayedRef.current) {
      warningPlayedRef.current = true;
      if (onRestWarning) onRestWarning();
    }
    if (restTimeLeft === 5 && !intervalBellPlayedRef.current) {
      intervalBellPlayedRef.current = true;
      if (onRestBell) onRestBell();
    }

    // Rest Finished
    if (restTimeLeft > 0) return;

    setIsResting(false);
    setCurrentRound((r) => r + 1);
    setTimeLeft(Math.max(1, Math.round(roundMin * 60)));
    if (onRestEnd) onRestEnd();
  }, [
    restTimeLeft,
    running,
    paused,
    isResting,
    roundMin,
    onRestWarning,
    onRestBell,
    onRestEnd,
  ]);

  // Visibility handling (Pause on tab switch)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden || document.visibilityState === "hidden";
      if (isHidden && running && !paused && !isResting && !isPreRound) {
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [running, paused, isResting, isPreRound]);

  return {
    timeLeft,
    setTimeLeft,
    restTimeLeft,
    setRestTimeLeft,
    currentRound,
    setCurrentRound,
    running,
    setRunning,
    paused,
    setPaused,
    isResting,
    setIsResting,
    isPreRound,
    setIsPreRound,
    preRoundTimeLeft,
    setPreRoundTimeLeft,
    startTimer,
    pauseTimer,
    stopTimer,
    resumeTimerState,
  };
}
