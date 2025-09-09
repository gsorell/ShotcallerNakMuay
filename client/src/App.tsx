import { useState, useEffect, useRef, useCallback } from 'react';
import INITIAL_TECHNIQUES from './techniques';
import TechniqueEditor from './TechniqueEditor';
import WorkoutLogs from './WorkoutLogs';
import './App.css';
import './difficulty.css';
import { useWakeLock } from './useWakeLock';

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

// --- NEW: Standardized single strikes library ---
// Removed unused standardSingles declaration

// REVISED & EXPANDED Technique library with extensive, sensible combinations and single strikes

export default function App() {
  const [page, setPage] = useState<Page>('timer');
  const { requestWakeLock, releaseWakeLock } = useWakeLock();

  // Effect to manage the screen wake lock
  useEffect(() => {
    if (page === 'timer') {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Ensure the lock is released when the component unmounts
    return () => {
      releaseWakeLock();
    };
  }, [page, requestWakeLock, releaseWakeLock]);

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

  // Timer state
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const calloutRef = useRef<number | null>(null);
  const bellSoundRef = useRef<HTMLAudioElement | null>(null);
  const [isResting, setIsResting] = useState(false);
  const [restTimeLeft, setRestTimeLeft] = useState(0);

  // Refs to hold the current state for use in timeouts/intervals
  const runningRef = useRef(running);
  useEffect(() => { runningRef.current = running; }, [running]);
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // REVISED: Wrap speak function in useCallback to stabilize its identity
  const speak = useCallback((text: string, selectedVoice: SpeechSynthesisVoice | null, speed: number) => {
    console.log('Attempting to speak:', text);
    if ('speechSynthesis' in window && text) {
      // --- REVISED: Robust speech handling to prevent race conditions ---
      // 1. Cancel any currently speaking or pending utterances.
      speechSynthesis.cancel();

      // 2. Create the new utterance.
      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('Using voice:', selectedVoice.name);
      } else {
        console.log('No voice selected, using default');
      }
      utterance.rate = speed;
      utterance.volume = 0.8;
      
      utterance.onstart = () => console.log('Speech started:', text);
      utterance.onend = () => console.log('Speech ended:', text);
      utterance.onerror = (event) => console.error('Speech error:', event);
      
      // 3. Use a very small timeout to allow the 'cancel' command to complete before speaking.
      // Reduce delay to reduce perceived slowness for short single-shot calls.
      setTimeout(() => {
        console.log('Calling speechSynthesis.speak() after delay');
        speechSynthesis.speak(utterance);
      }, 10);
    } else {
      if (!text) console.log('Skipping empty speech text.');
      else console.error('Speech synthesis not supported in this browser');
    }
  }, []); // Empty dependency array as it has no external state dependencies

  // --- NEW: Ref to hold the latest speak function to avoid stale closures ---
  const speakRef = useRef(speak);
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  // Pre-load audio - REMOVED from here to fix autoplay issue
  
  // Voice synthesis setup
  useEffect(() => {
    function loadVoices() {
      const availableVoices = speechSynthesis.getVoices();
      console.log('Loading voices:', availableVoices.length);
      setVoices(availableVoices);
      if (availableVoices.length > 0 && !voice) {
        const englishVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
        setVoice(englishVoice);
        console.log('Selected default voice:', englishVoice?.name);
      }
    }
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []); // Removed [voice] dependency to prevent re-loading voices on selection

  // REVISED Voice callout system - MOVED UP
  const startTechniqueCallouts = useCallback((initialDelay = 3000) => {
    console.log(`Starting technique callouts with ${initialDelay}ms delay.`);
    if (calloutRef.current) clearTimeout(calloutRef.current);
    
    const selectedStyles = Object.entries(selectedEmphases)
      .filter(([_, selected]) => selected)
      .map(([key, _]) => key as EmphasisKey);
    
    if (!techniques || Object.keys(techniques).length === 0) {
      console.error("Techniques not loaded, cannot start callouts.");
      return;
    }

    // --- REVISED: Separate pools for ratio control ---
    const combosPool = selectedStyles.flatMap(style => techniques[style]?.combos || []);
    let singlesPool = selectedStyles.flatMap(style => techniques[style]?.singles || []);

    // Conditionally add calisthenics to the singles pool
    if (addCalisthenics) {
      singlesPool.push(...(techniques.calisthenics?.singles || []));
    }

    console.log('Selected styles:', selectedStyles, 'combosPool size:', combosPool.length, 'singlesPool size:', singlesPool.length);

    if (combosPool.length === 0 && singlesPool.length === 0) {
      console.log('No combinations or singles available for selected styles.');
      speakRef.current?.("Please select a style with training combinations.", voice, voiceSpeed);
      return;
    }

    function callout() {
      // Check running/paused status inside the timeout
      if (!runningRef.current || pausedRef.current) {
        console.log('Callout loop stopping: session not running or is paused.');
        return;
      }
  
      // --- REVISED: Target-based cadence system ---
      const difficultySettings = {
        easy:   { targetCalloutsPer3Min: 20 },
        medium: { targetCalloutsPer3Min: 30 },
        hard:   { targetCalloutsPer3Min: 40 }
      };

      const settings = difficultySettings[difficulty];
      // Scale target callouts based on actual round length
      const targetCallouts = Math.max(1, Math.round(settings.targetCalloutsPer3Min * (roundMin / 3)));
      const averageInterval = (roundMin * 60 * 1000) / targetCallouts;
      
      // --- REVISED: Dynamic/unpredictable single-shot probability with bounded jitter ---
      // Keep combos as the majority, but make singles less predictable and faster to speak.
      const baseSinglesProb = 0.22; // ~22% base chance for singles
      const jitter = (Math.random() - 0.5) * 0.18; // +/-9% jitter
      const singlesProb = Math.max(0.08, Math.min(0.35, baseSinglesProb + jitter));
      const isSingle = Math.random() < singlesProb;
      let calloutString = '';

      if (isSingle && singlesPool.length > 0) {
        calloutString = singlesPool[Math.floor(Math.random() * singlesPool.length)];
      } else if (combosPool.length > 0) {
        calloutString = combosPool[Math.floor(Math.random() * combosPool.length)];
      } else if (singlesPool.length > 0) { // Fallback to singles if combos are empty
        calloutString = singlesPool[Math.floor(Math.random() * singlesPool.length)];
      } else {
        console.log("No techniques to call.");
        return; // Stop if both pools are empty
      }
      
      console.log('Calling out:', calloutString);
      // --- REVISED: Use the ref to call the latest version of speak ---
      try {
        // For single strikes, speak slightly faster to match real-world cadence.
        const effectiveSpeed = isSingle ? Math.min(3, voiceSpeed * 1.35) : voiceSpeed;
        speakRef.current?.(calloutString, voice, effectiveSpeed);
      } catch (err) {
        console.error('Speak failed:', err);
      }
      
      // --- REVISED: Interval calculation with realistic variance ---
      const isCalisthenic = techniques.calisthenics.singles.includes(calloutString);
      let nextInterval;

      if (isCalisthenic) {
        nextInterval = 7000; // Fixed 7-second interval for calisthenics
        console.log(`Calisthenics exercise -> Fixed interval: ${nextInterval}ms`);
      } else {
        // Singles are quicker to throw; shorten their interval while keeping combos as the majority.
        const variance = 1 + (Math.random() - 0.5) * 0.7;
        if (isSingle) {
          // Singles: shorter interval (~35–60% of avg) to reflect faster reset
          const singleFactor = 0.45 + Math.random() * 0.25;
          nextInterval = Math.max(800, averageInterval * singleFactor * variance);
        } else {
          // Combos: around the computed average with variance
          nextInterval = Math.max(1500, averageInterval * variance);
        }
         console.log(`${difficulty} mode: Target ${targetCallouts} callouts/round. Avg interval: ${Math.round(averageInterval)}ms. This interval: ${Math.round(nextInterval)}ms`);
      }

      calloutRef.current = window.setTimeout(callout, nextInterval);
    }
    
    calloutRef.current = window.setTimeout(callout, initialDelay);
  }, [techniques, selectedEmphases, addCalisthenics, difficulty, roundMin, voice, voiceSpeed]);

  const stopTechniqueCallouts = useCallback(() => {
    console.log('Stopping technique callouts');
    if (calloutRef.current) {
      clearTimeout(calloutRef.current);
      calloutRef.current = null;
    }
  }, []);

  // Centralized effect for managing callouts based on definitive state
  useEffect(() => {
    if (running && !paused) {
      console.log('Effect: Starting callouts.');
      // Use a longer delay for the very first start, shorter for resumes.
      const isResuming = currentRound > 0 && timeLeft < roundMin * 60;
      // Do not start callouts if we are in a rest period
      if (!isResting) {
        startTechniqueCallouts(isResuming ? 2000 : 3000);
      }
    } else {
      console.log('Effect: Stopping callouts.');
      stopTechniqueCallouts();
    }
  }, [running, paused, isResting, startTechniqueCallouts, stopTechniqueCallouts, roundMin]); // REMOVED currentRound, timeLeft

  // REVISED Voice callout system - REMOVED FROM HERE

  // Timer logic with voice integration
  useEffect(() => {
    if (running && !paused && timeLeft > 0) {
      intervalRef.current = window.setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && running) {
      if (currentRound < roundsCount) {
        bellSoundRef.current?.play(); // Play bell for rest start
        setIsResting(true);
        setRestTimeLeft(60); // 1 minute rest
        // speak("Next round!", voice, voiceSpeed); // REMOVED
        // Callouts are now handled by the [running, paused] effect, no need to call here.
      } else {
        bellSoundRef.current?.play(); // Play bell for session end

        // Auto-log the completed session before resetting state
        try {
          autoLogWorkout(currentRound);
        } catch (err) {
          console.error('Auto-log on session end failed:', err);
        }

        setRunning(false);
        setCurrentRound(0);
        // speak("Training complete!", voice, voiceSpeed); // REMOVED
        // Callouts are now handled by the [running, paused] effect, no need to call here.
      }
    }
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [running, paused, timeLeft, currentRound, roundsCount]);

  // --- NEW: Effect for rest timer ---
  useEffect(() => {
    if (isResting && restTimeLeft > 0) {
      intervalRef.current = window.setTimeout(() => {
        setRestTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isResting && restTimeLeft === 0) {
      setIsResting(false);
      setCurrentRound(prev => prev + 1);
      setTimeLeft(roundMin * 60);
      bellSoundRef.current?.play(); // Play bell for next round start
    }
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [isResting, restTimeLeft, roundMin]);


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

  // REVISED: Wrap speak function in useCallback to stabilize its identity
  // MOVED UP

  // Add a test function
  function testVoice() {
    console.log('Testing voice with current settings...');
    speak("Voice test - this is a test of the speech system", voice, voiceSpeed);
  }

  // Session controls with voice integration
  function startSession() {
    if (!hasSelectedEmphasis) return;
    console.log('Starting training session');

    // Prime speech synthesis synchronously on the user gesture with an inaudible utterance.
    // This unlocks TTS in browsers without announcing anything (bell remains the audible cue).
    try {
      const primingUtterance = new SpeechSynthesisUtterance(' ');
      primingUtterance.volume = 0; // inaudible
      primingUtterance.rate = voiceSpeed;
      if (voice) primingUtterance.voice = voice;
      // Do not call cancel() here; we only want to register a speak() during the gesture.
      speechSynthesis.speak(primingUtterance);
      console.log('Speech priming utterance queued (silent).');
    } catch (err) {
      console.warn('Speech priming failed (non-fatal):', err);
    }
    
    // Create and play audio on user interaction to comply with browser policies
    if (!bellSoundRef.current) {
      // CORRECTED path to the bell sound
      bellSoundRef.current = new Audio('/big-bell-330719.mp3');
      bellSoundRef.current.volume = 0.5;
    }
    // Play and immediately pause to "unlock" audio, then reset time to play fully.
    bellSoundRef.current.play().then(() => {
      bellSoundRef.current?.pause();
      if (bellSoundRef.current) bellSoundRef.current.currentTime = 0;
      bellSoundRef.current?.play();

      // Note: do not announce "Training session started" (bell is sufficient).
      // Keep audio unlocked by playing the bell; speech was primed above during the gesture.

      // Start the session after the gesture/unlock operations
      setCurrentRound(1);
      setTimeLeft(roundMin * 60);
      setPaused(false);
      setRunning(true); // This will trigger the useEffect for callouts
    }).catch(error => {
      console.error("Audio play failed:", error);
      // Even if audio failed, still start session to allow testing in environments
      setCurrentRound(1);
      setTimeLeft(roundMin * 60);
      setPaused(false);
      setRunning(true);
    });
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
