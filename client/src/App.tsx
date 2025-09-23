import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
// import PageLayout from './PageLayout'; // (unused)
import { displayInAppBrowserWarning } from './utils/inAppBrowserDetector';
import INITIAL_TECHNIQUES from './techniques';
import TechniqueEditor from './TechniqueEditor';
import WorkoutLogs from './WorkoutLogs';
import WorkoutCompleted from './WorkoutCompleted';
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
type EmphasisKey = 'timer_only' | 'khao' | 'mat' | 'tae' | 'femur' | 'sok' | 'boxing' | 'newb' | 'two_piece' | 'southpaw';
type Difficulty = 'easy' | 'medium' | 'hard';
type Page = 'timer' | 'editor' | 'logs' | 'completed';

const TECHNIQUES_STORAGE_KEY = 'shotcaller_techniques';
const TECHNIQUES_VERSION_KEY = 'shotcaller_techniques_version';
const WORKOUTS_STORAGE_KEY = 'shotcaller_workouts';
const TECHNIQUES_VERSION = 'v20'; // Increment this version to force a reset on deployment

// Base UI config for known styles
// FIX: Use absolute string paths for icons in the /public/assets directory
const BASE_EMPHASIS_CONFIG: { [key: string]: { label: string; icon: string; desc: string; iconPath: string; } } = {
  timer_only: {
    label: 'Timer Only',
    icon: '⏱️',
    desc: 'Just a round timer — no shotcalling, no techniques.',
    iconPath: '/assets/icon.stopwatch.png'
  },
  newb:   { label: 'Nak Muay Newb', icon: '👶', desc: 'Start here with one move at a time', iconPath: '/assets/icon_newb.png' },
  khao:   { label: 'Muay Khao',    icon: '🙏', desc: 'Close-range clinch work and knee combinations', iconPath: '/assets/icon_khao.png' },
  mat:    { label: 'Muay Mat',     icon: '👊', desc: 'Blending Heavy hands with Kicks and Knees', iconPath: '/assets/icon_mat.png' },
  tae:    { label: 'Muay Tae',     icon: '🦵', desc: 'Kicking specialist with long-range attacks', iconPath: '/assets/icon_tae.png' },
  femur:  { label: 'Muay Femur',   icon: '🧠', desc: 'Technical timing and defensive counters', iconPath: '/assets/icon_femur.png' },
  sok:    { label: 'Muay Sok',     icon: '🔪', desc: 'Vicious elbows and close-range attacks', iconPath: '/assets/icon_sok.png' },
  boxing: { label: 'Boxing',       icon: '🥊', desc: 'Fundamental boxing combinations', iconPath: '/assets/icon_boxing.png' },
  two_piece: { label: 'Two-Piece Combos', icon: '⚡️', desc: 'Short, powerful 2-strike combinations', iconPath: '/assets/icon_two_piece.png' },
  southpaw: {
    label: 'Southpaw',
    icon: '🦶',
    desc: 'Left-handed stance with combos tailored for southpaw fighters',
    iconPath: '/assets/icon_southpaw.png'
  },
  // --- Custom icons for new groups ---
  meat_potatoes: {
    label: 'Meat & Potatoes',
    icon: '🥔',
    desc: 'Classic, high-percentage strikes and combos for all levels',
    iconPath: '/assets/icon_meat_potatoes.png'
  },
  buakaw: {
    label: 'Buakaws Corner',
    icon: '🥋',
    desc: 'Aggressive clinch, knees, and sweeps inspired by Buakaw',
    iconPath: '/assets/icon.buakaw.png'
  },
  low_kick_legends: {
    label: 'Low Kick Legends',
    icon: '🦵',
    desc: 'Devastating low kicks and classic Dutch-style combinations',
    iconPath: '/assets/icon_lowkicklegends.png'
  },
  elbow_arsenal: {
    label: 'Elbow Arsenal',
    icon: '💥',
    desc: 'Sharp elbow strikes and creative close-range attacks',
    iconPath: '/assets/icon.elbow arsenal.png'
  },
  muay_tech: {
    label: 'Muay Tech',
    icon: '🧠',
    desc: 'Technical timing, feints, sweeps, and counters',
    iconPath: '/assets/icon.muaytech.png'
  },
  ko_setups: {
    label: 'KO Setups',
    icon: '💣',
    desc: 'Explosive knockout setups and finishing combinations',
    iconPath: '/assets/icon.ko.png'
  }
};

const DEFAULT_REST_MINUTES = 1;

export default function App() {
  useEffect(() => {
    displayInAppBrowserWarning();
  }, []);

  // Routing
  const [page, setPage] = useState<Page>('timer');
  const [lastWorkout, setLastWorkout] = useState<any>(null);

  // Technique data (seed + persist + version)
  const [techniques, setTechniques] = useState<TechniquesShape>(() => {
    try {
      const raw = localStorage.getItem(TECHNIQUES_STORAGE_KEY);
      const ver = localStorage.getItem(TECHNIQUES_VERSION_KEY);
      let loaded = INITIAL_TECHNIQUES;
      if (!raw || ver !== TECHNIQUES_VERSION) {
        localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(INITIAL_TECHNIQUES));
        localStorage.setItem(TECHNIQUES_VERSION_KEY, TECHNIQUES_VERSION);
      } else {
        loaded = JSON.parse(raw);
      }
      // Ensure timer_only is always present
      if (!loaded.timer_only) {
        loaded.timer_only = INITIAL_TECHNIQUES.timer_only;
      }
      return loaded;
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
    // Exclude calisthenics from the tile list
    const techniqueKeys = Object.keys(techniques || {}).filter(
      k => k !== 'calisthenics'
    );

    // Core group keys in preferred order
    const CORE_ORDER: string[] = [
      'timer_only', 'newb', 'two_piece', 'boxing', 'mat', 'tae', 'khao', 'sok', 'femur', 'southpaw',
      'meat_potatoes', 'buakaw', 'low_kick_legends', 'elbow_arsenal', 'muay_tech', 'ko_setups'
    ];

    // Always include timer_only as the first tile, using INITIAL_TECHNIQUES if missing
    const timerOnlyTile = (() => {
      const key = 'timer_only';
      const config = BASE_EMPHASIS_CONFIG[key] || {};
      const technique = techniques[key] || INITIAL_TECHNIQUES[key];
      let label: string;
      if (technique?.title && typeof technique.title === 'string' && technique.title.trim()) {
        label = technique.title.trim();
      } else if (config.label) {
        label = config.label;
      } else {
        label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).replace(/\s*\(Copy\)$/i, '');
      }
      return {
        key,
        label,
        iconPath: config.iconPath || '/assets/icon_user.png',
        emoji: config.icon || '🎯',
        desc: config.desc || technique?.description || `Custom style: ${key}`
      };
    })();

    // Core groups: those present in CORE_ORDER and in techniques, EXCLUDING timer_only
    const coreGroups = CORE_ORDER
      .filter(key => key !== 'timer_only' && techniqueKeys.includes(key))
      .map(key => {
        const config = BASE_EMPHASIS_CONFIG[key] || {};
        const technique = techniques[key];
        let label: string;
        if (technique?.title && typeof technique.title === 'string' && technique.title.trim()) {
          label = technique.title.trim();
        } else if (config.label) {
          label = config.label;
        } else {
          label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).replace(/\s*\(Copy\)$/i, '');
        }
        return {
          key,
          label,
          iconPath: config.iconPath || '/assets/icon_user.png',
          emoji: config.icon || '🎯',
          desc: config.desc || technique?.description || `Custom style: ${key}`
        };
      });

    // User-created groups: not in CORE_ORDER and not calisthenics
    const userGroups = techniqueKeys
      .filter(key => !CORE_ORDER.includes(key))
      .map(key => {
        const technique = techniques[key];
        let label: string;
        if (technique?.title && typeof technique.title === 'string' && technique.title.trim()) {
          label = technique.title.trim();
        } else {
          label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).replace(/\s*\(Copy\)$/i, '');
        }
        return {
          key,
          label,
          iconPath: '/assets/icon_user.png',
          emoji: '🎯',
          desc: technique?.description || `Custom style: ${key}`
        };
      });

    // Final list: timer_only first, then core groups, then user-created groups (no calisthenics)
    return [timerOnlyTile, ...coreGroups, ...userGroups];
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
    timer_only: false,
    khao: false, mat: false, tae: false, femur: false, sok: false, boxing: false, newb: false, two_piece: false, southpaw: false
  });
  const [addCalisthenics, setAddCalisthenics] = useState(false);

  // ADD: Read in order toggle
  const [readInOrder, setReadInOrder] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [roundsCount, setRoundsCount] = useState(5);
  const [roundMin, setRoundMin] = useState(3);
  const [restMinutes, setRestMinutes] = useState(DEFAULT_REST_MINUTES);
  
  // Toggle an emphasis on/off
  const toggleEmphasis = (k: EmphasisKey) => {
    setSelectedEmphases(prev => {
      const isTurningOn = !prev[k];
      if (k === 'timer_only') {
        // If turning timer_only on, turn all others off.
        // If turning timer_only off, just turn it off.
        const allOff: Record<EmphasisKey, boolean> = {
          timer_only: false,
          khao: false, mat: false, tae: false, femur: false, sok: false, boxing: false, newb: false, two_piece: false, southpaw: false
        };
        return { ...allOff, timer_only: isTurningOn };
      }
    
      // For any other key, toggle it. If turning it on, ensure timer_only is off.
      const next = { ...prev, [k]: isTurningOn };
      if (isTurningOn) {
        next.timer_only = false;
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

  // ADD: toggle for showing all emphases
  const [showAllEmphases, setShowAllEmphases] = useState(false);

  // ADD: subtle onboarding modal toggle
  const [showOnboardingMsg, setShowOnboardingMsg] = useState(false);

  // TTS controls
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  // Live "subtitle" for the active technique/combination
  const [currentCallout, setCurrentCallout] = useState<string>('');
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
  // useEffect(() => {
  //   setVoiceSpeed(1);
  //   voiceSpeedRef.current = 1;
  // }, []);

  useEffect(() => {
    if (difficulty === 'hard') {
      setVoiceSpeed(1.3);
    } else {
      // default easy/medium to 1x
      setVoiceSpeed(1);
    }
  }, [difficulty]);

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
  const shotsCalledOutRef = useRef<number>(0); // Initialize shotsCalledOutRef
  const orderedIndexRef = useRef<number>(0); // Initialize orderedIndexRef
  const currentPoolRef = useRef<string[]>([]); // Initialize currentPoolRef
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const runningRef = useRef(running);
  const pausedRef = useRef(paused);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Build a phrase pool from selected emphases (strict: only read exact keys from techniques)
  const getTechniquePool = useCallback((): string[] => {
    if (selectedEmphases.timer_only) return [];

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
      if (typeof node === 'object') {
        // Handle singles/combos as array of {text, favorite}
        if (node.singles) {
          for (const single of node.singles) {
            if (typeof single === 'string') {
              out.push(single);
            } else if (single && typeof single.text === 'string') {
              out.push(single.text);
              // If favorited, add again for ~35% higher chance
              if (single.favorite) {
                if (Math.random() < 0.35) out.push(single.text);
              }
            }
          }
        }
        if (node.combos) {
          for (const combo of node.combos) {
            if (typeof combo === 'string') {
              out.push(combo);
            } else if (combo && typeof combo.text === 'string') {
              out.push(combo.text);
              if (combo.favorite) {
                if (Math.random() < 0.35) out.push(combo.text);
              }
            }
          }
        }
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

  // Helper to fix TTS pronunciation for ambiguous words
  function fixPronunciation(text: string): string {
    return text.replace(/\bLeft\b/gi, 'leed');
  }

  // New, unguarded speak function for system announcements
  const speakSystem = useCallback((text: string, selectedVoice: SpeechSynthesisVoice | null, speed: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try { window.speechSynthesis.cancel(); } catch {}
    const utterance = new SpeechSynthesisUtterance(fixPronunciation(text));
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = speed;
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback((text: string, selectedVoice: SpeechSynthesisVoice | null, speed: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (ttsGuardRef.current || !runningRef.current) return;
    try { window.speechSynthesis.cancel(); } catch {}
    const utterance = new SpeechSynthesisUtterance(fixPronunciation(text));
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
    // Optional: clear visible subtitle when we explicitly stop callouts
    // (Guard effect below will also clear on pause/rest/stop)
    setCurrentCallout('');
  }, []);

  const startTechniqueCallouts = useCallback((initialDelay = 1200) => {
    // Fixed cadence per difficulty (calls/min)
    const cadencePerMin =
      difficulty === 'easy' ? 26 :
      difficulty === 'hard' ? 42 : 31;
    const baseDelayMs = Math.round(60000 / cadencePerMin);
    const minDelayMs = Math.round(baseDelayMs * 0.5);

    const scheduleNext = (delay: number) => {
      if (calloutRef.current) {
        clearTimeout(calloutRef.current);
        calloutRef.current = null;
      }
      calloutRef.current = window.setTimeout(doCallout, Math.max(0, delay)) as unknown as number;
    };

    const doCallout = () => {
      if (ttsGuardRef.current || !runningRef.current) return;

      const pool = currentPoolRef.current;
      if (!pool.length) {
        console.warn('No techniques available for callouts — stopping callouts');
        stopTechniqueCallouts();
        return;
      }

      let phrase: string;
      if (readInOrder) {
        phrase = pool[orderedIndexRef.current % pool.length];
        orderedIndexRef.current += 1;
      } else {
        // Use the shuffled pool in order, looping if needed
        phrase = pool[orderedIndexRef.current % pool.length];
        orderedIndexRef.current += 1;
      }

      // Increment shotsCalledOut counter
      shotsCalledOutRef.current += 1;

      // If Web Speech is available, sync UI to the actual utterance lifecycle
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }

        const u = new SpeechSynthesisUtterance(phrase);
        const v = voiceRef.current;
        if (v) u.voice = v;
        u.rate = voiceSpeedRef.current;

        u.onstart = () => {
          if (ttsGuardRef.current || !runningRef.current) {
            try { window.speechSynthesis.cancel(); } catch { /* noop */ }
            return;
          }
          setCurrentCallout(phrase);
        };

        u.onend = () => {
          utteranceRef.current = null;
          if (ttsGuardRef.current || !runningRef.current) return;
          const jitter = Math.floor(baseDelayMs * 0.10 * (Math.random() - 0.5));
          const nextDelayMs = Math.max(minDelayMs, baseDelayMs + jitter);
          scheduleNext(nextDelayMs);
        };

        u.onerror = () => {
          utteranceRef.current = null;
          if (ttsGuardRef.current || !runningRef.current) return;
          scheduleNext(250);
        };

        utteranceRef.current = u;
        window.speechSynthesis.speak(u);
        return;
      }

      // Fallback (no TTS): update immediately and use timer cadence
      setCurrentCallout(phrase);
      const jitter = Math.floor(baseDelayMs * 0.10 * (Math.random() - 0.5));
      const nextDelayMs = Math.max(minDelayMs, baseDelayMs + jitter);
      scheduleNext(nextDelayMs);
    };

    if (ttsGuardRef.current || !runningRef.current) return;
    scheduleNext(initialDelay);
  }, [difficulty, stopTechniqueCallouts]);

  // Guard TTS on state changes
  useEffect(() => {
    ttsGuardRef.current = (!running) || paused || isResting;
    if (ttsGuardRef.current) {
      stopTechniqueCallouts();
      stopAllNarration();
      // Clear visible subtitle when we shouldn't be calling out
      setCurrentCallout('');
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
    setCurrentCallout(''); // clear subtitle at round end
    if (currentRound >= roundsCount) {
      // Session finished naturally, log it and stop.
      try { autoLogWorkout(roundsCount); } catch {}
      // NEW: Save stats and show completed page
      setLastWorkout({
        timestamp: new Date().toISOString(),
        emphases: Object.entries(selectedEmphases).filter(([, v]) => v).map(([k]) => {
          const found = emphasisList.find(e => e.key === (k as EmphasisKey));
          return found ? found.label : k;
        }),
        difficulty,
        shotsCalledOut: shotsCalledOutRef.current,
        roundsCompleted: roundsCount,
        roundsPlanned: roundsCount,
        roundLengthMin: roundMin,
      });
      setRunning(false);
      setPaused(false);
      setIsResting(false);
      setPage('completed'); // <-- show completed page
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
    // FIX: Allow "Timer Only" to start even if pool is empty
    const timerOnlySelected = selectedEmphases.timer_only && Object.values(selectedEmphases).filter(Boolean).length === 1;
    if (!pool.length && !timerOnlySelected) {
      alert('No techniques found for the selected emphasis(es). Check the technique lists or choose a different emphasis.');
      console.warn('startSession blocked: empty technique pool for selected emphases', selectedEmphases);
      return;
    }

    // Unlock audio while we still have a user gesture
    void ensureMediaUnlocked();

    // Reset pool and index for the session
    if (readInOrder) {
      currentPoolRef.current = pool;
    } else {
      currentPoolRef.current = pool.sort(() => Math.random() - 0.5);
    }
    orderedIndexRef.current = 0;

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
    setCurrentCallout(''); // clear subtitle on stop
  }

  // Scroll to top when opening Technique Editor (especially for mobile)
  useEffect(() => {
    if (page === 'editor') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [page]);

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
      difficulty, // already present
      shotsCalledOut: shotsCalledOutRef.current, // <-- add this
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
    const escHandler = React.useCallback((e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    }, [onClose]);

    React.useEffect(() => {
      if (!open) return;
      window.addEventListener('keydown', escHandler);
      return () => window.removeEventListener('keydown', escHandler);
    }, [open, escHandler]);

    if (!open) return null;

    const modal = (
      <div
        role="dialog"
        aria-modal="true"
        onClick={onClose} // click backdrop to close
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 10000, // above any running overlays
          padding: '1rem',
          overflowY: 'auto',
          pointerEvents: 'auto'
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()} // prevent backdrop close when clicking content
          style={{
            maxWidth: '40rem',
            width: 'calc(100% - 2rem)',
            padding: '1.25rem 1.5rem',
            borderRadius: '0.75rem',
            background: '#0f172a',
            color: 'white',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          }}
        >
          {/* ADD: Help icon at the top */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <img
              src="/assets/icon_help.png"
              alt="Help"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(59,130,246,0.10)'
              }}
            />
            <h3 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>How to Use Nak Muay Shot Caller</h3>
            <button onClick={onClose} style={{ ...linkButtonStyle }}>Close</button>
          </div>

          {/* REPLACED: onboarding intro text */}
          <p style={{
            color: '#f9a8d4',
            margin: '0.5rem 0 1.25rem 0',
            fontSize: '1.05rem',
            lineHeight: 1.7,
            whiteSpace: 'pre-line'
          }}>
            <span style={{ display: 'block', marginBottom: '1.1em' }}>
              <strong style={{ color: '#fdf2f8', fontWeight: 800 }}>
                Stop guessing and start training with a purpose.
              </strong> Nak Muay Shotcaller turns your shadowboxing and bagwork into dynamic, guided sessions with spoken techniques and timed rounds. Think of it as having a personal trainer right in your ear, helping you focus on reaction time and flow.
            </span>
            <span style={{ display: 'block', marginBottom: '1.1em' }}>
              <strong style={{ color: '#fdf2f8', fontWeight: 800 }}>
                This app assumes you already know the proper form for each strike.
              </strong> It does not provide feedback, so if you are unfamiliar with any of the techniques, it is highly recommended that you first learn them from a qualified coach.
            </span>
            <span style={{ display: 'block', marginBottom: '1.1em' }}>
              The on-screen text is there to help you get started and to double-check a technique if you miss a verbal cue. <strong style={{ color: '#fdf2f8', fontWeight: 800 }}>However, the goal is to train without looking at the screen</strong>, so you can keep your hands up and focus on responding to the verbal commands.
            </span>
            <span style={{ display: 'block', marginBottom: '1.1em' }}>
              This isn't a game to play on the subway -- it's a powerful tool designed to help take you to the next level -- so <strong style={{ color: '#fdf2f8', fontWeight: 800 }}>Let's Go!</strong>
            </span>
          </p>
          <div style={{
            color: '#f9a8d4',
            margin: '0.5rem 0 0.5rem 0',
            fontWeight: 700,
            fontSize: '1.08rem',
            letterSpacing: '0.01em'
          }}>
            Features:
          </div>
          <ul style={{
            color: '#f9a8d4',
            margin: '0 0 0.5rem 1.25rem',
            padding: 0,
            listStyle: 'disc inside',
            fontSize: '1rem'
          }}>
            <li style={{ marginBottom: '0.35rem', lineHeight: 1.5 }}>
              <strong style={{ color: '#fdf2f8' }}>Guided Sessions:</strong> Just pick one or more emphases and a difficulty level to get started.
            </li>
            <li style={{ lineHeight: 1.5 }}>
              <strong style={{ color: '#fdf2f8' }}>Workout Customization:</strong> Want to create your own unique session?{' '}
              <button
                style={{
                  all: 'unset',
                  color: '#f9a8d4',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontWeight: 700,
                  padding: 0,
                  margin: 0,
                  background: 'none',
                  fontSize: 'inherit',
                  border: 'none'
                }}
                onClick={() => {
                  onClose();
                  setPage('editor');
                }}
                tabIndex={0}
                aria-label="Open Technique Editor"
              >
                Use the Technique Editor
              </button>
              {' '}to modify existing sets or build new ones from scratch.
            </li>
          </ul>
          {/* END REPLACEMENT */}

          <div style={{ marginTop: '0.75rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#f9a8d4' }}>Glossary</h4>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#f9a8d4', fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Term</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#f3e8ff', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Jab (1)', 'A straight punch with the Left hand, used to gauge distance and set up other strikes.'],
                    ['Cross (2)', 'A straight punch with the Right hand, thrown across the body for maximum power.'],
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

    const target = typeof document !== 'undefined' ? document.body : null;
    if (!target) return null;
    return createPortal(modal, target);
  };

  const TechniqueEditorAny = TechniqueEditor as unknown as React.ComponentType<any>;

  return (
    <>
      {/* Onboarding Modal */}
      <OnboardingModal open={showOnboardingMsg} onClose={() => setShowOnboardingMsg(false)} />

      <style>{`
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
  body { background: linear-gradient(135deg, #831843 0%, #581c87 50%, #155e75 100%); background-attachment: fixed; }
  .main-timer {
    font-size: 8vw;
    font-weight: 900;
    color: white;
    letter-spacing: 0.05em;
    text-shadow: 0 4px 8px rgba(0,0,0,0.3);
    font-family: "system-ui, -apple-system, 'Segoe UI', sans-serif";
    text-align: center;
    width: 100%;
    margin: 0 auto;
    line-height: 1.1;
  }
  @media (max-width: 768px) {
    .main-timer { font-size: 12vw !important; }
  }
  @media (max-width: 480px) {
    .main-timer { font-size: 16vw !important; }
  }
  .hero-bg {
    position: fixed;
    inset: 0;
    z-index: -1;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  /* Responsive grid for emphasis buttons */
  .emphasis-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    max-width: 60rem;
    margin: 0 auto;
    width: 100%;
  }
  @media (max-width: 900px) {
    .emphasis-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.75rem;
    }
  }
  @media (max-width: 600px) {
    .emphasis-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
  }
  /* Make buttons and manage techniques full width on small screens */
  .emphasis-grid > button,
  .manage-techniques-btn {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    max-width: 100%;
    word-break: break-word;
  }
  @media (max-width: 600px) {
    .emphasis-grid > button,
    .manage-techniques-btn {
      padding: 1.1rem !important;
      font-size: 1rem !important;
    }
  }
  /* Prevent horizontal scroll on mobile */
  html, body, #root {
    max-width: 100vw;
    overflow-x: hidden;
  }
  @media (max-width: 600px) {
  .settings-toggle-row {
    flex-direction: column !important;
    gap: 1.25rem !important;
    align-items: stretch !important;
  }
}
`}</style>

      <Header
        onHelp={() => setShowOnboardingMsg(true)}
        onLogoClick={() => {
          setPage('timer');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <div style={{ position: 'relative', zIndex: 0 }}>
        {/* Fixed Background Image */}
        <div className="hero-bg">
          <picture>
            <source media="(min-width:1200px)" srcSet="/assets/hero_desktop.png" />
            <source media="(min-width:600px)" srcSet="/assets/hero_tablet.png" />
            <img
              src="/assets/hero_mobile.png"
              alt=""
              style={{
                width: '100vw',
                height: '100vh',
                minHeight: '100dvh', // Ensures full viewport coverage on iPad/iOS
                objectFit: 'cover'
              }}
            />
          </picture>
          <img
            src="/assets/texture_overlay.png"
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100vw',
              height: '100vh',
              minHeight: '100dvh', // Ensures overlay matches background height
              objectFit: 'cover',
              mixBlendMode: 'overlay',
              opacity: 0.12,
              pointerEvents: 'none'
            }}
          />
        </div>

        <main
          className="main-container"
          style={{
            minHeight: isActive ? 'auto' : '100vh',
            color: '#fdf2f8',
            fontFamily: 'system-ui, sans-serif',
            padding: '2rem'
          }}
        >
          {page === 'logs' ? (
            <WorkoutLogs onBack={() => setPage('timer')} emphasisList={emphasisList} />
          ) : page === 'editor' ? (
            <TechniqueEditorAny
              techniques={techniques as any}
              setTechniques={persistTechniques}
              onBack={() => setPage('timer')}
            />
          ) : page === 'completed' && lastWorkout ? (
            <WorkoutCompleted
              stats={lastWorkout}
              onRestart={() => {
                setPage('timer');
                setTimeout(() => startSession(), 0);
              }}
              onReset={() => setPage('timer')}
              onViewLog={() => setPage('logs')}
            />
          ) : (
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

                    {/* Live technique subtitle (during active rounds only) */}
                    {running && !paused && !isResting && currentCallout && (
                      <div
                        aria-live="polite"
                        style={{
                          maxWidth: '46rem',
                          textAlign: 'center',
                          fontSize: '2rem',
                          fontWeight: 800,
                          letterSpacing: '0.5px',
                          color: 'white',
                          background: 'rgba(0,0,0,0.35)',
                          border: '1px solid rgba(255,255,255,0.22)',
                          borderRadius: '0.85rem',
                          padding: '0.6rem 1rem',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                        }}
                      >
                        {currentCallout}
                      </div>
                    )}

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
                    {emphasisList.some(e => selectedEmphases[e.key as EmphasisKey]) && (
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
                          {emphasisList.filter(e => selectedEmphases[e.key as EmphasisKey]).map(e => (
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
                      <div style={{ textAlign: 'center', position: 'relative' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', margin: '0 0 1rem 0' }}>Choose Your Fighting Style</h2>
                        <p style={{ color: '#f9a8d4', fontSize: '0.875rem', margin: 0 }}>
                          Transform your solo training with guided programs that call out strikes and combinations.
                          Select one or more styles to get started.
                          <span style={{ marginLeft: 8 }}>
                            See{' '}
                            <button
                              type="button"
                              onClick={() => setShowOnboardingMsg(true)}
                              style={{
                                all: 'unset',
                                color: '#60a5fa',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: 'inherit',
                                border: 'none',
                                background: 'none',
                                padding: 0,
                                margin: 0,
                              }}
                              tabIndex={0}
                              aria-label="Open help"
                            >
                              help
                            </button>
                            .
                          </span>
                        </p>
                      </div>
                      <div style={{ position: 'relative', width: '100%', maxWidth: '60rem', margin: '0 auto' }}>
                        <div className="emphasis-grid"
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '1rem',
      maxWidth: '60rem',
      margin: '0 auto'
    }}>
    {(showAllEmphases ? emphasisList : emphasisList.slice(0, 9)).map(style => {
      const isSelected = selectedEmphases[style.key as EmphasisKey];
      return (
        <button key={style.key} type="button" onClick={() => toggleEmphasis(style.key as EmphasisKey)} style={{
          position: 'relative', padding: '1.5rem', borderRadius: '1rem',
          border: isSelected ? '2px solid #60a5fa' : '2px solid rgba(255,255,255,0.2)',
          minHeight: '140px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
          backgroundColor: isSelected ? '#2563eb' : 'rgba(255,255,255,0.05)', color: 'white',
          boxShadow: isSelected ? '0 10px 25px rgba(37,99,235,0.25)' : 'none',
          transform: isSelected ? 'scale(1.02)' : 'scale(1)'
        }} onMouseUp={e => e.currentTarget.blur()}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <ImageWithFallback
                  srcPath={style.iconPath}
                  alt={style.label}
                  emoji={style.emoji}
                  style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', display: 'inline-block' }}
                />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                  {techniques[style.key]?.title?.trim() || style.label}
                </h3>
              </div>
              {style.desc && <p style={{ color: '#f9a8d4', margin: 0, fontSize: '0.875rem' }}>{style.desc}</p>}
            </div>
          </div>
        </button>
      );
    })}
  </div>
  {emphasisList.length > 9 && (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: '1rem'
    }}>
      <button
        type="button"
        onClick={() => setShowAllEmphases(v => !v)}
        style={{
          position: 'relative',
          padding: '.75rem',
          borderRadius: '1rem',
          border: '2px solid rgba(255,255,255,0.2)',
          backgroundColor: 'rgba(255,255,255,0.05)',
          color: 'white',
          boxShadow: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontWeight: 400,
          fontSize: '1.05rem',
          transition: 'all 0.2s',
          cursor: 'pointer',
          minWidth: 0,
        }}
        tabIndex={0}
        aria-label={showAllEmphases ? 'See less styles' : 'See more styles'}
        title={showAllEmphases ? 'Show fewer styles' : 'Show more styles'}
      >
        {showAllEmphases ? 'See Less' : 'See More'}
       

       

        <span style={{
          display: 'inline-block',
          transition: 'transform 0.2s',
          fontSize: '1.1em',
          marginLeft: 2,
          transform: showAllEmphases ? 'rotate(180deg)' : 'rotate(0deg)'
        }}>
          ▼
        </span>
      </button>
    </div>
  )}

  {/* Restore Manage Techniques button here */}
  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
    <button
      onClick={() => setPage('editor')}
      className="manage-techniques-btn"
      style={{
        position: 'relative',
        padding: '1.5rem',
        borderRadius: '1rem',
        border: '2px solid rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        color: 'white',
        boxShadow: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontWeight: 400,
        fontSize: '1.05rem',
        transition: 'all 0.2s',
        cursor: 'pointer',
        minWidth: 0,
      }}
    >
      <img
        src="/assets/icon_edit.png"
        alt=""
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          objectFit: 'cover',
          marginRight: 12,
          verticalAlign: 'middle',
          background: 'rgba(255,255,255,0.04)',
        }}
        aria-hidden="true"
      />
      <span style={{
        fontWeight: 400,
        letterSpacing: '0.01em',
        color: 'white',
      }}>
        Manage Techniques
      </span>
    </button>
  </div>
                      </div>
                    </section>

                  {/* Calisthenics and Read In Order toggles */}
                  <section
                    className="settings-toggle-row"
                    style={{
                      maxWidth: '48rem',
                      margin: '0 auto',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '2.5rem',
                      flexWrap: 'wrap',
                      flexDirection: 'row',
                    }}
                  >
                    {/* Add Calisthenics */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={addCalisthenics}
                        onChange={e => setAddCalisthenics(e.target.checked)}
                        style={{ display: 'none' }}
                        aria-label="Toggle calisthenics"
                      />
                      <div
                        style={{
                          position: 'relative',
                          width: '2.5rem',
                          height: '1.25rem',
                          backgroundColor: addCalisthenics ? '#3b82f6' : 'rgba(255,255,255,0.2)',
                          borderRadius: '9999px',
                          transition: 'background-color 0.2s ease-in-out',
                          border: '1px solid rgba(255,255,255,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: addCalisthenics ? 'flex-end' : 'flex-start',
                          padding: '0.2rem',
                        }}
                      >
                        <div style={{
                          width: '1rem',
                          height: '1rem',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          transition: 'transform 0.2s',
                          transform: addCalisthenics ? 'translateX(100%)' : 'translateX(0%)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                      <span style={{ color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
                        Include Calisthenics
                      </span>
                    </label>

                    {/* Read In Listed Order Toggle */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#f9a8d4',
                      userSelect: 'none',
                      marginBottom: 0,
                      marginTop: 0,
                      flex: 1,
                      minWidth: 0,
                    }}>
                      <span>Read In Order</span>
                      <div
    onClick={() => {
      setReadInOrder(v => {
        const next = !v;
        orderedIndexRef.current = 0;
        return next;
      });
    }}
                        style={{
                          position: 'relative', width: '3.5rem', height: '1.75rem',
                          backgroundColor: readInOrder ? '#3b82f6' : 'rgba(255,255,255,0.2)', borderRadius: '9999px',
                          transition: 'background-color 0.2s ease-in-out', border: '1px solid rgba(255,255,255,0.3)'
                        }}>
                        <div style={{
                          position: 'absolute', top: 2, left: readInOrder ? 'calc(100% - 1.5rem - 2px)' : 2,
                          width: '1.5rem', height: '1.5rem', backgroundColor: 'white', borderRadius: '50%',
                          transition: 'left   0.2s ease-in-out', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
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
                        <button type="button" onClick={() => setRoundsCount(Math.min(20, roundsCount +   1))} style={chipButtonStyle}>+</button>
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
                            v = Math.min(30, Math.max(0.25, v)); // Clamp between 15s and 10min
                            const stepped = Math.round(v / 0.25) * 0.25;
                            setRoundMin(stepped);
                            setRoundMinInput(String(stepped));
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
                        <button className={`difficulty-btn ${difficulty === 'easy' ? 'active' : ''}`} onClick={() => setDifficulty('easy')} aria-pressed={difficulty === 'easy'}>Amateur</button>
                        <button className={`difficulty-btn ${difficulty === 'medium' ? 'active' : ''}`} onClick={() => setDifficulty('medium')} aria-pressed={difficulty === 'medium'}>Pro</button>
                        <button className={`difficulty-btn ${difficulty === 'hard' ? 'active' : ''}`} onClick={() => setDifficulty('hard')} aria-pressed={difficulty === 'hard'}>Legend</button>
                      </div>
                    </section>
                  )}

                  {/* Advanced Settings: Voice Speed and Selection */}
                  <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ ...linkButtonStyle, color: '#f9a8d4', fontSize: '0.875rem' }}>
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                  </button>
                  {showAdvanced && (
                    <div className="advanced-settings-panel">
    <div className="voice-speed-settings">
      {/* Voice Speed Slider */}
      <div className="field" style={{ minWidth: 0, flex: 1 }}>
        <label htmlFor="voice-speed" style={{ color: '#f9a8d4', fontWeight: 600, fontSize: '1rem', display: 'block', marginBottom: 4 }}>
          Voice Speed
        </label>
        <input
          id="voice-speed"
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={voiceSpeed}
          onChange={e => setVoiceSpeed(Number(e.target.value))}
          style={{ width: '100%' }}
        />
        <div style={{ fontSize: '0.95rem', color: '#f9a8d4', marginTop: 2 }}>
          {voiceSpeed.toFixed(2)}x
        </div>
      </div>

      {/* Voice Selection Dropdown */}
      <div className="field" style={{ minWidth: 0, flex: 2 }}>
        <label htmlFor="voice-select" style={{ color: '#f9a8d4', fontWeight: 600, fontSize: '1rem', display: 'block', marginBottom: 4 }}>
          Voice
        </label>
        <select
          id="voice-select"
          value={voice?.name || ''}
          onChange={e => {
            const selected = voices.find(v => v.name === e.target.value) || null;
            setVoice(selected);
            if (selected) {
              speakSystem(`Voice switched to ${selected.name}`, selected, voiceSpeed);
            }
          }}
          style={{
            appearance: 'none',
            background: '#eeeeeeff',
            color: '#181825',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.5rem',
            border: '1px solid #000000ff',
            fontSize: '1rem',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <option value="" disabled>Select a voice...</option>
          {voices.map(v => (
            <option key={v.name} value={v.name}>
              {v.name} {v.default ? '(Default)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Test Voice Button */}
      <div className="field" style={{ minWidth: 0, flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', marginTop: 24 }}>
        <button
          type="button"
          onClick={testVoice}
          style={{
            all: 'unset',
            cursor: 'pointer',
            color: '#f9a8d4',
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            border: '1px solid transparent',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            textAlign: 'center',
            transition: 'transform 0.2s, background 0.3s',
            position: 'relative',
            overflow: 'hidden',
            zIndex: 1,
          }}
        >
          <span style={{ position: 'relative', zIndex: 2 }}>Test Voice</span>
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            background: 'rgba(255,255,255,0.1)',
            zIndex: 1,
            pointerEvents: 'none',
            transform: 'translateY(2px) translateX(2px)',
            transition: 'transform 0.3s',
          }} />
        </button>
      </div>
    </div>
    <div style={{ color: '#f9a8d4', fontSize: '0.92rem', marginTop: '0.5rem', textAlign: 'left' }}>
      <span>
        <strong>Tip:</strong> Choose a clear, natural voice and adjust the speed for your training pace.
      </span>
    </div>
  </div>
)}
                  {/* Conditionally render Difficulty and Start button together */}
                  {!running && !isPreRound && hasSelectedEmphasis && (
                    <>
                      {/* Smooth, single-color gradient overlay from just above the button to the bottom */}
                      <div
                        style={{
                          position: 'fixed',
                          left: 0,
                          right: 0,
                          // Raise the overlay so it starts further above the button for more focus
                          top: `calc(75vh - 80px - 48px)`, // was 82vh
                          bottom: 0,
                          zIndex: 998,
                          pointerEvents: 'none',
                          background: `
                            linear-gradient(
                              180deg,
                              rgba(24,24,36,0) 0%,
                              rgba(24,24,36,0.5) 100%
                            )
                          `,
                          opacity: 1,
                          transition: 'opacity 0.3s',
                        }}
                        aria-hidden="true"
                      />
                      <button className="start-button" onClick={startSession}>
                        Let's Go!
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer stays visible on all pages */}
      <footer style={{ textAlign: 'center', marginTop: '4rem', padding: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', color: '#f9a8d4' }}>
          <img
            src="/assets/logo_icon.png"
            alt="Logo"
            style={{ height: '32px', marginRight: '0.5rem', verticalAlign: 'middle', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}
            onClick={() => {
              setPage('timer');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                setPage('timer');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            role="button"
            aria-label="Go to home"
          />
          <span>Train smart, fight smarter</span>
          <button onClick={() => setPage('logs')} style={{ ...linkButtonStyle, padding: '0.25rem 0.5rem' }}>
            Workout Logs
          </button>
          <button onClick={() => setShowOnboardingMsg(true)} style={{ ...linkButtonStyle, padding: '0.25rem 0.5rem' }}>
            Help
          </button>
        </div>
      </footer>
    </div> {/* <-- This closes the <div style={{ position: 'relative', zIndex: 0 }}> */}
    </>
  );
}

type WorkoutLogsProps = {
  onBack: () => void;
  emphasisList: { key: string; label: string; iconPath: string; emoji: string; desc: string; }[];
};