import React, { useEffect } from 'react';
import { displayInAppBrowserWarning } from './utils/inAppBrowserDetector';
import { useState, useEffect as useEffectWithoutReact, useRef, useCallback } from 'react';
import INITIAL_TECHNIQUES from './techniques';
import TechniqueEditor from './TechniqueEditor';
import WorkoutLogs from './WorkoutLogs';
import './App.css';
import './difficulty.css';
import { useWakeLock } from './useWakeLock';

// Types and storage keys
type TechniquesShape = typeof INITIAL_TECHNIQUES;
type EmphasisKey = 'khao' | 'mat' | 'tae' | 'femur' | 'sok' | 'boxing' | 'newb';
type Difficulty = 'easy' | 'medium' | 'hard';
type Page = 'timer' | 'editor' | 'logs';

const TECHNIQUES_STORAGE_KEY = 'shotcaller_techniques';
const TECHNIQUES_VERSION_KEY = 'shotcaller_techniques_version';
const WORKOUTS_STORAGE_KEY = 'shotcaller_workouts';
const TECHNIQUES_VERSION = 'v3'; // Increment this version to force a reset on deployment

// Base UI config for known styles
const BASE_EMPHASIS_CONFIG: { [key: string]: { label: string; icon: string; desc: string } } = {
  newb:   { label: 'Nak Muay Newb', icon: '👶', desc: 'Start with one move at a time to learn the basics' },
  khao:   { label: 'Muay Khao',    icon: '🙏', desc: 'Close-range clinch work and knee combinations' },
  mat:    { label: 'Muay Mat',     icon: '🥊', desc: 'Heavy hands and boxing combinations' },
  tae:    { label: 'Muay Tae',     icon: '🦵', desc: 'Kicking specialist with long-range attacks' },
  femur:  { label: 'Muay Femur',   icon: '🧠', desc: 'Technical timing and defensive counters' },
  sok:    { label: 'Muay Sok',     icon: '🔪', desc: 'Vicious elbows and close-range attacks' },
  boxing: { label: 'Boxing',       icon: '👊', desc: 'Fundamental boxing combinations' }
};

const DEFAULT_REST_MINUTES = 1;

export default function App() {
  useEffect(() => {
    displayInAppBrowserWarning();
  }, []);

  // Routing
  const [page, setPage] = useState<Page>('timer');

  // Technique data (seed + persist + version)
  const [techniques, setTechniques] = useState<TechniquesShape>(() => {
    try {
      const raw = localStorage.getItem(TECHNIQUES_STORAGE_KEY);
      const ver = localStorage.getItem(TECHNIQUES_VERSION_KEY);
      if (!raw || ver !== TECHNIQUES_VERSION) {
        localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(INITIAL_TECHNIQUES));
        localStorage.setItem(TECHNIQUES_VERSION_KEY, TECHNIQUES_VERSION);
        return INITIAL_TECHNIQUES;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_TECHNIQUES;
    }
  });
  const persistTechniques = (next: TechniquesShape) => {
    try {
      setTechniques(next);
      localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(next));
      localStorage.setItem(TECHNIQUES_VERSION_KEY, TECHNIQUES_VERSION);
    } catch (err) {
      console.error('Failed to persist techniques:', err);
    }
  };
  useEffect(() => {
    try {
      localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(techniques));
    } catch (err) {
      console.error('Failed to save techniques to storage:', err);
    }
  }, [techniques]);

  // Dynamically generate emphasis list from techniques, merging with base config for icons/descriptions.
  const emphasisList = React.useMemo(() => {
    const techniqueKeys = Object.keys(techniques || {}).filter(k => k !== 'calisthenics');
    return techniqueKeys.map(key => {
      const config = BASE_EMPHASIS_CONFIG[key] || {};
      return {
        key: key as EmphasisKey, // Assume keys are valid EmphasisKeys
        label: config.label || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        icon: config.icon || '🎯',
        desc: config.desc || `Custom style: ${key}`
      };
    });
  }, [techniques]);

  // Ref to hold current techniques. This pattern ensures the ref is updated
  // on every render before any callbacks can access it, solving the stale data issue.
  const techniquesRef = useRef(techniques);
  techniquesRef.current = techniques;

  // NOTE: Remove permissive normalization/mapping and fallbacks.
  // The shot caller must only read what exists in the TechniqueEditor (the persisted `techniques` object).
  // So do NOT build fuzzy indexes or try to resolve by label/substring/etc.
  // Any lookup must be an exact key lookup against techniquesRef.current.
  // (If you later add user-created emphases, wire UI keys to technique keys explicitly.)

  // technique index: normalized -> actual technique map key
  const techniqueIndexRef = useRef<Record<string, string>>({});
  const normalizeKey = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  // Rebuild a small lookup mapping normalized forms to the real technique key.
  // This runs whenever the techniques object changes.
  // USEMEMO FIX: Build the index synchronously with `useMemo` to avoid race conditions.
  const techniqueIndex = React.useMemo(() => {
    const current = techniquesRef.current || {};
    const map: Record<string, string> = {};
    for (const candidate of Object.keys(current)) {
      const candNorm = normalizeKey(candidate);
      map[candNorm] = candidate;
      map[candidate.toLowerCase()] = candidate;
      map[candidate.replace(/[_\s-]+/g, '').toLowerCase()] = candidate;
    }
    // Also map emphasis keys (and labels) to matching technique entries when possible.
    for (const e of emphasisList) {
      const keyNorm = normalizeKey(e.key);
      if (!map[keyNorm]) {
        const labelNorm = normalizeKey(e.label);
        const found = Object.keys(current).find(c => {
          const cn = normalizeKey(c);
          return cn === labelNorm || cn.includes(labelNorm) || labelNorm.includes(cn);
        });
        if (found) map[keyNorm] = found;
      }
    }
    // Explicitly map 'newb' to 'newb_basics' if it exists, as it's a special case.
    if (Object.prototype.hasOwnProperty.call(current, 'newb_basics')) {
      map['newb'] = 'newb_basics';
    }
    return map;
  }, [techniques, emphasisList]);
  techniqueIndexRef.current = techniqueIndex;


  // Expose techniques to window for quick debugging in DevTools.
  useEffect(() => {
    try { (window as any).__techniques = techniquesRef.current; } catch { /* noop */ }
  }, [techniques]);

  // Selection and session settings
  const [selectedEmphases, setSelectedEmphases] = useState<Record<EmphasisKey, boolean>>({
    khao: false, mat: false, tae: false, femur: false, sok: false, boxing: false, newb: false
  });
  const [addCalisthenics, setAddCalisthenics] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [roundsCount, setRoundsCount] = useState(5);
  const [roundMin, setRoundMin] = useState(3);
  const [restMinutes, setRestMinutes] = useState(DEFAULT_REST_MINUTES);

  // NEW: keep a friendly text field state for the round length input
  const [roundMinInput, setRoundMinInput] = useState<string>(String(roundMin));
  useEffect(() => { setRoundMinInput(String(roundMin)); }, [roundMin]);

  // NEW: keep a friendly text field state for the rest time input
  const [restMinutesInput, setRestMinutesInput] = useState<string>(String(restMinutes));
  useEffect(() => { setRestMinutesInput(String(restMinutes)); }, [restMinutes]);

  // ADD: advanced panel toggle (was missing)
  const [showAdvanced, setShowAdvanced] = useState(false);

  // TTS controls
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const update = () => setVoices(synth.getVoices());
    update();
    synth.onvoiceschanged = update;
    return () => { (synth as any).onvoiceschanged = null; };
  }, []);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(0);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [isPreRound, setIsPreRound] = useState(false); // ADD: pre-round countdown state
  const [preRoundTimeLeft, setPreRoundTimeLeft] = useState(0); // ADD: pre-round time

  // Keep screen awake while running (not paused)
  useWakeLock({ enabled: (running && !paused) || isPreRound, log: false });

  // Refs
  const calloutRef = useRef<number | null>(null);
  const bellSoundRef = useRef<HTMLAudioElement | null>(null);
  const warningSoundRef = useRef<HTMLAudioElement | null>(null);
  const runningRef = useRef(running);
  const pausedRef = useRef(paused);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Build a phrase pool from selected emphases (strict: only read exact keys from techniques)
  const getTechniquePool = useCallback((): string[] => {
    const enabled = (Object.entries(selectedEmphases) as [EmphasisKey, boolean][])
      .filter(([, v]) => v).map(([k]) => k);

    const keysToUse = enabled.length > 0 ? enabled : ['newb'];
    const currentTechniques = techniquesRef.current || {};
    const pool: string[] = [];

    // Debugging: surface what keys we're trying to use and what keys exist.
    // eslint-disable-next-line no-console
    console.debug('getTechniquePool: keysToUse=', keysToUse, 'availableKeys=', Object.keys(currentTechniques || {}));

    // Strict resolver: ONLY accept an exact property on the persisted techniques object.
    const resolveStyle = (k: string) => {
      if (!currentTechniques) return undefined;
      // 1) exact property
      if (Object.prototype.hasOwnProperty.call(currentTechniques, k)) {
        return (currentTechniques as any)[k];
      }
      // 2) normalized lookup using the index (most robust)
      const norm = normalizeKey(k);
      const mappedKey = techniqueIndexRef.current[norm] || techniqueIndexRef.current[k] || techniqueIndexRef.current[k.toLowerCase()];
      if (mappedKey && Object.prototype.hasOwnProperty.call(currentTechniques, mappedKey)) {
        return (currentTechniques as any)[mappedKey];
      }
      // 3) try a last-resort label match against keys (not fuzzy — exact normalized equality)
      const found = Object.keys(currentTechniques).find(candidate => normalizeKey(candidate) === norm);
      if (found) return (currentTechniques as any)[found];
      return undefined;
    };

    // Recursively extract any string values or arrays of strings from an object
    const extractStrings = (node: any, out: string[]) => {
      if (!node) return;
      if (typeof node === 'string') {
        out.push(node);
        return;
      }
      if (Array.isArray(node)) {
        for (const v of node) extractStrings(v, out);
        return;
      }
      // FIX: Instead of iterating all object values, only look in expected keys.
      // This prevents the group name itself from being added to the pool.
      if (typeof node === 'object') {
        if (node.singles) extractStrings(node.singles, out);
        if (node.combos) extractStrings(node.combos, out);
        if (node.breakdown) extractStrings(node.breakdown, out); // for calisthenics
      }
    };

    for (const k of keysToUse) {
      const style = resolveStyle(k);
      if (!style) {
        // eslint-disable-next-line no-console
        console.warn('getTechniquePool: no style found for key (exact lookup only)', k);
        continue;
      }
      extractStrings(style, pool);
    }

    if (addCalisthenics) {
      // Only include calisthenics if it's explicitly present in the persisted techniques object.
      const cal = (currentTechniques as any).calisthenics;
      if (cal) extractStrings(cal, pool);
    }

    // Normalize, trim and dedupe
    const cleaned = Array.from(new Set(
      pool
        .map(s => (typeof s === 'string' ? s.trim() : String(s).trim()))
        .filter(Boolean)
    ));

    // Debug: warn if still empty so you can inspect window.__techniques in DevTools
    if (!cleaned.length) {
      // eslint-disable-next-line no-console
      console.warn('getTechniquePool: cleaned pool empty for keys', keysToUse);
    }

    return cleaned;
  }, [selectedEmphases, addCalisthenics]);

  function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // TTS guard and helpers
  const ttsGuardRef = useRef<boolean>(false);
  const stopAllNarration = useCallback(() => {
    if (calloutRef.current) {
      clearTimeout(calloutRef.current);
      calloutRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const synth = window.speechSynthesis;
        synth.pause(); synth.cancel(); synth.resume(); synth.cancel();
      } catch { /* noop */ }
    }
  }, []);

  // New, unguarded speak function for system announcements
  const speakSystem = useCallback((text: string, selectedVoice: SpeechSynthesisVoice | null, speed: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try { window.speechSynthesis.cancel(); } catch {}
    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = speed;
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback((text: string, selectedVoice: SpeechSynthesisVoice | null, speed: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (ttsGuardRef.current || !runningRef.current) return;
    try { window.speechSynthesis.cancel(); } catch {}
    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = speed;
    utterance.onstart = () => {
      if (ttsGuardRef.current || !runningRef.current) {
        try { window.speechSynthesis.cancel(); } catch {}
      }
    };
    window.speechSynthesis.speak(utterance);
  }, []);
  const speakRef = useRef(speak);
  useEffect(() => { speakRef.current = speak; }, [speak]);

  // Callout scheduler
    const stopTechniqueCallouts = useCallback(() => {
      if (calloutRef.current) {
        clearTimeout(calloutRef.current);
        calloutRef.current = null;
      }
    }, []);
  
    const startTechniqueCallouts = useCallback((initialDelay = 2000) => {
      const baseDelayMs = difficulty === 'easy' ? 4500 : difficulty === 'hard' ? 1800 : 3000;
      const callout = () => {
        if (ttsGuardRef.current || !runningRef.current) return;
        // REBUILD THE POOL ON DEMAND: This is the key fix.
        const pool = getTechniquePool();
        if (!pool.length) {
          console.warn('No techniques available for callouts — stopping callouts');
          stopTechniqueCallouts();
          return;
        }
        const phrase = pickRandom(pool);
        speakRef.current(phrase, voice, voiceSpeed);
        if (ttsGuardRef.current || !runningRef.current) return;
        const jitter = Math.floor(baseDelayMs * 0.15 * (Math.random() - 0.5));
        const nextDelayMs = Math.max(900, baseDelayMs + jitter);
        calloutRef.current = window.setTimeout(callout, nextDelayMs);
      };
      if (ttsGuardRef.current || !runningRef.current) return;
      calloutRef.current = window.setTimeout(callout, Math.max(0, initialDelay));
    }, [difficulty, voice, voiceSpeed, getTechniquePool, stopTechniqueCallouts]); // include stopper in deps

  // Guard TTS on state changes
    useEffect(() => {
      ttsGuardRef.current = (!running) || paused || isResting;
      if (ttsGuardRef.current) {
        stopTechniqueCallouts();
        stopAllNarration();
      }
    }, [running, paused, isResting, stopAllNarration, stopTechniqueCallouts]);
  
    // REMOVED: The useEffect for updating the ref is no longer needed and was the source of the bug.
    // useEffect(() => {
    //   techniquesRef.current = techniques
    // }, [techniques]);

    // Bell
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

    // 10-second warning sound
    const playWarningSound = useCallback(() => {
      try {
        if (!warningSoundRef.current) {
          // NOTE: Uses 'interval.mp3' from your /public directory
          warningSoundRef.current = new Audio('/interval.mp3');
          warningSoundRef.current.volume = 0.4;
        }
        warningSoundRef.current.currentTime = 0;
        void warningSoundRef.current.play();
      } catch { /* noop */ }
    }, []);
  
    // ADD: Pre-round countdown timer
    useEffect(() => {
      if (!isPreRound) return;
      if (preRoundTimeLeft <= 0) {
        // Countdown finished, start the round
        setIsPreRound(false);
        playBell();
        setTimeLeft(Math.max(1, Math.round(roundMin * 60)));
        setIsResting(false);
        setPaused(false);
        setRunning(true);
        return;
      }
      const id = window.setTimeout(() => setPreRoundTimeLeft(t => t - 1), 1000);
      return () => window.clearTimeout(id);
    }, [isPreRound, preRoundTimeLeft, playBell, roundMin]);
  
    // Start/stop callouts during active rounds
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
      return () => { stopTechniqueCallouts(); stopAllNarration(); };
    }, [stopTechniqueCallouts, stopAllNarration]);

  // Tick seconds for round/rest
  useEffect(() => {
    if (!running || paused) return;
    let id: number | null = null;
    if (!isResting) {
      id = window.setInterval(() => setTimeLeft(prev => Math.max(prev - 1, 0)), 1000) as unknown as number;
    } else {
      id = window.setInterval(() => setRestTimeLeft(prev => Math.max(prev - 1, 0)), 1000) as unknown as number;
    }
    return () => { if (id) window.clearInterval(id); };
  }, [running, paused, isResting]);

  // Transition: round -> rest or finish
  useEffect(() => {
    if (!running || paused || isResting) return;
    if (timeLeft > 0) return;
    playBell();
    stopTechniqueCallouts();
    stopAllNarration();
    if (currentRound >= roundsCount) {
      setRunning(false);
      setPaused(false);
      setIsResting(false);
      return;
    }
    setIsResting(true);
    setRestTimeLeft(Math.max(1, Math.round(restMinutes * 60)));
  }, [timeLeft, running, paused, isResting, currentRound, roundsCount, playBell, stopAllNarration, stopTechniqueCallouts, restMinutes]);

  // Transition: rest -> next round
  useEffect(() => {
    if (!running || paused || !isResting) return;

    // Play warning sound with 10 seconds left
    if (restTimeLeft === 10) {
      playWarningSound();
      speakSystem('10 seconds', voice, voiceSpeed);
    }

    if (restTimeLeft > 0) return;
    setIsResting(false);
    setCurrentRound(r => r + 1);
    setTimeLeft(Math.max(1, Math.round(roundMin * 60)));
    playBell();
  }, [restTimeLeft, running, paused, isResting, roundMin, playBell, playWarningSound, speakSystem, voice, voiceSpeed]);

  // Helpers
  const hasSelectedEmphasis = Object.values(selectedEmphases).some(Boolean);
  function getStatus(): 'ready' | 'running' | 'paused' | 'stopped' | 'resting' | 'pre-round' {
    if (isPreRound) return 'pre-round';
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

  // Voice tester
  function testVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis'in window)) return;
    try {
      // Cancel any ongoing speech to prevent overlap
      window.speechSynthesis.cancel();

      // Create and configure the utterance for the test
      const utterance = new SpeechSynthesisUtterance(`Voice test at ${voiceSpeed.toFixed(2)}x`);
      if (voice) utterance.voice = voice;
      utterance.rate = voiceSpeed;

      // Speak the test phrase
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Voice test failed:", err);
    }
  }

  // Session controls
  function startSession() {
    if (!hasSelectedEmphasis) return;
    // Validate that the selected emphases actually yield techniques
    const pool = getTechniquePool();
    if (!pool.length) {
      alert('No techniques found for the selected emphasis(es). Check the technique lists or choose a different emphasis.');
      console.warn('startSession blocked: empty technique pool for selected emphases', selectedEmphases);
      return;
    }
    try {
      const priming = new SpeechSynthesisUtterance(' ');
      priming.volume = 0;
      priming.rate = voiceSpeed;
      if (voice) priming.voice = voice;
      speechSynthesis.speak(priming);
    } catch {}
    // Start pre-round countdown instead of the session directly
    setCurrentRound(1);
    setIsPreRound(true);
    setPreRoundTimeLeft(5);
    speakSystem('Get ready', voice, voiceSpeed);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function pauseSession() {
    if (!running) return;
    const p = !paused;
    setPaused(p);
    if (p) speechSynthesis.pause(); else speechSynthesis.resume();
  }
  function stopSession() {
    speechSynthesis.cancel();
    // compute rounds completed
    let roundsCompleted = currentRound;
    if (running && !isResting && timeLeft > 0) roundsCompleted = Math.max(0, currentRound - 1);
    try { autoLogWorkout(roundsCompleted); } catch {}
    setPaused(false);
    setRunning(false);
    setCurrentRound(0);
    setTimeLeft(0);
    setIsResting(false);
    setIsPreRound(false); // ADD: ensure pre-round is reset
    setPreRoundTimeLeft(0); // ADD: ensure pre-round is reset
    stopTechniqueCallouts();
    stopAllNarration();
  }

  // Keep selectedEmphases in sync: if a selected emphasis no longer maps to any persisted technique, unselect it.
  useEffect(() => {
    setSelectedEmphases(prev => {
      const curr = techniquesRef.current || {};
      const next = { ...prev };
      for (const k of Object.keys(prev) as (keyof typeof prev)[]) {
        // if selected but no mapped technique, clear it
        if (prev[k]) {
          const exists = Object.prototype.hasOwnProperty.call(curr, k)
            || Boolean(techniqueIndexRef.current[normalizeKey(String(k))])
            || Boolean(Object.keys(curr).find(c => normalizeKey(c) === normalizeKey(String(k))));
          if (!exists) next[k] = false;
        }
      }
      return next;
    });
  }, [techniques]);

  function autoLogWorkout(roundsCompleted: number) {
    const entry = {
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      roundsPlanned: roundsCount,
      roundsCompleted,
      roundLengthMin: roundMin,
      emphases: Object.entries(selectedEmphases).filter(([, v]) => v).map(([k]) => k)
    };
    try {
      const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      localStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(arr));
    } catch (err) {
      console.error('Failed to auto-log workout:', err);
    }
  }

  // Small status/timer component
  function StatusTimer({
    time, round, totalRounds, status
  }: {
    time: string; round: number; totalRounds: number;
    status: 'ready' | 'running' | 'paused' | 'stopped' | 'resting' | 'pre-round'
  }) {
    const statusColor = {
      ready: '#4ade80', running: '#60a5fa', paused: '#fbbf24', stopped: '#9ca3af', resting: '#a5b4fc', 'pre-round': '#facc15'
    }[status];
    const statusText = {
      ready: 'Ready to Start', running: 'Training Active', paused: 'Paused', stopped: 'Session Complete', resting: 'Rest Period', 'pre-round': 'Get Ready!'
    }[status];
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 0, textAlign: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem', width: '100%' }}>
          <div className="main-timer" style={{
            fontSize: '8rem', fontWeight: 900, color: 'white', letterSpacing: '0.05em',
            textShadow: '0 4px 8px rgba(0,0,0,0.3)', fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            textAlign: 'center', width: '100%', margin: '0 auto'
          }}>
            {isResting ? fmtTime(restTimeLeft) : (isPreRound ? preRoundTimeLeft : time)}
          </div>
        </div>
        <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: statusColor, marginBottom: '1rem', textAlign: 'center' }}>
          {statusText}
        </div>
        {round > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.875rem', color: '#f9a8d4', textAlign: 'center' }}>
              Round {round} of {totalRounds}
            </div>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                justifyContent: 'center',
                // keep a tiny inner gap; outer wrapper controls final spacing
                marginBottom: '8px',
              }}
            >
              {Array.from({ length: totalRounds }).map((_, index) => (
                <div key={index} style={{
                  width: '0.75rem', height: '0.75rem', borderRadius: '50%',
                  transition: 'background-color 0.3s',
                  backgroundColor: index < round ? '#f9a8d4' : 'rgba(255,255,255,0.2)',
                  border: index < round ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.4)'
                }} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function toggleEmphasis(k: EmphasisKey) {
    // Exclusive rule: 'newb' cannot be combined with other emphases.
    setSelectedEmphases(prev => {
      const next: Record<EmphasisKey, boolean> = {
        ...prev, // Start with previous state to preserve user-added keys
        khao: false, mat: false, tae: false, femur: false, sok: false, boxing: false, newb: false
      };
      // Ensure all known keys from the dynamic list are reset
      emphasisList.forEach(e => { next[e.key] = false; });


      if (k === 'newb') {
        // If we're clicking 'newb', toggle it. If it's already on, turn it off.
        next.newb = !prev.newb;
        return next;
      } else {
        // If we're clicking something else, turn off 'newb' and toggle the clicked item.
        // Also preserve other selections.
        const currentSelections = { ...prev };
        currentSelections.newb = false; // remove newb if we are selecting something else by setting it to false

        const nextState = { ...currentSelections, newb: false };
        nextState[k] = !nextState[k];
        return nextState;
      }
    });
  }

  // Page routing
    if (page === 'editor') {
      return <TechniqueEditor techniques={techniques} setTechniques={persistTechniques as any} onBack={() => setPage('timer')} />;
    }
    if (page === 'logs') {
      return <WorkoutLogs onBack={() => setPage('timer')} />;
    }

  // Main Timer UI
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        body { background: linear-gradient(135deg, #831843 0%, #581c87 50%, #155e75 100%); background-attachment: fixed; }
        .start-button:hover {
          transform: translateY(-4px);
          box-shadow: 0 15px 30px rgba(34,197,94,0.4), 0 8px 15px rgba(59,130,246,0.3) !important;
        }
        @media (max-width: 768px) {
          .main-container { padding: 1rem !important; }
          .header-title { font-size: 1.75rem !important; }
          .main-timer { fontSize: '5rem' !important; }
          .difficulty-grid { grid-template-columns: 1fr !important; }
          .emphasis-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: '#1e0b30', backdropFilter: 'blur(10px)', padding: '1rem 2rem', borderBottom: '1px solid rgba(236,72,153,0.3)', textAlign: 'center' }}>
        <h1 className="header-title" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5rem', fontWeight: 'normal', color: 'white', letterSpacing: '0.1em', margin: 0, textShadow: '0 2px 8px rgba(236,72,153,0.6)' }}>
          Nak Muay Shot Caller
        </h1>
      </header>

      <div className="main-container" style={{ minHeight: '100vh', color: '#fdf2f8', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <div className="content-panel" style={{ maxWidth: '64rem', margin: '0 auto', padding: '2rem 0' }}>
          {/* Top area: Start/Timer/Controls */}
          <div style={{ minHeight: running || isPreRound ? '220px' : '0', transition: 'min-height 0.3s ease-in-out' }}>
            {(running || isPreRound) && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  // single, non-collapsing spacing between timer and controls
                  rowGap: 'clamp(16px, 3.2vh, 28px)',
                }}
              >
                <StatusTimer time={fmtTime(timeLeft)} round={currentRound} totalRounds={roundsCount} status={getStatus()} />
                <section
                  style={{
                    maxWidth: '32rem',
                    margin: '0 auto',
                    minHeight: '4rem',
                  }}
                >
                   <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                     <button onClick={pauseSession} style={controlButtonStyle('#f59e0b', '#f97316')}>
                      {paused ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      )}
                      <span style={{ fontSize: '0.875rem', lineHeight: 1 }}>{paused ? 'Resume' : 'Pause'}</span>
                    </button>
                    <button onClick={stopSession} style={controlButtonStyle('#ef4444', '#ec4899')}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
                      <span style={{ fontSize: '0.875rem', lineHeight: 1 }}>Stop</span>
                    </button>
                  </div>
                </section>
              </div>
            )}

            {/* START BUTTON MOVED FROM HERE */}
          </div>

          {/* Settings */}
          <div style={{
            transition: 'all 0.4s ease-in-out',
            opacity: running || isPreRound ? 0 : 1,
            transform: running || isPreRound ? 'translateY(2rem)' : 'translateY(0)',
            pointerEvents: running || isPreRound ? 'none' : 'auto'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
              {/* Step 1: Emphasis selection */}
              <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', margin: '0 0 1rem 0' }}>Choose Your Fighting Style</h2>
                  <p style={{ color: '#f9a8d4', fontSize: '0.875rem', margin: 0 }}>Select one or more styles to focus your training</p>
                </div>
                <div className="emphasis-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', maxWidth: '60rem', margin: '0 auto' }}>
                  {emphasisList.map(style => {
                    const isSelected = selectedEmphases[style.key];
                    return (
                      <button key={style.key} type="button" onClick={() => toggleEmphasis(style.key)} style={{
                        position: 'relative', padding: '1.5rem', borderRadius: '1rem',
                        border: isSelected ? '2px solid #60a5fa' : '2px solid rgba(255,255,255,0.2)',
                        minHeight: '140px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
                        backgroundColor: isSelected ? '#2563eb' : 'rgba(255,255,255,0.05)', color: 'white',
                        boxShadow: isSelected ? '0 10px 25px rgba(37,99,235,0.25)' : 'none',
                        transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                      }}>
                        <div style={{ position: 'absolute', top: '1rem', right: '1rem', width: '1.5rem', height: '1.5rem', borderRadius: '50%',
                          border: isSelected ? '2px solid white' : '2px solid rgba(255,255,255,0.4)', backgroundColor: isSelected ? 'white' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {isSelected && <div style={{ width: '0.75rem', height: '0.75rem', backgroundColor: '#2563eb', borderRadius: '50%' }} />}
                        </div>
                        <div style={{ paddingRight: '2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '1.5rem' }}>{style.icon}</span>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: 0 }}>{style.label}</h3>
                          </div>
                          <p style={{ fontSize: '0.875rem', color: isSelected ? '#bfdbfe' : '#f9a8d4', margin: 0, lineHeight: 1.4 }}>{style.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Calisthenics toggle MOVED HERE */}
              <section style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, color: '#f9a8d4', userSelect: 'none' }}>
                  <span>Add Calisthenics</span>
                  <div onClick={() => setAddCalisthenics(!addCalisthenics)} style={{
                    position: 'relative', width: '3.5rem', height: '1.75rem',
                    backgroundColor: addCalisthenics ? '#3b82f6' : 'rgba(255,255,255,0.2)', borderRadius: '9999px',
                    transition: 'background-color 0.2s ease-in-out', border: '1px solid rgba(255,255,255,0.3)'
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, left: addCalisthenics ? 'calc(100% - 1.5rem - 2px)' : 2,
                      width: '1.5rem', height: '1.5rem', backgroundColor: 'white', borderRadius: '50%',
                      transition: 'left 0.2s ease-in-out', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </label>
              </section>

              {/* Step 2: Rounds/Length/Difficulty */}
              <section style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                {/* Rounds */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', textAlign: 'center', margin: 0 }}>Number of Rounds</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.1)', padding: '1rem 2rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <button type="button" onClick={() => setRoundsCount(Math.max(1, roundsCount - 1))} style={chipButtonStyle}>−</button>
                    <div style={{ minWidth: '4rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white' }}>{roundsCount}</div>
                      <div style={{ fontSize: '0.75rem', color: '#f9a8d4', marginTop: '0.25rem' }}>rounds</div>
                    </div>
                    <button type="button" onClick={() => setRoundsCount(Math.min(20, roundsCount + 1))} style={chipButtonStyle}>+</button>
                  </div>
                </div>

                {/* Round length */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', textAlign: 'center', margin: 0 }}>Round Length</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.1)', padding: '1rem 2rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]*"
                      className="round-length-input"
                      value={roundMinInput}
                      onChange={(e) => {
                        const raw = e.target.value.replace(',', '.');
                        // Allow only digits and a single dot
                        if (/^\d*\.?\d*$/.test(raw)) {
                          setRoundMinInput(raw);
                        }
                      }}
                      onBlur={() => {
                        // Commit on blur: clamp to [0.25, 30], snap to nearest 0.25
                        let v = parseFloat(roundMinInput || '');
                        if (Number.isNaN(v)) v = roundMin;
                        v = Math.min(30, Math.max(0.25, v));
                        const stepped = Math.round(v / 0.25) * 0.25;
                        setRoundMin(stepped);
                        setRoundMinInput(String(stepped));
                      }}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#f9a8d4' }}>minutes</div>
                  </div>
                </div>

                {/* Rest Time */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', textAlign: 'center', margin: 0 }}>Rest Time</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.1)', padding: '1rem 2rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]*"
                      className="round-length-input"
                      value={restMinutesInput}
                      onChange={(e) => {
                        const raw = e.target.value.replace(',', '.');
                        if (/^\d*\.?\d*$/.test(raw)) {
                          setRestMinutesInput(raw);
                        }
                      }}
                      onBlur={() => {
                        let v = parseFloat(restMinutesInput || '');
                        if (Number.isNaN(v)) v = restMinutes;
                        v = Math.min(10, Math.max(0.25, v)); // Clamp between 15s and 10min
                        const stepped = Math.round(v / 0.25) * 0.25;
                        setRestMinutes(stepped);
                        setRestMinutesInput(String(stepped));
                      }}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#f9a8d4' }}>minutes</div>
                  </div>
                </div>
              </section>

              {/* Conditionally render Difficulty and Start button together */}
              {!running && !isPreRound && hasSelectedEmphasis && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingTop: '1rem' }}>
                  {/* Difficulty */}
                  <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', textAlign: 'center', margin: 0 }}>Difficulty Level</h3>
                    <div className="difficulty-controls">
                      <button className={`difficulty-btn ${difficulty === 'easy' ? 'active' : ''}`} onClick={() => setDifficulty('easy')} aria-pressed={difficulty === 'easy'}>Easy</button>
                      <button className={`difficulty-btn ${difficulty === 'medium' ? 'active' : ''}`} onClick={() => setDifficulty('medium')} aria-pressed={difficulty === 'medium'}>Medium</button>
                      <button className={`difficulty-btn ${difficulty === 'hard' ? 'active' : ''}`} onClick={() => setDifficulty('hard')} aria-pressed={difficulty === 'hard'}>Hard</button>
                    </div>
                  </section>

                  {/* Start Button */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <button
                      onClick={startSession}
                      className="start-button"
                      style={{
                        all: 'unset', boxSizing: 'border-box', position: 'relative', padding: '2rem 4rem', borderRadius: '1.5rem',
                        fontWeight: 'bold', fontSize: '2rem', cursor: 'pointer',
                        background: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)', color: 'white', minHeight: '6rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', userSelect: 'none',
                        minWidth: '22rem', boxShadow: '0 10px 25px rgba(34,197,94,0.3), 0 4px 10px rgba(59,130,246,0.2)',
                        transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out'
                    }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      <span style={{ lineHeight: 1 }}>Start</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Advanced */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button type="button" onClick={() => setShowAdvanced(s => !s)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                  width: '100%', padding: '1rem 2rem', fontSize: '1rem', fontWeight: 600, color: '#f9a8d4',
                  backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem',
                  cursor: 'pointer', transition: 'all 0.2s', maxWidth: '20rem', margin: '0 auto'
                }}>
                  <span style={{ fontSize: '1.25rem' }}>⚙️</span>
                  <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Settings</span>
                  <span style={{
                    transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s', fontSize: '0.875rem',
                  }}>▼</span>
                </button>
                {showAdvanced && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2rem',
                    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)',
                    maxWidth: '32rem', margin: '0 auto'
                  }}>
                    {voices.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f9a8d4', textAlign: 'center' }}>
                          Voice Selection ({voices.length} voices available)
                        </label>
                        <select
                          value={voice?.name || ''}
                          onChange={(e) => setVoice(voices.find(v => v.name === e.target.value) || null)}
                          style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem', color: 'white', fontWeight: 600, fontSize: '0.875rem' }}
                        >
                          <option value="" style={{ color: 'black' }}>Default voice</option>
                          {voices.map(v => <option key={v.name} value={v.name} style={{ color: 'black' }}>{v.name} ({v.lang})</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'center' }}>
                          <label style={{ color: '#f9a8d4', fontWeight: 600, fontSize: '0.875rem' }}>
                            Voice speed: <strong>{voiceSpeed.toFixed(2)}x</strong>
                          </label>
                          <input type="range" min={0.8} max={2.5} step={0.05} value={voiceSpeed} onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))} style={{ width: '160px' }} />
                          <button type="button" onClick={testVoice} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#3b82f6', border: '1px solid #60a5fa', borderRadius: '0.5rem', color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                            🔊 Test Voice
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* START BUTTON MOVED FROM HERE */}
            </div>
          </div>

          <footer style={{ textAlign: 'center', marginTop: '4rem', padding: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: '#f9a8d4', fontSize: '0.875rem', margin: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
              <span>Train smart, fight smarter 🥊</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button onClick={() => setPage('editor')} style={linkButtonStyle}>Manage Techniques</button>
                <button onClick={() => setPage('logs')} style={linkButtonStyle} title="View workout logs">Workout Logs</button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}

// Small styles
const linkButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#bfdbfe', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.875rem'
};

// ADD: chip button style used by +/- controls (was missing)
const chipButtonStyle: React.CSSProperties = {
  all: 'unset',
  width: '2.5rem',
  height: '2.5rem',
  display: 'grid',
  placeItems: 'center',
  borderRadius: '0.75rem',
  background: 'rgba(255,255,255,0.15)',
  border: '1px solid rgba(255,255,255,0.25)',
  color: 'white',
  fontSize: '1.25rem',
  fontWeight: 800,
  cursor: 'pointer',
  userSelect: 'none',
};

function controlButtonStyle(from: string, to: string): React.CSSProperties {
  return {
    all: 'unset', boxSizing: 'border-box', position: 'relative', padding: '1.25rem 1rem', borderRadius: '1rem',
    fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
    color: 'white', minHeight: '4rem', minWidth: '6rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', userSelect: 'none'
  };
}
