// src/hooks/useWorkoutTimer.ts
import { useCallback, useEffect, useRef, useState } from "react";

/** How long "Get Ready" holds before the first round. */
const PRE_ROUND_SECONDS = 5;

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

  // When the pre-round countdown is due to end, as an absolute timestamp, and
  // what was left on it when the user paused.
  //
  // The countdown used to be a chained setTimeout: each tick existed only
  // because the previous one fired and changed the count, which re-ran the
  // effect and armed the next. That chain was its own only means of
  // rescheduling, so a single timer the platform never delivered killed it
  // outright -- "Get Ready" sat frozen on screen forever, with Stop the only
  // way out. iOS WebViews drop and defer timers for several reasons (scrolling,
  // suspend/resume, Low Power Mode coalescing), and the round clock never had
  // this problem because an interval re-arms itself.
  //
  // Reading a deadline instead of counting ticks makes a late or missing tick
  // cost nothing: the next one still computes the right number, and a stall
  // long enough to cover the whole countdown lands on the round rather than
  // stopping short of it.
  const preRoundEndsAtRef = useRef(0);
  const preRoundRemainingRef = useRef(0);
  // Latched when the countdown hands over to round one, so that two callers
  // arriving at an elapsed deadline together cannot ring the bell twice.
  const preRoundFiredRef = useRef(false);

  // --- Actions ---

  const startTimer = useCallback(() => {
    setCurrentRound(1);
    preRoundEndsAtRef.current = Date.now() + PRE_ROUND_SECONDS * 1000;
    preRoundRemainingRef.current = 0;
    preRoundFiredRef.current = false;
    setIsPreRound(true);
    setPreRoundTimeLeft(PRE_ROUND_SECONDS);
    // Note: Caller handles scrolling/audio
  }, []);

  const pauseTimer = useCallback(() => {
    // Pre-round counts as an active session. The Pause button is on screen
    // throughout "Get Ready", and until this it did nothing there at all,
    // because `running` does not become true until the countdown is over.
    if (!running && !isPreRound) return;
    setPaused((prev) => !prev);
  }, [running, isPreRound]);

  const stopTimer = useCallback(() => {
    setPaused(false);
    setRunning(false);
    setCurrentRound(0);
    setTimeLeft(0);
    setIsResting(false);
    setIsPreRound(false);
    setPreRoundTimeLeft(0);
    preRoundEndsAtRef.current = 0;
    preRoundRemainingRef.current = 0;
    preRoundFiredRef.current = false;
  }, []);

  const resumeTimerState = useCallback((logEntry: any) => {
    setCurrentRound(logEntry.roundsCompleted + 1);
    preRoundEndsAtRef.current = Date.now() + PRE_ROUND_SECONDS * 1000;
    preRoundRemainingRef.current = 0;
    preRoundFiredRef.current = false;
    setIsPreRound(true);
    setPreRoundTimeLeft(PRE_ROUND_SECONDS);
  }, []);

  // --- Effects ---

  // 1a. Hold and rebuild the pre-round deadline across a pause.
  //
  // Declared before the ticking effect so that on resume the deadline is back
  // in place by the time that effect reads it: React runs every cleanup for a
  // commit first, then every effect body, both in declaration order.
  useEffect(() => {
    if (!isPreRound) return;
    if (paused) {
      preRoundRemainingRef.current = Math.max(
        0,
        preRoundEndsAtRef.current - Date.now()
      );
    } else if (preRoundRemainingRef.current > 0) {
      preRoundEndsAtRef.current = Date.now() + preRoundRemainingRef.current;
      preRoundRemainingRef.current = 0;
    }
  }, [isPreRound, paused]);

  // 1b. Pre-round Logic
  //
  // Safe to call as often as anything likes: it reads the deadline rather than
  // counting, and the latch makes the handover to round one happen exactly
  // once however many callers arrive at an elapsed deadline together.
  const advancePreRound = useCallback(() => {
    if (preRoundFiredRef.current) return;

    const remainingMs = preRoundEndsAtRef.current - Date.now();
    if (remainingMs > 0) {
      setPreRoundTimeLeft(Math.ceil(remainingMs / 1000));
      return;
    }

    preRoundFiredRef.current = true;
    setIsPreRound(false);
    setPreRoundTimeLeft(0);
    setTimeLeft(Math.max(1, Math.round(roundMin * 60)));
    setIsResting(false);
    setPaused(false);
    setRunning(true);
    if (onRoundStart) onRoundStart();
  }, [roundMin, onRoundStart]);

  useEffect(() => {
    if (!isPreRound || paused) return;

    // Three independent ways for the countdown to move, because the whole
    // point is not to depend on any single one surviving: the interval, an
    // immediate check each time this effect runs, and coming back to the
    // foreground -- which is where a WebView that binned its timers while
    // backgrounded gets caught up. Sub-second so the number turns over close
    // to when it should, and so a late tick costs a fraction of a second
    // rather than a whole one.
    const id = window.setInterval(advancePreRound, 250);
    const onVisibility = () => {
      if (!document.hidden) advancePreRound();
    };
    document.addEventListener("visibilitychange", onVisibility);
    advancePreRound();

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isPreRound, paused, advancePreRound]);

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
