import { useState, useEffect, useRef, useCallback } from 'react';
import INITIAL_TECHNIQUES from './techniques';
import TechniqueEditor from './TechniqueEditor';
import WorkoutLogs from './WorkoutLogs';
import './App.css';
import './difficulty.css';
import useWakeLock from './useWakeLock';

// --- NEW: Define shared types and constants ---
type TechniquesShape = typeof INITIAL_TECHNIQUES;
const TECHNIQUES_STORAGE_KEY = 'shotcaller_techniques';
const WORKOUTS_STORAGE_KEY = 'shotcaller_workouts';

// Types
type EmphasisKey = 'khao' | 'mat' | 'tae' | 'femur' | 'sok' | 'boxing'; // Calisthenics removed from primary type
type Difficulty = 'easy' | 'medium' | 'hard';
type Page = 'timer' | 'editor' | 'logs';

// Configuration
const EMPHASIS = [
  { key: 'khao' as EmphasisKey, label: 'Muay Khao', icon: '🙏', desc: 'Close-range clinch work and knee combinations' },
  { key: 'mat' as EmphasisKey, label: 'Muay Mat', icon: '🥊', desc: 'Heavy hands and boxing combinations' },
  { key: 'tae' as EmphasisKey, label: 'Muay Tae', icon: '🦵', desc: 'Kicking specialist with long-range attacks' },
  { key: 'femur' as EmphasisKey, label: 'Muay Femur', icon: '🧠', desc: 'Technical timing and defensive counters' },
  { key: 'sok' as EmphasisKey, label: 'Muay Sok', icon: '🔪', desc: 'Vicious elbow strikes and close-range attacks' },
  { key: 'boxing' as EmphasisKey, label: 'Boxing', icon: '👊', desc: 'Focus on fundamental boxing combinations' }
];

// ADD: default rest length (seconds)
const DEFAULT_REST_SECONDS = 15;

// --- NEW: Standardized single strikes library ---
// Removed unused standardSingles declaration

// REVISED & EXPANDED Technique library with extensive, sensible combinations and single strikes

export default function App() {
  const [page, setPage] = useState<Page>('timer');
  const wakeLock = useWakeLock({ enabled: true });

  // Effect to manage the screen wake lock
  useEffect(() => {
    // If your useWakeLock hook provides a method to activate/deactivate, call it here.
    // Otherwise, remove this effect or update it to use the correct API.
    // Example: wakeLock.method === 'request' && page === 'timer'
    // If your hook only provides state, you may not need this effect.
  }, [page, wakeLock]);

  // --- NEW: Techniques versioning & state initialization ---
  const TECHNIQUES_VERSION = 'v1';
  const TECHNIQUES_VERSION_KEY = 'shotcaller_techniques';

  const [techniques, setTechniques] = useState<TechniquesShape>(() => {
    try {
      const raw = localStorage.getItem(TECHNIQUES_STORAGE_KEY);
      const storedVersion = localStorage.getItem(TECHNIQUES_VERSION_KEY);
      // If no stored data or version mismatch, seed from bundle and persist version
      if (!raw || storedVersion !== TECHNIQUES_VERSION) {
        localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(INITIAL_TECHNIQUES));
        localStorage.setItem(TECHNIQUES_VERSION_KEY, TECHNIQUES_VERSION);
        return INITIAL_TECHNIQUES;
      }
      return JSON.parse(raw);
    } catch (err) {
      console.warn('Failed to load techniques from storage, using defaults.', err);
      return INITIAL_TECHNIQUES;
    }
  });

  // Setter that persists and updates the in-memory state
  const persistTechniques = (next: TechniquesShape) => {
    try {
      setTechniques(next);
      localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(next));
      localStorage.setItem(TECHNIQUES_VERSION_KEY, TECHNIQUES_VERSION);
    } catch (err) {
      console.error('Failed to persist techniques:', err);
    }
  };

  // --- NEW: Effect to save techniques to localStorage on change ---
  useEffect(() => {
    try {
      localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(techniques));
    } catch (error) {
      console.error("Failed to save techniques to localStorage:", error);
    }
  }, [techniques]);

  // State management
  const [selectedEmphases, setSelectedEmphases] = useState<Record<EmphasisKey, boolean>>({
    khao: false, mat: false, tae: false, femur: false, sok: false, boxing: false
  });
  const [addCalisthenics, setAddCalisthenics] = useState(false); // New state for calisthenics
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [roundsCount, setRoundsCount] = useState(5);
  const [roundMin, setRoundMin] = useState(3);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(1); // Set default speed to 100%
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // ADD: Load voices from speechSynthesis
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const update = () => setVoices(synth.getVoices());
    update();
    synth.onvoiceschanged = update;
    return () => {
      synth.onvoiceschanged = null;
    };
  }, []);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const calloutRef = useRef<number | null>(null);
  const bellSoundRef = useRef<HTMLAudioElement | null>(null);
  const [restTimeLeft, setRestTimeLeft] = useState(0);

  // ADD: Technique pool builder + helpers
  function collectTechniqueStrings(node: unknown, out: string[]) {
    if (!node) return;
    if (typeof node === 'string') { out.push(node); return; }
    if (Array.isArray(node)) { node.forEach(n => collectTechniqueStrings(n, out)); return; }
    if (typeof node === 'object') {
      for (const v of Object.values(node as Record<string, unknown>)) {
        collectTechniqueStrings(v, out);
      }
    }
  }

  const getTechniquePool = useCallback((): string[] => {
    // keys that are enabled
    const enabled = (Object.entries(selectedEmphases) as [EmphasisKey, boolean][])
      .filter(([, v]) => v)
      .map(([k]) => k);

    const pool: string[] = [];
    if (enabled.length) {
      for (const k of enabled) {
        collectTechniqueStrings((techniques as any)[k], pool);
      }
    }
    // optional: include calisthenics section if toggled and present
    if (addCalisthenics && (techniques as any)?.calisthenics) {
      collectTechniqueStrings((techniques as any).calisthenics, pool);
    }
    // fallback to full library if selection yields nothing
    if (pool.length === 0) {
      collectTechniqueStrings(techniques as any, pool);
    }
    // normalize + dedupe
    return Array.from(new Set(pool.map(s => String(s).trim()).filter(Boolean)));
  }, [techniques, selectedEmphases, addCalisthenics]);

  const techniquePoolRef = useRef<string[]>([]);
  useEffect(() => {
    techniquePoolRef.current = getTechniquePool();
  }, [getTechniquePool]);

  function pickRandom<T>(arr: T[]): T | undefined {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Refs kept in sync to avoid stale closures in timeouts
  const runningRef = useRef(running);
  useEffect(() => { runningRef.current = running; }, [running]);

  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // NEW: Global guard that makes speak() a no-op when not active
  const ttsGuardRef = useRef<boolean>(false);

  // Centralized hard stop for any narration/callout
  const stopAllNarration = useCallback(() => {
    if (calloutRef.current) {
      clearTimeout(calloutRef.current);
      calloutRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const synth = window.speechSynthesis;
        // Force-flush stubborn engines
        synth.pause();
        synth.cancel();
        synth.resume();
        synth.cancel();
      } catch { /* noop */ }
    }
  }, []);

  // Make speak a safe no-op during rest/pause/stop
  const speak = useCallback((text: string, selectedVoice: SpeechSynthesisVoice | null, speed: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Do not speak if we’re resting, paused, or not running
    if (ttsGuardRef.current || !runningRef.current) return;

    try { window.speechSynthesis.cancel(); } catch { /* noop */ }

    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = speed;

    utterance.onstart = () => {
      if (ttsGuardRef.current || !runningRef.current) {
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
      }
    };

    window.speechSynthesis.speak(utterance);
  }, []);
  const speakRef = useRef(speak);
  useEffect(() => { speakRef.current = speak; }, [speak]);

  // REVISED Voice callout system - keep the loop guarded by refs
  const startTechniqueCallouts = useCallback((initialDelay = 2000) => {
    // cadence by difficulty
    const baseDelayMs =
      difficulty === 'easy' ? 4500 :
      difficulty === 'hard' ? 1800 : 3000;

    const callout = () => {
      if (ttsGuardRef.current || !runningRef.current) return;

      const pool = techniquePoolRef.current;
      const phrase = pickRandom(pool) || 'Jab cross';
      // Speak via ref (respects guards)
      speakRef.current(phrase, voice, voiceSpeed);

      if (ttsGuardRef.current || !runningRef.current) return;
      const jitter = Math.floor(baseDelayMs * 0.15 * (Math.random() - 0.5)); // +/-15%
      const nextDelayMs = Math.max(900, baseDelayMs + jitter);
      calloutRef.current = window.setTimeout(callout, nextDelayMs);
    };

    if (ttsGuardRef.current || !runningRef.current) return;
    calloutRef.current = window.setTimeout(callout, Math.max(0, initialDelay));
  }, [difficulty, voice, voiceSpeed, speakRef]);

  const stopTechniqueCallouts = useCallback(() => {
    if (calloutRef.current) {
      clearTimeout(calloutRef.current);
      calloutRef.current = null;
    }
  }, []);

  // Additionally, immediately stop everything when rest toggles on
  useEffect(() => {
    if (isResting) stopAllNarration();
  }, [isResting, stopAllNarration]);

  // Also stop on pause/stop
  useEffect(() => {
    if (paused || !running) stopAllNarration();
  }, [paused, running, stopAllNarration]);

  // NEW: Keep guard in sync and stop narration immediately on state changes
  useEffect(() => {
    ttsGuardRef.current = (!running) || paused || isResting;
    if (ttsGuardRef.current) {
      stopTechniqueCallouts();
      stopAllNarration();
    }
  }, [running, paused, isResting, stopAllNarration, stopTechniqueCallouts]);

  // Start/stop callouts based on running/paused/resting (now safely below the callbacks)
  useEffect(() => {
    if (!running || paused || isResting) return;

    startTechniqueCallouts(2000);
    return () => {
      stopTechniqueCallouts();
      stopAllNarration();
    };
  }, [running, paused, isResting, startTechniqueCallouts, stopTechniqueCallouts, stopAllNarration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTechniqueCallouts();
      stopAllNarration();
    };
  }, [stopTechniqueCallouts, stopAllNarration])

// ADD: Core round/rest timer engine
  const playBell = useCallback(() => {
    try {
      if (!bellSoundRef.current) {
        bellSoundRef.current = new Audio('/big-bell-330719.mp3');
        bellSoundRef.current.volume = 0.5;
      }
      bellSoundRef.current.currentTime = 0;
      void bellSoundRef.current.play();
    } catch { /* noop */ }
  }, []);

  // Tick seconds for round or rest
  useEffect(() => {
    if (!running || paused) return;

    let intervalId: number | null = null;

    if (!isResting) {
      intervalId = window.setInterval(() => {
        setTimeLeft(prev => Math.max(prev - 1, 0));
      }, 1000) as unknown as number;
    } else {
      intervalId = window.setInterval(() => {
        setRestTimeLeft(prev => Math.max(prev - 1, 0));
      }, 1000) as unknown as number;
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [running, paused, isResting]);

  // Transition: round -> rest (or finish)
  useEffect(() => {
    if (!running || paused || isResting) return;
    if (timeLeft > 0) return;

    // Round just ended
    playBell();
    stopTechniqueCallouts();
    stopAllNarration();

    if (currentRound >= roundsCount) {
      // Finished all rounds
      setRunning(false);
      setPaused(false);
      setIsResting(false);
      return;
    }

    // Enter rest
    setIsResting(true);
    setRestTimeLeft(DEFAULT_REST_SECONDS);
  }, [
    timeLeft,
    running,
    paused,
    isResting,
    currentRound,
    roundsCount,
    playBell,
    stopAllNarration,
    stopTechniqueCallouts
  ]);

  // Transition: rest -> next round
  useEffect(() => {
    if (!running || paused || !isResting) return;
    if (restTimeLeft > 0) return;

    // Rest finished -> start next round
    setIsResting(false);
    setCurrentRound(r => r + 1);
    setTimeLeft(Math.max(1, Math.round(roundMin * 60)));
    playBell();
  }, [restTimeLeft, running, paused, isResting, roundMin, playBell]);

  // Helper functions
  const hasSelectedEmphasis = Object.values(selectedEmphases).some(Boolean);

  function getStatus(): 'ready' | 'running' | 'paused' | 'stopped' | 'resting' {
    if (!running) return 'ready';
    if (paused) return 'paused';
    if (isResting) return 'resting';
    return 'running';
  }

  function fmtTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Add a test function
  function testVoice() {
    console.log('Testing voice with current settings...');
    speak("Voice test - this is a test of the speech system", voice, voiceSpeed);
  }

  // Session controls with voice integration
  function startSession() {
    if (!hasSelectedEmphasis) return;
    console.log('Starting training session');

    // Prime TTS on user gesture
    try {
      const primingUtterance = new SpeechSynthesisUtterance(' ');
      primingUtterance.volume = 0;
      primingUtterance.rate = voiceSpeed;
      if (voice) primingUtterance.voice = voice;
      speechSynthesis.speak(primingUtterance);
    } catch (err) {
      console.warn('Speech priming failed (non-fatal):', err);
    }

    // Prepare bell and start
    if (!bellSoundRef.current) {
      bellSoundRef.current = new Audio('/big-bell-330719.mp3');
      bellSoundRef.current.volume = 0.5;
    }

    // Start immediately; do not gate starting on bell playback promises
    playBell();

    setCurrentRound(1);
    setTimeLeft(Math.max(1, Math.round(roundMin * 60)));
    setIsResting(false);
    setPaused(false);
    setRunning(true);
  }

  function pauseSession() {
    if (!running) return;
    const newPaused = !paused;
    setPaused(newPaused); // This will trigger the useEffect for callouts
    console.log('Session paused:', newPaused);
    
    if (newPaused) {
      speechSynthesis.pause();
    } else {
      speechSynthesis.resume();
    }
  }

  function stopSession() {
    console.log('Stopping training session');
    speechSynthesis.cancel();

    // Determine rounds completed at time of stop:
    // - If currently resting, the round just finished so currentRound counts.
    // - If running and mid-round (timeLeft > 0), that round is incomplete -> count currentRound - 1.
    // - Otherwise count currentRound.
    let roundsCompleted = currentRound;
    if (running && !isResting && timeLeft > 0) {
      roundsCompleted = Math.max(0, currentRound - 1);
    }

    try {
      autoLogWorkout(roundsCompleted);
    } catch (err) {
      console.error('Auto-log on stop failed:', err);
    }

    setPaused(false);
    setRunning(false); // This will trigger the useEffect for callouts
    setCurrentRound(0);
    setTimeLeft(0);
  }

  // --- NEW: Helper to persist a workout snapshot to localStorage ---
  function autoLogWorkout(roundsCompleted: number) {
    try {
      const entry = {
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        roundsPlanned: roundsCount,
        roundsCompleted,
        roundLengthMin: roundMin,
        emphases: Object.entries(selectedEmphases).filter(([, v]) => v).map(([k]) => k)
      };
      const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      localStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(arr));
      console.log('Workout auto-logged:', entry);
    } catch (err) {
      console.error('Failed to auto-log workout:', err);
    }
  }

  // Status-aware timer with better visual hierarchy
  function StatusTimer({ time, round, totalRounds, status }: { 
    time: string; 
    round: number; 
    totalRounds: number; 
    status: 'ready' | 'running' | 'paused' | 'stopped' | 'resting' 
  }) {
    const statusColor = {
      ready: '#4ade80',
      running: '#60a5fa',
      paused: '#fbbf24',
      stopped: '#9ca3af',
      resting: '#a5b4fc'
    }[status];

    const statusText = {
      ready: 'Ready to Start',
      running: 'Training Active',
      paused: 'Paused',
      stopped: 'Session Complete',
      resting: 'Rest Period'
    }[status];

    return (
      <div style={{ 
        width: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        marginBottom: '2rem', // Reduced margin
        textAlign: 'center'
      }}>
        {/* Main Timer Display */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '1rem', // Reduced margin
          width: '100%'
        }}>
          <div
            style={{
              fontSize: "8rem", // Increased font size
              fontWeight: "900",
              color: "white",
              letterSpacing: "0.05em",
              textShadow: "0 4px 8px rgba(0,0,0,0.3)",
              fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
              textAlign: "center",
              width: "100%",
              margin: "0 auto"
            }}
          >
            {isResting ? fmtTime(restTimeLeft) : time}
          </div>
          
          {/* Status Indicator */}
          <div style={{
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: statusColor,
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            {statusText}
          </div>
          
          {/* Round Progress Beads */}
          {round > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                fontSize: '0.875rem',
                color: '#f9a8d4',
                textAlign: 'center'
              }}>
                Round {round} of {totalRounds}
              </div>
              {/* Bead Indicator */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {Array.from({ length: totalRounds }).map((_, index) => (
                  <div
                    key={index}
                    style={{
                      width: '0.75rem',
                      height: '0.75rem',
                      borderRadius: '50%',
                      transition: 'background-color 0.3s',
                      backgroundColor: index < round ? '#f9a8d4' : 'rgba(255,255,255,0.2)',
                      border: index < round ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.4)'
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Multi-select emphasis with FORCED highlighting
  function toggleEmphasis(k: EmphasisKey) {
    setSelectedEmphases((prev) => ({
      ...prev,
      [k]: !prev[k]
    }));
  }

  // --- NEW: Conditional rendering based on page state ---
  if (page === 'editor') {
    // pass persistTechniques so editor updates are stored and versioned
    return <TechniqueEditor techniques={techniques} setTechniques={persistTechniques} onBack={() => setPage('timer')} />;
  }
  if (page === 'logs') {
    return <WorkoutLogs onBack={() => setPage('timer')} />;
  }
  
  // Continue to main timer UI
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        
        body {
          background: linear-gradient(135deg, #831843 0%, #581c87 50%, #155e75 100%);
          background-attachment: fixed;
        }

        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none !important;
          margin: 0 !important;
          display: none !important;
        }
        input[type=number] {
          -moz-appearance: textfield !important;
        }

        /* --- MOBILE RESPONSIVENESS --- */
        @media (max-width: 768px) {
          .main-container {
            padding: 1rem !important;
          }
          .header-title {
            font-size: 1.75rem !important;
          }
          .main-timer {
            font-size: 5rem !important; /* Smaller timer on mobile */
          }
          .difficulty-grid {
            grid-template-columns: 1fr !important; /* Stack difficulty buttons */
          }
          .emphasis-grid {
            grid-template-columns: 1fr !important; /* Stack style buttons */
          }
        }
      `}</style>

      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#1e0b30', // Darker, more solid background
        backdropFilter: 'blur(10px)',
        padding: '1rem 2rem',
        borderBottom: '1px solid rgba(236, 72, 153, 0.3)', // Thematic border color
        textAlign: 'center'
      }}>
        <h1 className="header-title" style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '2.5rem',
          fontWeight: 'normal',
          color: 'white',
          letterSpacing: '0.1em',
          margin: 0,
          textShadow: '0 2px 8px rgba(236, 72, 153, 0.6)' // More prominent shadow
        }}>
          Nak Muay Shot Caller
        </h1>
      </header>

      <div className="main-container" style={{
        minHeight: '100vh',
        color: '#fdf2f8',
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem'
      }}>
        <div className="content-panel" style={{
          maxWidth: '64rem',
          margin: '0 auto',
          padding: '2rem 0'
        }}>
          
          {/* --- REVISED: Top Control Area --- */}
          <div style={{ minHeight: (running || hasSelectedEmphasis) ? '220px' : '0', transition: 'min-height 0.3s ease-in-out' }}>
            {/* Case 1: Session is RUNNING */}
            {running && (
              <>
                <StatusTimer 
                  time={fmtTime(timeLeft)} 
                  round={currentRound} 
                  totalRounds={roundsCount}
                  status={getStatus()}
                />
                <section style={{
                  maxWidth: '32rem',
                  margin: '-2rem auto 2rem auto',
                  minHeight: '4rem'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '1rem'
                  }}>
                    {/* Pause and Stop buttons */}
                    <button
                      onClick={pauseSession}
                      style={{
                        all: 'unset',
                        boxSizing: 'border-box',
                        position: 'relative',
                        padding: '1.25rem 1rem',
                        borderRadius: '1rem',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                        color: 'white',
                        minHeight: '4rem',
                        minWidth: '6rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem',
                        userSelect: 'none'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                    >
                      {paused ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      )}
                      <span style={{ fontSize: '0.875rem', lineHeight: 1 }}>{paused ? 'Resume' : 'Pause'}</span>
                    </button>

                    <button
                      onClick={stopSession}
                      style={{
                        all: 'unset',
                        boxSizing: 'border-box',
                        position: 'relative',
                        padding: '1.25rem 1rem',
                        borderRadius: '1rem',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, #ef4444 0%, #ec4899 100%)',
                        color: 'white',
                        minHeight: '4rem',
                        minWidth: '6rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem',
                        userSelect: 'none'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
                      <span style={{ fontSize: '0.875rem', lineHeight: 1 }}>Stop</span>
                    </button>
                  </div>
                </section>
              </>
            )}

            {/* Case 2: Session NOT running, but style IS selected -> Show Start Button */}
            {!running && hasSelectedEmphasis && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '2rem' }}>
                <button
                  onClick={startSession}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    position: 'relative',
                    padding: '2rem 4rem',
                    borderRadius: '1.5rem',
                    fontWeight: 'bold',
                    fontSize: '2rem',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)',
                    color: 'white',
                    minHeight: '6rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1.5rem',
                    userSelect: 'none',
                    minWidth: '22rem',
                    boxShadow: '0 10px 25px rgba(34, 197, 94, 0.3), 0 4px 10px rgba(59, 130, 246, 0.2)'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span style={{ lineHeight: 1 }}>Start</span>
                </button>
              </div>
            )}
          </div>

          {/* Settings Container */}
          <div style={{
            transition: 'all 0.4s ease-in-out',
            opacity: running ? 0.4 : 1,
            filter: running ? 'blur(3px)' : 'none',
            pointerEvents: running ? 'none' : 'auto'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
              
              {/* --- STEP 1: Always Visible --- */}
              <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: 'white',
                    marginBottom: '1rem',
                    margin: '0 0 1rem 0'
                  }}>
                    Choose Your Fighting Style
                  </h2>
                  <p style={{
                    color: '#f9a8d4',
                    fontSize: '0.875rem',
                    margin: 0
                  }}>
                    Select one or more styles to focus your training
                  </p>
                </div>
                
                <div className="emphasis-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  maxWidth: '60rem',
                  margin: '0 auto'
                }}>
                  {EMPHASIS.map((style) => {
                    const isSelected = selectedEmphases[style.key];
                    return (
                      <button
                        key={style.key}
                        type="button"
                        onClick={() => toggleEmphasis(style.key)}
                        style={{
                          position: 'relative',
                          padding: '1.5rem' // Reduced padding
                          ,
                          borderRadius: '1rem',
                          border: isSelected ? '2px solid #60a5fa' : '2px solid rgba(255,255,255,0.2)',
                          minHeight: '140px', // Reduced height
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          backgroundColor: isSelected ? '#2563eb' : 'rgba(255,255,255,0.05)',
                          color: 'white',
                          boxShadow: isSelected ? '0 10px 25px rgba(37, 99, 235, 0.25)' : 'none',
                          transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                          }
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '1rem',
                          right: '1rem',
                          width: '1.5rem',
                          height: '1.5rem',
                          borderRadius: '50%',
                          border: isSelected ? '2px solid white' : '2px solid rgba(255,255,255,0.4)',
                          backgroundColor: isSelected ? 'white' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isSelected && (
                            <div style={{
                              width: '0.75rem',
                              height: '0.75rem',
                              backgroundColor: '#2563eb',
                              borderRadius: '50%'
                            }} />
                          )}
                        </div>

                        <div style={{ paddingRight: '2rem' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            marginBottom: '1rem'
                          }}>
                            <span style={{ fontSize: '1.5rem' }}>{style.icon}</span>
                            <h3 style={{
                              fontSize: '1.125rem', // Reduced font size
                              fontWeight: 'bold',
                              margin: 0
                            }}>
                              {style.label}
                            </h3>
                          </div>
                          <p style={{
                            fontSize: '0.875rem',
                            color: isSelected ? '#bfdbfe' : '#f9a8d4',
                            margin: 0,
                            lineHeight: '1.4'
                          }}>
                            {style.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section style={{
                maxWidth: '48rem',
                margin: '0 auto', // Removed negative margin
                display: 'flex',
                justifyContent: 'center',
                gap: '2rem',
                flexWrap: 'wrap'
              }}>
                {/* Number of Rounds */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: 'bold',
                    color: 'white',
                    textAlign: 'center',
                    margin: 0
                  }}>
                    Number of Rounds
                  </h3>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    padding: '1rem 2rem',
                    borderRadius: '1rem',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}>
                    <button
                      type="button"
                      onClick={() => setRoundsCount(Math.max(1, roundsCount - 1))}
                      style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '50%',
                        border: '2px solid #60a5fa',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      −
                    </button>
                    <div style={{
                      minWidth: '4rem',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        color: 'white'
                      }}>
                        {roundsCount}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#f9a8d4',
                        marginTop: '0.25rem'
                      }}>
                        rounds
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRoundsCount(Math.min(20, roundsCount + 1))}
                      style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '50%',
                        border: '2px solid #60a5fa',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                {/* Round Length */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: 'bold',
                    color: 'white',
                    textAlign: 'center',
                    margin: 0
                  }}>
                    Round Length
                  </h3>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    padding: '1rem 2rem',
                    borderRadius: '1rem',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}>
                    <input
                      type="number"
                      step={0.25}
                      min={0.5}
                      max={30}
                      value={roundMin}
                      onChange={(e) => setRoundMin(Math.max(0.25, parseFloat(e.target.value || "3")))}
                      style={{
                        width: '4rem',
                        padding: '0.75rem 0',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'white',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        fontSize: '2rem'
                      }}
                    />
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#f9a8d4',
                    }}>
                      minutes
                    </div>
                  </div>
                </div>
              </section>

              {/* --- STEP 2: Conditionally Visible --- */}
              {hasSelectedEmphasis && (
                <>
                  {/* Timer and Controls - REMOVED FROM HERE */}
                  
                  {/* Difficulty Level */}
                  <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: 'bold',
                      color: 'white',
                      textAlign: 'center',
                      margin: 0
                    }}>
                      Difficulty Level
                    </h3>
                    {/* difficulty controls — responsive grid */}
                    <div className="difficulty-controls">
                      <button
                        className={`difficulty-btn ${difficulty === 'easy' ? 'active' : ''}`}
                        onClick={() => setDifficulty('easy')}
                        aria-pressed={difficulty === 'easy'}
                      >
                        Easy
                      </button>
                      <button
                        className={`difficulty-btn ${difficulty === 'medium' ? 'active' : ''}`}
                        onClick={() => setDifficulty('medium')}
                        aria-pressed={difficulty === 'medium'}
                      >
                        Medium
                      </button>
                      <button
                        className={`difficulty-btn ${difficulty === 'hard' ? 'active' : ''}`}
                        onClick={() => setDifficulty('hard')}
                        aria-pressed={difficulty === 'hard'}
                      >
                        Hard
                      </button>
                    </div>
                  </section>

                  {/* Conditional Calisthenics Section - REVISED to a toggle switch */}
                  <section style={{
                    maxWidth: '48rem',
                    margin: '0 auto',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#f9a8d4',
                      userSelect: 'none'
                    }}>
                      <span>Add Calisthenics</span>
                      <div
                        onClick={() => setAddCalisthenics(!addCalisthenics)}
                        style={{
                          position: 'relative',
                          width: '3.5rem',
                          height: '1.75rem',
                          backgroundColor: addCalisthenics ? '#3b82f6' : 'rgba(255,255,255,0.2)',
                          borderRadius: '9999px',
                          transition: 'background-color 0.2s ease-in-out',
                          border: '1px solid rgba(255,255,255,0.3)'
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '2px',
                          left: addCalisthenics ? 'calc(100% - 1.5rem - 2px)' : '2px',
                          width: '1.5rem',
                          height: '1.5rem',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: 'left 0.2s ease-in-out',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }} />
                      </div>
                    </label>
                  </section>

                  {/* Advanced Settings */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        width: '100%',
                        padding: '1rem 2rem',
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: '#f9a8d4',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        maxWidth: '20rem',
                        margin: '0 auto'
                      }}
                    >
                      <span style={{ fontSize: '1.25rem' }}>⚙️</span>
                      <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Settings</span>
                      <span style={{
                        transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        fontSize: '0.875rem'
                      }}>
                        ▼
                      </span>
                    </button>

                    {showAdvanced && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        padding: '2rem',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: '1rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                        maxWidth: '32rem',
                        margin: '0 auto'
                      }}>
                        {voices.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <label style={{
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              color: '#f9a8d4',
                              textAlign: 'center'
                            }}>
                              Voice Selection ({voices.length} voices available)
                            </label>
                            <select
                              value={voice?.name || ""}
                              onChange={(e) => setVoice(voices.find((v) => v.name === e.target.value) || null)}
                              style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '0.5rem',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '0.875rem'
                              }}
                            >
                              <option value="" style={{ color: 'black' }}>Default voice</option>
                              {voices.map((v) => (
                                <option key={v.name} value={v.name} style={{ color: 'black' }}>{v.name} ({v.lang})</option>
                              ))}
                            </select>
                            
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'center' }}>
                              <label style={{ color: '#f9a8d4', fontWeight: 600, fontSize: '0.875rem' }}>
                                Voice speed: <strong>{voiceSpeed.toFixed(2)}x</strong>
                              </label>
                              <input
                                type="range"
                                min={0.8}
                                max={2.5}
                                step={0.05}
                                value={voiceSpeed}
                                onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                                style={{ width: '160px' }}
                              />
                              <button
                                type="button"
                                onClick={testVoice}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  backgroundColor: '#3b82f6',
                                  border: '1px solid #60a5fa',
                                  borderRadius: '0.5rem',
                                  color: 'white',
                                  fontWeight: '600',
                                  fontSize: '0.875rem',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#2563eb';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#3b82f6';
                                }}
                              >
                                🔊 Test Voice
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                
                  {/* Start Button - REMOVED from here */}
                </>
              )}

            </div>
          </div>
        </div>

        <footer style={{
          textAlign: 'center',
          marginTop: '4rem',
          padding: '2rem',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{
            color: '#f9a8d4',
            fontSize: '0.875rem',
            margin: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <span>Train smart, fight smarter 🥊</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button 
                onClick={() => setPage('editor')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#bfdbfe',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Manage Techniques
              </button>
              
              <button
                onClick={() => setPage('logs')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#bfdbfe',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
                title="View workout logs"
              >
                Workout Logs
              </button>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
