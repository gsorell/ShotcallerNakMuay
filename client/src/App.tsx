import React, { useEffect, useState, useRef, useCallback } from 'react';
import { displayInAppBrowserWarning } from './utils/inAppBrowserDetector';
import INITIAL_TECHNIQUES from './techniques';
import TechniqueEditor from './TechniqueEditor';
import WorkoutLogs from './WorkoutLogs';
import PageLayout from './PageLayout'; // Import the new layout component
import './App.css';
import './difficulty.css';
import { useWakeLock } from './useWakeLock';
import Header from './components/Header';

// REMOVE: The image imports are not needed for files in /public
/*
import iconNewb from '/assets/icon_newb.png';
import iconKhao from '/assets/icon_khao.png';
import iconMat from '/assets/icon_mat.png';
import iconTae from '/assets/icon_tae.png';
import iconFemur from '/assets/icon_femur.png';
import iconSok from '/assets/icon_sok.png';
import iconBoxing from '/assets/icon_boxing.png';
import iconTwoPiece from '/assets/icon_two_piece.png';
*/

// Types and storage keys
type TechniquesShape = typeof INITIAL_TECHNIQUES;
type EmphasisKey = 'khao' | 'mat' | 'tae' | 'femur' | 'sok' | 'boxing' | 'newb' | 'two_piece';
type Difficulty = 'easy' | 'medium' | 'hard';
type Page = 'timer' | 'editor' | 'logs';

const TECHNIQUES_STORAGE_KEY = 'shotcaller_techniques';
const TECHNIQUES_VERSION_KEY = 'shotcaller_techniques_version';
const WORKOUTS_STORAGE_KEY = 'shotcaller_workouts';
const TECHNIQUES_VERSION = 'v8'; // Increment this version to force a reset on deployment

// Base UI config for known styles
// FIX: Use absolute string paths for icons in the /public/assets directory
const BASE_EMPHASIS_CONFIG: { [key: string]: { label: string; icon: string; desc: string; iconPath: string; } } = {
  newb:   { label: 'Nak Muay Newb', icon: '👶', desc: 'Start with one move at a time to learn the basics', iconPath: '/assets/icon_newb.png' },
  khao:   { label: 'Muay Khao',    icon: '🙏', desc: 'Close-range clinch work and knee combinations', iconPath: '/assets/icon_khao.png' },
  mat:    { label: 'Muay Mat',     icon: '👊', desc: 'Blending Heavy hands with Kicks and Knees', iconPath: '/assets/icon_mat.png' },
  tae:    { label: 'Muay Tae',     icon: '🦵', desc: 'Kicking specialist with long-range attacks', iconPath: '/assets/icon_tae.png' },
  femur:  { label: 'Muay Femur',   icon: '🧠', desc: 'Technical timing and defensive counters', iconPath: '/assets/icon_femur.png' },
  sok:    { label: 'Muay Sok',     icon: '🔪', desc: 'Vicious elbows and close-range attacks', iconPath: '/assets/icon_sok.png' },
  boxing: { label: 'Boxing',       icon: '🥊', desc: 'Fundamental boxing combinations', iconPath: '/assets/icon_boxing.png' },
  two_piece: { label: 'Two-Piece Combos', icon: '⚡️', desc: 'Short, powerful 2-strike combinations', iconPath: '/assets/icon_two_piece.png' }
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
    const list = techniqueKeys.map(key => {
      const config = BASE_EMPHASIS_CONFIG[key] || {};
      return {
        key: key as EmphasisKey,
        label: config.label || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        iconPath: config.iconPath,
        emoji: config.icon || '🎯',
        desc: config.desc || `Custom style: ${key}`
      };
    });

    // Desired presentation order (from screenshot): newb, two_piece, boxing, mat, tae, khao, sok, femur
    const desiredOrder: EmphasisKey[] = ['newb', 'two_piece', 'boxing', 'mat', 'tae', 'khao', 'sok', 'femur'];
    const orderMap = new Map<string, number>(desiredOrder.map((k, i) => [k, i]));

    // Stable sort: known keys get their index, unknown keys go to the end in original order
    return list.slice().sort((a, b) => {
      const ai = orderMap.has(a.key) ? orderMap.get(a.key)! : Number.MAX_SAFE_INTEGER;
      const bi = orderMap.has(b.key) ? orderMap.get(b.key)! : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }, [techniques]);

  // Keep a mutable ref for the techniques object so callbacks can access the latest value without re-rendering.
  const techniquesRef = useRef<TechniquesShape>(techniques);
  useEffect(() => { techniquesRef.current = techniques; }, [techniques]);

  // Normalize keys for stable lookups: lowercase, convert runs of non-alphanum to underscore, trim underscores.
  const normalizeKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  // Build an index mapping normalized keys -> original keys for robust lookups.
  const techniqueIndex = React.useMemo(() => {
    const idx: Record<string, string> = {};
    Object.keys(techniques || {}).forEach(k => {
      idx[k] = k;
      idx[normalizeKey(k)] = k;
    });
    return idx;
  }, [techniques]);

  const techniqueIndexRef = useRef<Record<string, string>>(techniqueIndex);
  useEffect(() => { techniqueIndexRef.current = techniqueIndex; }, [techniqueIndex]);

  // Expose techniques to window for quick debugging in DevTools.
  useEffect(() => {
    try { (window as any).__techniques = techniquesRef.current; } catch { /* noop */ }
  }, [techniques]);

  // Selection and session settings
    const [selectedEmphases, setSelectedEmphases] = useState<Record<EmphasisKey, boolean>>({
      khao: false, mat: false, tae: false, femur: false, sok: false, boxing: false, newb: false, two_piece: false
    });
    const [addCalisthenics, setAddCalisthenics] = useState(false);
    const [difficulty, setDifficulty] = useState<Difficulty>('medium');
    const [roundsCount, setRoundsCount] = useState(5);
    const [roundMin, setRoundMin] = useState(3);
    const [restMinutes, setRestMinutes] = useState(DEFAULT_REST_MINUTES);
  
    // Toggle an emphasis on/off
    const toggleEmphasis = (k: EmphasisKey) => {
      setSelectedEmphases(prev => {
        const isTurningOn = !prev[k];
        if (k === 'newb') {
          // If turning 'newb' on, turn all others off.
          // If turning 'newb' off, just turn it off.
          const allOff: Record<EmphasisKey, boolean> = {
            khao: false, mat: false, tae: false, femur: false, sok: false, boxing: false, newb: false, two_piece: false
          };
          return { ...allOff, newb: isTurningOn };
        }
    
        // For any other key, toggle it. If turning it on, ensure 'newb' is off.
        const next = { ...prev, [k]: isTurningOn };
        if (isTurningOn) {
          next.newb = false;
        }
        return next;
      });
    };

  // NEW: keep a friendly text field state for the round length input
  const [roundMinInput, setRoundMinInput] = useState<string>(String(roundMin));
  useEffect(() => { setRoundMinInput(String(roundMin)); }, [roundMin]);

  // NEW: keep a friendly text field state for the rest time input
  const [restMinutesInput, setRestMinutesInput] = useState<string>(String(restMinutes));
  useEffect(() => { setRestMinutesInput(String(restMinutes)); }, [restMinutes]);

  // ADD: advanced panel toggle (was missing)
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ADD: subtle onboarding modal toggle
  const [showOnboardingMsg, setShowOnboardingMsg] = useState(false);

  // TTS controls
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const update = () => setVoices(synth.getVoices());
    update();
    (synth as any).onvoiceschanged = update;
    return () => { try { (synth as any).onvoiceschanged = null; } catch { /* noop */ } };
  }, []);

  // NEW: refs so changing speed/voice doesn’t restart cadence
  const voiceSpeedRef = useRef(voiceSpeed);
  useEffect(() => { voiceSpeedRef.current = voiceSpeed; }, [voiceSpeed]);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(voice);
  useEffect(() => { voiceRef.current = voice; }, [voice]);

  // NEW: ensure voice speed always defaults to 1x on mount
  useEffect(() => {
    setVoiceSpeed(1);
    voiceSpeedRef.current = 1;
  }, []);

  // REMOVED: This effect is no longer needed as voice speed is now manually controlled.
  /*
  useEffect(() => {
    if (difficulty === 'hard') {
      setVoiceSpeed(prev => (prev < 1.3 ? 1.3 : prev));
    } else {
      // default easy/medium to 1x
      setVoiceSpeed(1);
    }
  }, [difficulty]);
  */

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
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
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
        if (node.combos) extractStrings(node.combos, out); // for calisthenics
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
        // cancel any queued or active utterances
        synth.cancel();
        // clear tracked utterance
        utteranceRef.current = null;
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
    try {
      // Cancel any currently speaking utterance
      if (utteranceRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        utteranceRef.current = null;
      }
    } catch { /* noop */ }
  }, []);

  const startTechniqueCallouts = useCallback((initialDelay = 1200) => {
    // Faster fixed cadence per difficulty (calls/min) — independent of voice speed
    const cadencePerMin =
      difficulty === 'easy' ? 20 :
      difficulty === 'hard' ? 32 : 24;
    const baseDelayMs = Math.round(60000 / cadencePerMin);
    const minDelayMs = Math.round(baseDelayMs * 0.5); // tighter floor

    const scheduleNext = (delay: number) => {
      calloutRef.current = globalThis.setTimeout(doCallout, Math.max(0, delay)) as unknown as number;
    };

    const doCallout = () => {
      if (ttsGuardRef.current || !runningRef.current) return;

      const pool = getTechniquePool();
      if (!pool.length) {
        console.warn('No techniques available for callouts — stopping callouts');
        stopTechniqueCallouts();
        return;
      }

      const phrase = pickRandom(pool);

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(phrase);
        const v = voiceRef.current;
        if (v) u.voice = v;
        u.rate = voiceSpeedRef.current; // speed affects narration only
        utteranceRef.current = u;
        window.speechSynthesis.speak(u);
      }

      // Less jitter for snappier feel
      const jitter = Math.floor(baseDelayMs * 0.10 * (Math.random() - 0.5));
      const nextDelayMs = Math.max(minDelayMs, baseDelayMs + jitter);
      scheduleNext(nextDelayMs);
    };

    if (ttsGuardRef.current || !runningRef.current) return;
    scheduleNext(initialDelay);
  }, [difficulty, getTechniquePool, stopTechniqueCallouts]);

  // Guard TTS on state changes
  useEffect(() => {
    ttsGuardRef.current = (!running) || paused || isResting;
    if (ttsGuardRef.current) {
      stopTechniqueCallouts();
      stopAllNarration();
    }
  }, [running, paused, isResting, stopAllNarration, stopTechniqueCallouts]);

  // Simple Web Audio fallback chime if mp3 can't play (autoplay blocked or missing file)
  const webAudioChime = useCallback(() => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {/* noop */}
  }, []);

  // Proactively unlock audio on user gesture (Start button)
  const ensureMediaUnlocked = useCallback(async () => {
    try {
      if (!bellSoundRef.current) {
        bellSoundRef.current = new Audio('/big-bell-330719.mp3'); // ensure this file is in /public
        bellSoundRef.current.preload = 'auto';
      }
      // play muted once to satisfy autoplay policy
      const bell = bellSoundRef.current;
      const bellPrevVol = bell.volume;
      bell.volume = 0;
      bell.muted = true;
      await bell.play().catch(() => {});
      bell.pause();
      bell.currentTime = 0;
      bell.muted = false;
      bell.volume = bellPrevVol;

      if (!warningSoundRef.current) {
        warningSoundRef.current = new Audio('/interval.mp3');
        warningSoundRef.current.preload = 'auto';
      }
      const warn = warningSoundRef.current;
      const warnPrevVol = warn.volume;
      warn.volume = 0;
      warn.muted = true;
      await warn.play().catch(() => {});
      warn.pause();
      warn.currentTime = 0;
      warn.muted = false;
      warn.volume = warnPrevVol;
    } catch {/* noop */}
  }, []);

  // Bell
  const playBell = useCallback(() => {
    try {
      if (!bellSoundRef.current) {
        bellSoundRef.current = new Audio('/big-bell-330719.mp3');
        bellSoundRef.current.preload = 'auto';
        bellSoundRef.current.volume = 0.5;
      }
      bellSoundRef.current.currentTime = 0;
      const p = bellSoundRef.current.play();
      if (p && typeof p.then === 'function') {
        p.catch(() => { webAudioChime(); });
      }
    } catch {
      webAudioChime();
    }
  }, [webAudioChime]);

  // 10-second warning sound
  const playWarningSound = useCallback(() => {
    try {
      if (!warningSoundRef.current) {
        warningSoundRef.current = new Audio('/interval.mp3');
        warningSoundRef.current.preload = 'auto';
        warningSoundRef.current.volume = 0.4;
      }
      warningSoundRef.current.currentTime = 0;
      const p = warningSoundRef.current.play();
      if (p && typeof p.then === 'function') {
        p.catch(() => {/* no critical fallback for warning */});
      }
    } catch {/* noop */}
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
    startTechniqueCallouts(1200);
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
      // Session finished naturally, log it and stop.
      try { autoLogWorkout(roundsCount); } catch {}
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
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
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
    const pool = getTechniquePool();
    if (!pool.length) {
      alert('No techniques found for the selected emphasis(es). Check the technique lists or choose a different emphasis.');
      console.warn('startSession blocked: empty technique pool for selected emphases', selectedEmphases);
      return;
    }

    // Unlock audio while we still have a user gesture
    void ensureMediaUnlocked();

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
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (p) window.speechSynthesis.pause(); else window.speechSynthesis.resume();
      } catch { /* noop */ }
    }
  }
  function stopSession() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    }
    // compute rounds completed
    let roundsCompleted = 0;
    if (currentRound > 0) {
      // If we are in a rest period, the previous round was completed.
      // If we are in an active round, the previous round was also the last one completed.
      // The currentRound state is always 1 ahead of the last completed round.
      roundsCompleted = isResting ? currentRound : Math.max(0, currentRound - 1);
    }
    // If the session finished naturally, currentRound might be > roundsCount. Clamp it.
    if (!running && currentRound > roundsCount) {
      roundsCompleted = roundsCount;
    }

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
      difficulty, // <-- include difficulty level in the saved log
      emphases: Object.entries(selectedEmphases)
        .filter(([, v]) => v)
        .map(([k]) => {
          const found = emphasisList.find(e => e.key === (k as EmphasisKey));
          return found ? found.label : k;
        })
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

  // ADD: missing shared inline style helpers (fixes many "Cannot find name" TS errors)
  const controlButtonStyle = (bg: string, border = bg): React.CSSProperties => ({
    all: 'unset',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.65rem 0.9rem',
    borderRadius: '0.75rem',
    cursor: 'pointer',
    fontWeight: 700,
    color: 'white',
    background: `linear-gradient(180deg, ${bg} 0%, ${border} 100%)`,
    border: `1px solid ${border}`,
    boxShadow: '0 6px 18px rgba(0,0,0,0.18)'
  });

  const linkButtonStyle: React.CSSProperties = {
    all: 'unset',
    cursor: 'pointer',
    color: '#f9a8d4',
    padding: '0.5rem 0.75rem',
    borderRadius: 8,
    border: '1px solid transparent',
    fontWeight: 700,
    background: 'transparent',
    textAlign: 'center'
  };

  const chipButtonStyle: React.CSSProperties = {
    all: 'unset',
    cursor: 'pointer',
    width: '2.25rem',
    height: '2.25rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '0.5rem',
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: 'white',
    fontSize: '1.25rem',
    fontWeight: 700
  };

  // Image helper: tries several asset filenames/extensions then falls back to emoji
  const ImageWithFallback: React.FC<{
    srcPath?: string;
    alt: string;
    emoji: string;
    style?: React.CSSProperties;
    className?: string;
  }> = ({ srcPath, alt, emoji, style, className }) => {
    // FIX: Simplify state. Only use state to track loading errors.
    const [error, setError] = useState(false);
  
    // FIX: Reset error state if the image source path changes.
    useEffect(() => {
      setError(false);
    }, [srcPath]);
  
    // If there's no path or an error occurred, show the emoji.
    if (!srcPath || error) {
      return <span style={{ display: 'inline-block', fontSize: 28, ...style }}>{emoji}</span>;
    }
  
    return (
      <img
        src={srcPath}
        alt={alt}
        className={className}
        style={style}
        // When an error occurs (e.g., 404 Not Found), set the error state to true.
        onError={() => {
          console.debug('ImageWithFallback load failed for', srcPath);
          setError(true);
        }}
      />
    );
  };

  // Main Timer UI
  // Add this helper right before the return
  const isActive = running || isPreRound;

  // New: Extracted onboarding modal to avoid JSX bracket/paren issues
  const OnboardingModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    if (!open) return null;
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 60,
        padding: '1rem',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <div style={{
          maxWidth: '40rem',
          width: 'calc(100% - 2rem)',
          padding: '1.25rem 1.5rem',
          borderRadius: '0.75rem',
          background: '#0f172a',
          color: 'white',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Training Philosophy</h3>
            <button onClick={onClose} style={{ ...linkButtonStyle }}>Close</button>
          </div>

          <p style={{ color: '#f9a8d4', margin: '0.5rem 0' }}>
            Turn your shadowboxing and bagwork into a guided session with spoken techniques and timed rounds. Focus on reaction and flow — just like a real trainer
            the app calls the strikes so you learn to respond automatically.
          </p>
          <p style={{ color: '#f9a8d4', margin: '0.25rem 0 0 0' }}>
            Pick 1 or more emphases, set a difficulty level, and get started!
          </p>
          <p style={{ color: '#f9a8d4', margin: '0.25rem 0 0 0' }}>---</p>
          <p style={{ color: '#f9a8d4', margin: '0.25rem 0 0 0' }}>
            Want to customize your own workout? Modify existing sets or create your own by maintaining groups, techniques, and combinations in the Technique Editor.
          </p>

          <div style={{ marginTop: '0.75rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#f9a8d4' }}>Glossary</h4>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#f9a8d4', fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#fff', width: '28%', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Technique</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#f3e8ff', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Jab (1)', 'A straight punch with the lead hand, used to gauge distance and set up other strikes.'],
                    ['Cross (2)', 'A straight punch with the rear hand, thrown across the body for maximum power.'],
                    ['Hook (3, 4)', 'A curved punch thrown with either hand, typically targeting the side of the opponent\'s head or body.'],
                    ['Uppercut (5, 6)', 'A vertical punch thrown with either hand, traveling upward to target the opponent\'s chin or solar plexus.'],
                    ['Elbow Strike (Sok)', 'A powerful close-range strike unique to Muay Thai. Elbows can be thrown horizontally, diagonally, vertically, or straight down and are often used when the opponent is in clinching range.'],
                    ['Knee Strike (Khao)', 'A strike with the knee, often used in the clinch but can also be thrown from a distance. Knee strikes are a hallmark of Muay Thai and are very effective at close range.'],
                    ['Roundhouse Kick (Tae Wiang)', 'The most common and powerful kick in Muay Thai, thrown with the shin. It can target the legs (low kick), body (mid kick), or head (high kick).'],
                    ['Switch Kick', 'A variation of the roundhouse kick, where the fighter switches stance before delivering the kick.'],
                    ['Teep (Push Kick)', 'A straight push kick used to maintain distance, disrupt rhythm, or knock an opponent off balance.'],
                    ['Guard', 'The basic defensive stance, with hands high to protect the head.'],
                    ['Clinch (Pam)', 'A grappling range where fighters hold onto each other; used for knees, elbows and sweeps.'],
                    ['Block (Bang)', 'Using the shin, arms, or gloves to absorb or deflect an incoming strike.'],
                    ['Parry', 'Using a hand to deflect a punch or kick to the side.'],
                    ['Slip', 'Moving the head to the side to avoid a straight punch.'],
                    ['Oley', 'A strategic, often evasive, defensive technique to establish an angle'],
                    ['Roll (or "Shoulder Roll")', 'Ducking the head and using the shoulder to block a hook, allowing the punch to roll off the shoulder.'],
                    ['Check', 'Lifting the shin to block an incoming roundhouse kick to the leg or body.']
                  ].map(([term, desc]) => (
                    <tr key={term}>
                      <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top', fontWeight: 700 }}>{term}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <React.Fragment>
      {/* FIX: Move the modal to the top level to avoid JSX nesting issues and CSS conflicts. */}
      <OnboardingModal open={showOnboardingMsg} onClose={() => setShowOnboardingMsg(false)} />

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
          .main-timer { font-size: 5rem !important; }
          .difficulty-grid { grid-template-columns: 1fr !important; }
          .emphasis-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Header />

      {/* Wrapper for background and content */}
      <div style={{ position: 'relative', zIndex: 0 }}>
        {/* Fixed Background Image */}
        <div style={{ position: 'fixed', inset: 0, zIndex: -1 }}>
          <picture>
            <source media="(min-width:1200px)" srcSet="/assets/hero_desktop.png" />
            <source media="(min-width:600px)" srcSet="/assets/hero_tablet.png" />
            <img src="/assets/hero_mobile.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </picture>
          <img src="/assets/texture_overlay.png" alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'overlay', opacity: 0.12, pointerEvents: 'none' }} />
        </div>

        {/* Main content container */}
        <main
          className="main-container"
          style={{
            // FIX: Avoid forcing full viewport height while timer is active
            minHeight: isActive ? 'auto' : '100vh',
            color: '#fdf2f8',
            fontFamily: 'system-ui, sans-serif',
            padding: '2rem'
          }}
        >
          <div className="content-panel" style={{ maxWidth: '64rem', margin: '0 auto', padding: '2rem 0' }}>
            {/* Render Workout Logs page */}
            {page === 'logs' && (
              <WorkoutLogs onBack={() => setPage('timer')} />
            )}

            {/* Render timer/settings only when not on logs page */}
            {page !== 'logs' && (
              <>
                {/* Top area: Start/Timer/Controls */}
                <div style={{ minHeight: running || isPreRound ? '220px' : '0', transition: 'min-height 0.3s ease-in-out' }}>
                  {(running || isPreRound) && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
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

                      {/* NEW: Show selected emphasis icons during the session */}
                      {emphasisList.some(e => selectedEmphases[e.key]) && (
                        <section aria-label="Selected styles"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginTop: '0.25rem',
                            padding: '0 0.75rem',
                            width: '100%',
                          }}
                        >
                          <div style={{ fontSize: '0.875rem', color: '#f9a8d4', fontWeight: 700 }}>
                            Selected Styles
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              maxWidth: '56rem',
                            }}
                          >
                            {emphasisList.filter(e => selectedEmphases[e.key]).map(e => (
                              <div key={e.key}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  padding: '0.4rem 0.6rem',
                                  borderRadius: '9999px',
                                  background: 'rgba(0,0,0,0.25)',
                                  border: '1px solid rgba(255,255,255,0.18)',
                                  color: 'white',
                                }}
                                title={e.desc}
                              >
                                <ImageWithFallback
                                  srcPath={e.iconPath}
                                  alt={e.label}
                                  emoji={e.emoji}
                                  style={{ width: 20, height: 20, borderRadius: 6, objectFit: 'cover' }}
                                />
                                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{e.label}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </div>

                {/* Settings */}
                {!isActive && (
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                      {/* Step 1: Emphasis selection */}
                      <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{ textAlign: 'center' }}>
                          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', margin: '0 0 1rem 0' }}>Choose Your Fighting Style</h2>
                          <p style={{ color: '#f9a8d4', fontSize: '0.875rem', margin: 0 }}>Transform your solo training with a guided program that calls out strikes and combinations.</p>
                          <p style={{ color: '#f9a8d4', fontSize: '0.875rem', margin: 0 }}>Select one or more styles to get started.</p>
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
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          {/* replaced img + emoji fallback with ImageWithFallback */}
                          <ImageWithFallback
                            srcPath={style.iconPath}
                            alt={style.label}
                            emoji={style.emoji}
                            style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', display: 'inline-block' }}
                          />
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>{style.label}</h3>
                        </div>
                        {style.desc && <p style={{ color: '#f9a8d4', margin: 0, fontSize: '0.875rem' }}>{style.desc}</p>}
                      </div>
                      {/* REMOVED: "Select" / "Selected" text indicator */}
                    </div>
                  </button>
                            );
                          })}

                        </div>

                        {/* Manage Techniques shortcut */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem' }}>
                          <button onClick={() => setPage('editor')} style={{ ...linkButtonStyle, padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem' }}>
                            Manage Techniques
                          </button>
                        </div>
                      </section>

                      {/* Calisthenics toggle */}
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

                      {/* Step 2: Rounds/Length/Rest */}
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

                      {/* Difficulty */}
                      {hasSelectedEmphasis && (
                        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', textAlign: 'center', margin: 0 }}>Difficulty Level</h3>
                          <div className="difficulty-controls">
                            <button className={`difficulty-btn ${difficulty === 'easy' ? 'active' : ''}`} onClick={() => setDifficulty('easy')} aria-pressed={difficulty === 'easy'}>Easy</button>
                            <button className={`difficulty-btn ${difficulty === 'medium' ? 'active' : ''}`} onClick={() => setDifficulty('medium')} aria-pressed={difficulty === 'medium'}>Medium</button>
                            <button className={`difficulty-btn ${difficulty === 'hard' ? 'active' : ''}`} onClick={() => setDifficulty('hard')} aria-pressed={difficulty === 'hard'}>Hard</button>
                          </div>
                        </section>
                      )}

                      {/* Advanced Settings: Voice Speed and Selection */}
                      <section style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'stretch' }}>
                        <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ ...linkButtonStyle, color: '#f9a8d4', fontSize: '0.875rem' }}>
                          {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                        </button>
                        {showAdvanced && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'stretch', background: 'rgba(0,0,0,0.1)', padding: '1.5rem', borderRadius: '1rem', width: '100%' }}>
                            {/* Voice Speed Slider */}
                            <div style={{ width: '100%', maxWidth: '24rem' }}>
                              <label htmlFor="voice-speed" style={{ display: 'block', color: 'white', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>
                                Voice Speed: {voiceSpeed.toFixed(2)}x
                              </label>
                              <input
                                id="voice-speed"
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.05"
                                value={voiceSpeed}
                                onChange={e => setVoiceSpeed(parseFloat(e.target.value))}
                                style={{ width: '100%' }}
                              />
                            </div>
                            {/* Voice Selection Dropdown */}
                            <div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', minWidth: 0 }}>
                              <div style={{ flex: '1 1 16rem', width: '100%', maxWidth: '24rem', minWidth: 0 }}>
                                <select
                                  value={voice?.name || ''}
                                  onChange={e => setVoice(voices.find(v => v.name === e.target.value) || null)}
                                  style={{
                                    background: 'rgba(0,0,0,0.3)',
                                    color: 'white',
                                    padding: '0.5rem',
                                    borderRadius: '0.375rem',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    width: '100%',
                                    maxWidth: '100%',
                                    minWidth: 0,                 // key: allow shrinking
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                                </select>
                              </div>
                              <button onClick={testVoice} style={{ ...linkButtonStyle, background: 'rgba(255,255,255,0.1)', borderRadius: '0.375rem' }}>Test Voice</button>
                            </div>
                          </div>
                        )}
                      </section>

                      {/* Conditionally render Difficulty and Start button together */}
                      {!running && !isPreRound && hasSelectedEmphasis && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingTop: '1rem' }}>
                          {/* Start Button */}
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              onClick={startSession}
                              className="start-button"
                              style={{
                                all: 'unset', boxSizing: 'border-box', position: 'relative', padding: '2rem 4rem', borderRadius: '1.5rem',
                                fontWeight: 'bold', fontSize: '2rem', cursor: 'pointer',
                                background: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)', color: 'white', minHeight: '6rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center' // Ensure text is centered
                              }}>
                              Start Session
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Footer stays visible on all pages */}
            <footer style={{ textAlign: 'center', marginTop: '4rem', padding: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color: '#f9a8d4', fontSize: '0.875rem', margin: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                <span>Train smart, fight smarter 🥊</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button type="button" onClick={() => setPage('logs')} style={linkButtonStyle}>Workout Logs</button>
                  <button type="button" onClick={() => setShowOnboardingMsg(true)} style={linkButtonStyle}>Help</button>
                </div>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </React.Fragment>
  );
}