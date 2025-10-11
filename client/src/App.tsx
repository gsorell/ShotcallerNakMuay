import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
// import PageLayout from './PageLayout'; // (unused)
import { displayInAppBrowserWarning } from './utils/inAppBrowserDetector';
import { INITIAL_TECHNIQUES } from './techniques';
import TechniqueEditor from './TechniqueEditor';
import WorkoutLogs from './WorkoutLogs';
import WorkoutCompleted from './WorkoutCompleted';
import './App.css';
import './difficulty.css';
import { useWakeLock } from './useWakeLock';
import Header from './components/Header';
import StatusTimer from './components/StatusTimer'; // <-- Make sure this import exists
import { usePWA } from './hooks/usePWA';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// Global state to persist modal scroll position across re-renders
let modalScrollPosition = 0;

// Google Analytics 4 (GA4) implementation
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Your GA4 Measurement ID - replace 'G-XXXXXXXXXX' with your actual measurement ID
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Replace with your actual GA4 measurement ID

// Analytics event names
const AnalyticsEvents = {
  // Timer events
  WorkoutStart: 'workout_start',
  WorkoutComplete: 'workout_complete',
  WorkoutPause: 'workout_pause',
  WorkoutResume: 'workout_resume',
  WorkoutStop: 'workout_stop',
  
  // Settings events
  SettingToggle: 'setting_toggle',
  EmphasisSelect: 'emphasis_select',
  EmphasisDeselect: 'emphasis_deselect',
  EmphasisListToggle: 'emphasis_list_toggle',
  DifficultyChange: 'difficulty_change',
  
  // Navigation events
  PageChange: 'page_change',
  TechniqueEditorOpen: 'technique_editor_open',
  WorkoutLogsOpen: 'workout_logs_open',
  
  // PWA events
  PWAInstallPrompt: 'pwa_install_prompt',
  PWAInstallAccept: 'pwa_install_accept',
  PWAInstallDecline: 'pwa_install_decline'
} as const;

// Initialize GA4
const initializeGA4 = () => {
  // Only initialize in production (not on localhost)
  if (typeof window === 'undefined' || window.location.hostname === 'localhost') {
    return;
  }

  // Load the Google Analytics script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize dataLayer and gtag
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(...args: any[]) {
    window.dataLayer.push(arguments);
  };
  
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_title: 'Nak Muay Shot Caller',
    page_location: window.location.href
  });
};

// Track events
const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      event_category: 'engagement',
      event_label: parameters?.label || '',
      value: parameters?.value || 0,
      ...parameters
    });
  }
};

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
const VOICE_STORAGE_KEY = 'shotcaller_voice_preference';
const TECHNIQUES_VERSION = 'v32'; // Increment this version to force a reset on deployment

// Base UI config for known styles
// FIX: Use absolute string paths for icons in the /public/assets directory
const BASE_EMPHASIS_CONFIG: { [key: string]: { label: string; icon: string; desc: string; iconPath: string; } } = {
  timer_only: {
    label: 'Timer Only',
    icon: '⏱️',
    desc: 'Just a round timer — no shotcalling, no techniques.',
    iconPath: '/assets/icon.stopwatch.png'
  },
  newb:   { label: 'Nak Muay Newb', icon: '👶', desc: 'Start here to learn the basic strikes', iconPath: '/assets/icon_newb.png' },
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
  // REMOVE muay_tech entry entirely
  ko_setups: {
    label: 'KO Setups',
    icon: '💣',
    desc: 'Explosive knockout setups and finishing combinations',
    iconPath: '/assets/icon.ko.png'
  },
  tricky_traps: {
    label: 'Tricky Traps and Spinning Shit',
    icon: '🌪️',
    desc: 'Advanced spinning techniques and deceptive setups',
    iconPath: '/assets/icon.trickytraps.png'
  },
  feints_and_fakeouts: {
    label: 'Feints and Fakeouts',
    icon: '🎭',
    desc: 'Deceptive movements and setups that manipulate timing and rhythm.',
    iconPath: '/assets/icon.feintsandfakes.png'
  },
  dutch_kickboxing: {
    label: 'Dutch Kickboxing',
    icon: '🥊',
    desc: 'High-pressure combinations emphasizing volume, flow, and power.',
    iconPath: '/assets/icon.dutch.png'
  }
};

const DEFAULT_REST_MINUTES = 1;

// Mirror technique for southpaw mode - only swap Left/Right directional words
const mirrorTechnique = (technique: string): string => {
  console.log('Mirroring technique:', technique); // Debug log
  
  // Safety check: ensure input is a valid string
  if (!technique || typeof technique !== 'string') {
    console.warn('Invalid input to mirrorTechnique:', technique);
    return String(technique || '');
  }
  
  // Simple swap: Left ↔ Right (case insensitive, preserving original case)
  let mirrored = technique;
  
  try {
    // Use temporary placeholders to avoid double-swapping
    mirrored = mirrored.replace(/\bLeft\b/gi, '|||TEMP_LEFT|||');
    mirrored = mirrored.replace(/\bRight\b/gi, 'Left');
    mirrored = mirrored.replace(/\|\|\|TEMP_LEFT\|\|\|/gi, 'Right');
  } catch (error) {
    console.error('Error in mirrorTechnique regex:', error);
    return technique; // Return original on error
  }
  
  console.log('Mirrored result:', mirrored); // Debug log
  return mirrored;
};

export default function App() {
  useEffect(() => {
    displayInAppBrowserWarning();
    initializeGA4();
    
    // One-time cleanup: Remove any existing non-English voice preferences
    try {
      const stored = localStorage.getItem(VOICE_STORAGE_KEY);
      if (stored) {
        const voiceData = JSON.parse(stored);
        const isEnglish = voiceData.lang && voiceData.lang.toLowerCase().startsWith('en');
        if (!isEnglish) {
          console.log('Removing non-English voice preference on app load:', voiceData.name, voiceData.lang);
          localStorage.removeItem(VOICE_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.warn('Error during voice preference cleanup:', error);
      localStorage.removeItem(VOICE_STORAGE_KEY);
    }
  }, []);

  // PWA functionality
  const pwa = usePWA();
  
  // User engagement tracking for PWA prompting
  const [userEngagement, setUserEngagement] = useState(() => {
    const stored = localStorage.getItem('user_engagement_stats');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          visitCount: parsed.visitCount || 0,
          timeOnSite: 0, // Reset time for new session
          completedWorkouts: parsed.completedWorkouts || 0,
          lastVisit: parsed.lastVisit ? new Date(parsed.lastVisit) : new Date()
        };
      } catch {
        return { visitCount: 0, timeOnSite: 0, completedWorkouts: 0, lastVisit: new Date() };
      }
    }
    return { visitCount: 0, timeOnSite: 0, completedWorkouts: 0, lastVisit: new Date() };
  });
  
  const [sessionStartTime] = useState(Date.now());
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  // Track whether we're on the Technique Editor to gate periodic updates that can steal focus on mobile
  const isEditorRef = useRef(false);

  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .catch(() => {
          // Service worker registration failed - app will still work without it
        });
    }
  }, []);

  // Track user engagement and update visit count
  useEffect(() => {
    // Increment visit count on first load
    const newEngagement = {
      ...userEngagement,
      visitCount: userEngagement.visitCount + 1,
      lastVisit: new Date()
    };
    setUserEngagement(newEngagement);
    
    // Save to localStorage with ISO string
    localStorage.setItem('user_engagement_stats', JSON.stringify({
      ...newEngagement,
      lastVisit: newEngagement.lastVisit.toISOString()
    }));
  }, []); // Only run once on mount

  // Track time on site and show install prompt after 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Skip updating while editing techniques to avoid focus drops on mobile
      if (isEditorRef.current) return;
      const timeOnSite = Math.floor((Date.now() - sessionStartTime) / 1000);
      setUserEngagement(prev => ({ ...prev, timeOnSite }));
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [sessionStartTime]);
  
  // Show install prompt automatically after 30 seconds if not installed and not dismissed
  useEffect(() => {
    // Don't interrupt the Technique Editor with prompts
    if (isEditorRef.current) return;
    // Don't show if already installed or previously dismissed permanently
    if (!pwa.isInstalled) {
      const dismissed = localStorage.getItem('pwa_install_dismissed');
      if (!dismissed) {
        const timer = setTimeout(() => {
          // Double-check install status before showing (in case user installed during the 30 seconds)
          if (!pwa.isInstalled && !isEditorRef.current) {
            setShowPWAPrompt(true);
          }
        }, 30000); // 30 seconds
        
        return () => clearTimeout(timer);
      }
    }
  }, [pwa.isInstalled]);  // Routing
  const [page, setPage] = useState<Page>('timer');
  // Keep a ref of whether we're on the Technique Editor page for gating timers and prompts
  useEffect(() => {
    isEditorRef.current = (page === 'editor');
  }, [page]);
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
  // Debug: track previous techniques to log diffs when techniques change
  const prevTechRef = React.useRef<TechniquesShape | null>(null);
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
      // Compare previous value and log any changed group keys
      try {
        const prev = prevTechRef.current;
        if (prev) {
          Object.keys(techniques).forEach(k => {
            const a = JSON.stringify(prev[k]);
            const b = JSON.stringify(techniques[k]);
            // previously logged changes here during debugging
          });
        }
      } catch (err) {
        // swallow
      }
      prevTechRef.current = techniques;
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
      'meat_potatoes', 'buakaw', 'low_kick_legends', 'elbow_arsenal', /* REMOVE: 'muay_tech', */ 'ko_setups', 'tricky_traps', 'feints_and_fakeouts', 'dutch_kickboxing'
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
    try { 
      (window as any).__techniques = techniquesRef.current;
      // Debug helper for testing PWA prompt
      (window as any).__testPWAPrompt = () => {
        localStorage.removeItem('pwa_install_dismissed');
        setShowPWAPrompt(true);
      };
    } catch { /* noop */ }
  }, [techniques]);

  // Selection and session settings
  const [selectedEmphases, setSelectedEmphases] = useState<Record<EmphasisKey, boolean>>({
    timer_only: false,
    khao: false, mat: false, tae: false, femur: false, sok: false, boxing: false, newb: false, two_piece: false, southpaw: false
  });
  const [addCalisthenics, setAddCalisthenics] = useState(false);

  // ADD: Read in order toggle
  const [readInOrder, setReadInOrder] = useState(false);
  
  // ADD: Southpaw mode toggle
  const [southpawMode, setSouthpawMode] = useState(() => {
    try {
      const stored = localStorage.getItem('southpaw_mode');
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      // Ensure we always return a proper boolean
      return Boolean(parsed);
    } catch (error) {
      // If localStorage is corrupted, default to false and clear it
      console.warn('Failed to parse southpaw_mode from localStorage:', error);
      try {
        localStorage.removeItem('southpaw_mode');
      } catch { /* ignore cleanup errors */ }
      return false;
    }
  });
  
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [roundsCount, setRoundsCount] = useState(5);
  const [roundMin, setRoundMin] = useState(3);
  const [restMinutes, setRestMinutes] = useState(DEFAULT_REST_MINUTES);
  
  // Toggle an emphasis on/off
  const toggleEmphasis = (k: EmphasisKey) => {
    setSelectedEmphases(prev => {
      const isTurningOn = !prev[k];
      
      // Track emphasis selection/deselection
      try {
        trackEvent(isTurningOn ? AnalyticsEvents.EmphasisSelect : AnalyticsEvents.EmphasisDeselect, {
          emphasis: k
        });
      } catch (e) {
        console.warn('Analytics tracking failed:', e);
      }
      
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
  
  // Clear all selected emphases
  const clearAllEmphases = () => {
    setSelectedEmphases({
      timer_only: false,
      khao: false, mat: false, tae: false, femur: false, sok: false, boxing: false, newb: false, two_piece: false, southpaw: false
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
  
  // Stable callback to prevent modal re-renders
  const closeOnboardingModal = useCallback(() => {
    setShowOnboardingMsg(false);
  }, []);
  

  // Voice persistence helpers
  const saveVoicePreference = useCallback((voice: SpeechSynthesisVoice | null) => {
    if (!voice) {
      localStorage.removeItem(VOICE_STORAGE_KEY);
      return;
    }
    
    // SECURITY: Only save English voices to prevent non-English voices from persisting
    const isEnglish = voice.lang.toLowerCase().startsWith('en');
    if (!isEnglish) {
      console.warn('Attempted to save non-English voice preference, ignoring:', voice.name, voice.lang);
      localStorage.removeItem(VOICE_STORAGE_KEY);
      return;
    }
    
    // Store voice name and lang for matching later
    const voiceData = {
      name: voice.name,
      lang: voice.lang,
      localService: voice.localService,
      default: voice.default
    };
    localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(voiceData));
    console.log('Saved English voice preference:', voice.name, voice.lang);
  }, []);

  const loadVoicePreference = useCallback((availableVoices: SpeechSynthesisVoice[]) => {
    try {
      const stored = localStorage.getItem(VOICE_STORAGE_KEY);
      if (!stored || !availableVoices.length) return null;
      
      const voiceData = JSON.parse(stored);
      // Try to find exact match by name and lang
      const matchedVoice = availableVoices.find(v => 
        v.name === voiceData.name && v.lang === voiceData.lang
      );
      
      if (matchedVoice) {
        // FIXED: Only return saved voice if it's English-compatible
        const isEnglishCompatible = matchedVoice.lang.toLowerCase().startsWith('en');
        if (isEnglishCompatible) {
          console.log('Loaded saved English voice preference:', matchedVoice.name);
          return matchedVoice;
        } else {
          console.log('Saved voice is non-English, clearing preference:', matchedVoice.name, matchedVoice.lang);
          // Clean up non-English preference and force English selection
          localStorage.removeItem(VOICE_STORAGE_KEY);
          return null;
        }
      } else {
        console.log('Saved voice not available:', voiceData.name);
        // Clean up invalid preference
        localStorage.removeItem(VOICE_STORAGE_KEY);
        return null;
      }
    } catch (error) {
      console.warn('Failed to load voice preference:', error);
      localStorage.removeItem(VOICE_STORAGE_KEY);
      return null;
    }
  }, []);

  // TTS controls
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceCompatibilityWarning, setVoiceCompatibilityWarning] = useState<string>('');
  // Live "subtitle" for the active technique/combination
  const [currentCallout, setCurrentCallout] = useState<string>('');
  // Voice compatibility checker - check selected voice specifically
  const checkVoiceCompatibility = useCallback((selectedVoice: SpeechSynthesisVoice | null, allVoices: SpeechSynthesisVoice[]) => {
    if (!allVoices.length) {
      setVoiceCompatibilityWarning('No text-to-speech voices available.');
      return;
    }

    // If no voice is selected yet, don't show warnings
    if (!selectedVoice) {
      setVoiceCompatibilityWarning('');
      return;
    }

    // Check if the selected voice is English-compatible
    const isEnglishCompatible = 
      selectedVoice.lang.toLowerCase().startsWith('en') || 
      selectedVoice.name.toLowerCase().includes('english') ||
      selectedVoice.name.toLowerCase().includes('us') ||
      selectedVoice.name.toLowerCase().includes('uk') ||
      selectedVoice.name.toLowerCase().includes('gb') ||
      selectedVoice.name.toLowerCase().includes('australia') ||
      selectedVoice.name.toLowerCase().includes('canada') ||
      selectedVoice.name.toLowerCase().includes('india') ||
      selectedVoice.name.toLowerCase().includes('south africa');

    console.log('Voice compatibility check:', {
      selectedVoice: selectedVoice.name,
      lang: selectedVoice.lang,
      isEnglishCompatible
    });

    if (isEnglishCompatible) {
      // All English variants are fine - no warning needed
      setVoiceCompatibilityWarning('');
    } else {
      // Only show warning for non-English voices
      setVoiceCompatibilityWarning('Selected voice may have pronunciation issues with English techniques.');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const update = () => {
      const availableVoices = synth.getVoices();
      setVoices(availableVoices);
      
      console.log('Voice update triggered. Available voices:', availableVoices.length);
      console.log('Current voice:', voice?.name || 'none');
      console.log('Available voice languages:', availableVoices.map(v => `${v.name} (${v.lang})`));
      
      // Auto-select voice if none is selected and voices are available
      // OR if current voice is non-English and English voices are available
      const currentVoiceIsNonEnglish = voice && !voice.lang.toLowerCase().startsWith('en');
      const shouldSelectNewVoice = (availableVoices.length > 0 && !voice) || currentVoiceIsNonEnglish;
      
      if (shouldSelectNewVoice) {
        let selectedVoice: SpeechSynthesisVoice | null = null;
        
        console.log('Selecting new voice. Current voice is non-English:', currentVoiceIsNonEnglish);
        
        // Priority 0: Try to load saved voice preference (loadVoicePreference now ensures it's English)
        const savedVoice = loadVoicePreference(availableVoices);
        if (savedVoice) {
          selectedVoice = savedVoice;
          console.log('Using saved English voice preference:', selectedVoice.name);
        } else {
          // Priority 1: American English voices (en-US or en_US)
          const americanEnglishVoices = availableVoices.filter(v => 
            v.lang.toLowerCase() === 'en-us' || 
            v.lang.toLowerCase() === 'en_us' ||
            v.lang.toLowerCase().startsWith('en-us') ||
            v.lang.toLowerCase().startsWith('en_us')
          );
          
          console.log('American English voices found:', americanEnglishVoices.map(v => v.name));
          
          if (americanEnglishVoices.length > 0) {
            // Prefer voices with specific American English indicators (avoid false positives like "Australia")
            selectedVoice = americanEnglishVoices.find(v => 
              v.name.toLowerCase().includes('united states') ||
              v.name.toLowerCase().includes('us english') ||
              (v.name.toLowerCase().includes('english') && v.name.toLowerCase().includes(' us ')) ||
              (v.name.toLowerCase().includes('english') && v.name.toLowerCase().endsWith(' us'))
            ) || americanEnglishVoices[0];
            console.log('Auto-selected American English voice:', selectedVoice.name);
          } else {
            // Priority 2: Any English voice (en-*)
            const englishVoices = availableVoices.filter(v => 
              v.lang.toLowerCase().startsWith('en')
            );
            
            console.log('English voices found:', englishVoices.map(v => `${v.name} (${v.lang})`));
            
            if (englishVoices.length > 0) {
              selectedVoice = englishVoices.find(v => 
                v.name.toLowerCase().includes('english')
              ) || englishVoices[0];
              console.log('Auto-selected English voice:', selectedVoice.name);
            } else {
              // Priority 3: ONLY as last resort, use browser default but warn user
              selectedVoice = availableVoices.find(v => v.default) || availableVoices[0];
              console.warn('No English voices found! Falling back to:', selectedVoice.name, selectedVoice.lang);
              // Clear any saved preference since we're falling back to non-English
              localStorage.removeItem(VOICE_STORAGE_KEY);
            }
          }
        }
        
        if (selectedVoice) {
          console.log('Setting voice to:', selectedVoice.name, selectedVoice.lang);
          setVoice(selectedVoice);
          saveVoicePreference(selectedVoice);
        }
      }
      
      // Run compatibility check with current voice and available voices
      if (availableVoices.length > 0) {
        checkVoiceCompatibility(voice, availableVoices);
      }
    };
    update();
    (synth as any).onvoiceschanged = update;
    
    // iOS Safari workaround: voices might not be loaded immediately
    // Retry after a short delay to catch late-loading voices
    const retryTimeout = setTimeout(() => {
      console.log('iOS Safari voice retry triggered');
      update();
    }, 100);
    
    // Additional retry for stubborn iOS cases
    const secondRetryTimeout = setTimeout(() => {
      console.log('iOS Safari second voice retry triggered');
      update();
    }, 500);
    
    return () => { 
      try { (synth as any).onvoiceschanged = null; } catch { /* noop */ }
      clearTimeout(retryTimeout);
      clearTimeout(secondRetryTimeout);
    };
  }, [checkVoiceCompatibility, loadVoicePreference, saveVoicePreference]);

  // NEW: refs so changing speed/voice doesn’t restart cadence
  const voiceSpeedRef = useRef(voiceSpeed);
  useEffect(() => { voiceSpeedRef.current = voiceSpeed; }, [voiceSpeed]);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(voice);
  useEffect(() => { voiceRef.current = voice; }, [voice]);

  // Additional effect to force English voice selection when voices array changes
  useEffect(() => {
    if (!voices.length) return;
    
    // If we have a non-English voice selected and English voices are available, switch immediately
    const currentIsNonEnglish = voice && !voice.lang.toLowerCase().startsWith('en');
    const englishVoicesAvailable = voices.some(v => v.lang.toLowerCase().startsWith('en'));
    
    if (currentIsNonEnglish && englishVoicesAvailable) {
      console.log('Forcing switch from non-English voice to English:', voice.name, voice.lang);
      
      // Find the best English voice with same priority as initial selection
      const americanEnglishVoices = voices.filter(v => 
        v.lang.toLowerCase() === 'en-us' || 
        v.lang.toLowerCase() === 'en_us' ||
        v.lang.toLowerCase().startsWith('en-us') ||
        v.lang.toLowerCase().startsWith('en_us')
      );
      
      let bestEnglishVoice = null;
      
      if (americanEnglishVoices.length > 0) {
        // Prefer American English with specific indicators
        bestEnglishVoice = americanEnglishVoices.find(v => 
          v.name.toLowerCase().includes('united states') ||
          v.name.toLowerCase().includes('us english') ||
          (v.name.toLowerCase().includes('english') && v.name.toLowerCase().includes(' us ')) ||
          (v.name.toLowerCase().includes('english') && v.name.toLowerCase().endsWith(' us'))
        ) || americanEnglishVoices[0];
      } else {
        // Fall back to any English voice
        const englishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
        bestEnglishVoice = englishVoices.find(v => 
          v.name.toLowerCase().includes('english')
        ) || englishVoices[0];
      }
      
      if (bestEnglishVoice) {
        console.log('Switching to English voice:', bestEnglishVoice.name, bestEnglishVoice.lang);
        setVoice(bestEnglishVoice);
        saveVoicePreference(bestEnglishVoice);
        // Clear any old non-English preference that might be cached
        localStorage.removeItem(VOICE_STORAGE_KEY);
        // Save the new English voice immediately
        setTimeout(() => saveVoicePreference(bestEnglishVoice), 100);
      }
    }
  }, [voices, voice, saveVoicePreference]);

  // Debug helper for voice compatibility debugging
  useEffect(() => {
    try {
      (window as any).__voiceDebug = {
        voiceCompatibilityWarning,
        voiceName: voice?.name || 'none',
        voiceLang: voice?.lang || 'none', 
        voicesCount: voices.length,
        southpawMode
      };
      
      (window as any).__techniqueDebug = {
        clearStorage: () => {
          localStorage.removeItem('shotcaller_techniques');
          localStorage.removeItem('shotcaller_techniques_version');
          window.location.reload();
        },
        currentTechniques: techniques
      };
    } catch { /* noop */ }
  }, [voiceCompatibilityWarning, voice, voices, southpawMode]);

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

  // Persist southpaw mode to localStorage
  useEffect(() => {
    localStorage.setItem('southpaw_mode', JSON.stringify(southpawMode));
  }, [southpawMode]);

  // Create ref for southpaw mode to ensure it's accessible in callbacks
  const southpawModeRef = useRef(Boolean(southpawMode));
  useEffect(() => { 
    southpawModeRef.current = Boolean(southpawMode); 
  }, [southpawMode]);

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
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
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
      difficulty === 'hard' ? 60 : 31;
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
        // True random selection each time
        phrase = pool[Math.floor(Math.random() * pool.length)];
      }

      // Increment shotsCalledOut counter
      shotsCalledOutRef.current += 1;

      // If Web Speech is available, sync UI to the actual utterance lifecycle
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }

        // Apply southpaw mirroring if enabled
        const finalPhrase = southpawModeRef.current ? mirrorTechnique(phrase) : phrase;
        
        // Safety check: ensure we never pass empty strings to speech synthesis
        if (!finalPhrase || typeof finalPhrase !== 'string' || finalPhrase.trim() === '') {
          console.warn('Empty or invalid finalPhrase, skipping speech synthesis:', finalPhrase);
          setCurrentCallout(phrase || '');
          return;
        }
        
        const u = new SpeechSynthesisUtterance(finalPhrase);
        const v = voiceRef.current;
        if (v) u.voice = v;
        u.rate = voiceSpeedRef.current;

        u.onstart = () => {
          if (ttsGuardRef.current || !runningRef.current) {
            try { window.speechSynthesis.cancel(); } catch { /* noop */ }
            return;
          }
          setCurrentCallout(finalPhrase);
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
      // Apply southpaw mirroring if enabled
      const finalPhrase = southpawModeRef.current ? mirrorTechnique(phrase) : phrase;
      
      // Safety check for callouts
      const safePhrase = (!finalPhrase || typeof finalPhrase !== 'string' || finalPhrase.trim() === '') 
        ? (phrase || '') 
        : finalPhrase;
      
      setCurrentCallout(safePhrase);
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
        // Flag for post-workout install suggestion
        suggestInstall: !pwa.isInstalled && userEngagement.completedWorkouts >= 1
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

  // Voice tester with enhanced error handling
  function testVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setVoiceCompatibilityWarning('Text-to-speech not supported in this browser.');
      return;
    }

    if (!voice) {
      setVoiceCompatibilityWarning('No voice selected. Please choose a voice from the dropdown.');
      return;
    }

    try {
      // Cancel any ongoing speech to prevent overlap
      window.speechSynthesis.cancel();

      // Create and configure the utterance for the test
      const testPhrase = `Voice test at ${voiceSpeed.toFixed(2)}x speed. Jab cross hook.`;
      const utterance = new SpeechSynthesisUtterance(testPhrase);
      utterance.voice = voice;
      utterance.rate = voiceSpeed;

      // Add error handling for the utterance
      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event);
        setVoiceCompatibilityWarning(`Voice test failed: ${event.error}. This voice may not work properly with English text.`);
      };

      utterance.onstart = () => {
        setVoiceCompatibilityWarning('');
      };

      utterance.onend = () => {
        // If we get here, the voice worked - clear any warnings
        console.log("Voice test completed successfully");
        setVoiceCompatibilityWarning('');
      };

      // Speak the test phrase
      window.speechSynthesis.speak(utterance);

      // Set a timeout to detect if speech never starts
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          setVoiceCompatibilityWarning('Voice test failed to start. This voice may not be compatible with English text.');
        }
      }, 1000);

    } catch (err) {
      console.error("Voice test failed:", err);
      setVoiceCompatibilityWarning(`Voice test error: ${err}. Try selecting a different voice.`);
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

    // Track workout start
    try {
      trackEvent(AnalyticsEvents.WorkoutStart, {
        selected_emphases: Object.keys(selectedEmphases).filter(k => selectedEmphases[k as EmphasisKey]),
        difficulty: difficulty,
        rounds: roundsCount,
        round_duration_minutes: roundMin,
        rest_duration_minutes: restMinutes,
        include_calisthenics: addCalisthenics,
        read_in_order: readInOrder
      });
    } catch (e) {
      // Analytics should never break functionality
      console.warn('Analytics tracking failed:', e);
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
      
      // Update engagement stats for completed workout
      const updatedEngagement = {
        ...userEngagement,
        completedWorkouts: userEngagement.completedWorkouts + 1
      };
      setUserEngagement(updatedEngagement);
      localStorage.setItem('user_engagement_stats', JSON.stringify({
        ...updatedEngagement,
        lastVisit: updatedEngagement.lastVisit.toISOString()
      }));
      
      // Trigger home page stats refresh
      setStatsRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Failed to auto-log workout:', err);
    }
  }

  // REMOVE this block (it's a plain <div> showing round/time/status):
  /*
  <div>
    <p>Round: {currentRound}/{roundsCount}</p>
    <p>Status: {getStatus()}</p>
    <p>Time Left: {fmtTime(timeLeft)}</p>
    {isResting && <p>Rest Time Left: {fmtTime(restTimeLeft)}</p>}
    {isPreRound && <p>Pre-Round Time Left: {fmtTime(preRoundTimeLeft)}</p>}
  </div>
  */

  // RESTORE the styled timer by replacing the above with:
  {(running || isPreRound) && (
    <StatusTimer
      time={fmtTime(timeLeft)}
      round={currentRound}
      totalRounds={roundsCount}
      status={getStatus()}
      isResting={isResting}
      restTimeLeft={restTimeLeft}
      isPreRound={isPreRound}
      preRoundTimeLeft={preRoundTimeLeft}
      fmtTime={fmtTime}
    />
  )}

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
  // --- Stats calculation functions (similar to WorkoutLogs) ---
  const [homePageStats, setHomePageStats] = useState<any>(null);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);

  // Calculate streaks from workout logs
  const calculateStreaks = (logs: any[]) => {
    if (!logs.length) return { current: 0, longest: 0 };
    
    // Get unique workout days, sorted chronologically
    const days = Array.from(
      new Set(
        logs
          .map((l) => new Date(l.timestamp).toISOString().slice(0, 10))
          .sort((a, b) => a.localeCompare(b))
      )
    );
    
    if (days.length === 0) return { current: 0, longest: 0 };
    if (days.length === 1) return { current: 1, longest: 1 };

    // Calculate longest streak
    let longest = 1, current = 1, max = 1;
    for (let i = 1; i < days.length; ++i) {
      const prev = new Date(days[i - 1]);
      const curr = new Date(days[i]);
      const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        current += 1;
        if (current > max) max = current;
      } else {
        current = 1;
      }
    }
    
    // Calculate current streak (must end on today or yesterday to be "current")
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const lastWorkoutDay = days[days.length - 1];
    
    // Only count as current streak if last workout was today or yesterday
    if (lastWorkoutDay !== today && lastWorkoutDay !== yesterday) {
      return { current: 0, longest: max };
    }
    
    // Count backwards from the most recent workout day
    let currentStreak = 1;
    for (let i = days.length - 1; i > 0; --i) {
      const prev = new Date(days[i - 1]);
      const curr = new Date(days[i]);
      const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        currentStreak += 1;
      } else {
        break;
      }
    }
    
    return { current: currentStreak, longest: max };
  };

  // Load and calculate home page stats
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
      if (!raw) { setHomePageStats(null); return; }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) { 
        setHomePageStats(null); 
        return; 
      }
      
      // Normalize workout entries
      const logs = parsed.map((p: any, i: number) => ({
        id: String(p?.id ?? `log-${i}-${Date.now()}`),
        timestamp: String(p?.timestamp ?? new Date().toISOString()),
        emphases: Array.isArray(p?.emphases) ? p.emphases.map(String) : []
      }));
      
      // Calculate stats
      const emphasesCount: Record<string, number> = {};
      logs.forEach((l: any) => l.emphases.forEach((e: string) => { 
        emphasesCount[e] = (emphasesCount[e] || 0) + 1; 
      }));
      const mostCommonEmphasis = Object.entries(emphasesCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      const streaks = calculateStreaks(logs);
      
      setHomePageStats({ mostCommonEmphasis, ...streaks });
    } catch {
      setHomePageStats(null);
    }
  }, [page, statsRefreshTrigger]); // Recalculate when page changes or new workout is saved

  // Find the favorite emphasis config by label (case-insensitive)
  const favoriteConfig = homePageStats?.mostCommonEmphasis
    ? emphasisList.find(
        e => e.label.trim().toLowerCase() === homePageStats.mostCommonEmphasis.trim().toLowerCase()
      )
    : null;

  // Add this helper right before the return
  const isActive = running || isPreRound;

  // New: Extracted onboarding modal to avoid JSX bracket/paren issues
  const OnboardingModal: React.FC<{ open: boolean; onClose: () => void }> = React.memo(({ open, onClose }) => {
    const modalRef = React.useRef<HTMLDivElement>(null);

    const escHandler = React.useCallback((e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    }, [onClose]);

    React.useEffect(() => {
      if (!open) return;
      window.addEventListener('keydown', escHandler);
      return () => window.removeEventListener('keydown', escHandler);
    }, [open, escHandler]);

    // Restore and save scroll position using global variable
    React.useLayoutEffect(() => {
      if (!open || !modalRef.current) return;
      
      // Restore scroll position immediately
      modalRef.current.scrollTop = modalScrollPosition;
      
      // Save scroll position on scroll
      const handleScroll = () => {
        if (modalRef.current) {
          modalScrollPosition = modalRef.current.scrollTop;
        }
      };
      
      modalRef.current.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        if (modalRef.current) {
          modalRef.current.removeEventListener('scroll', handleScroll);
        }
      };
    }, [open]);

    if (!open) return null;

    const modal = (
      <div
        role="dialog"
        aria-modal="true"
        onClick={onClose} // click backdrop to close
        ref={modalRef}
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
                Turn your shadowboxing and bagwork into dynamic, guided sessions with spoken techniques and timed rounds.
              </strong> Think of it as having a personal trainer right in your ear, helping you focus on reaction time and flow.
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
  });

  const TechniqueEditorAny = TechniqueEditor as unknown as React.ComponentType<any>;

  return (
    <>
      {/* Onboarding Modal */}
      <OnboardingModal open={showOnboardingMsg} onClose={closeOnboardingModal} />

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
    .section-header-with-button {
      flex-direction: column !important;
      align-items: center !important;
      text-align: center !important;
      gap: 1rem !important;
    }
    .section-header-with-button h2 {
      text-align: center !important;
    }
    .section-header-with-button p {
      text-align: center !important;
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
                    {/* REPLACE THIS BLOCK */}
                    {/* Old plain timer block: */}
                    {/*
<div
  style={{
    fontSize: '2rem',
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  }}
>
  Round {currentRound}/{roundsCount} - {getStatus()}
  <br />
  Time Left: {fmtTime(timeLeft)}
  {isResting && <div>Rest Time Left: {fmtTime(restTimeLeft)}</div>}
  {isPreRound && <div>Pre-Round Time Left: {fmtTime(preRoundTimeLeft)}</div>}
</div>
                    */}

                    {/* NEW: Use styled StatusTimer component */}
                    <StatusTimer
                      time={fmtTime(timeLeft)}
                      round={currentRound}
                      totalRounds={roundsCount}
                      status={getStatus()}
                      isResting={isResting}
                      restTimeLeft={restTimeLeft}
                      isPreRound={isPreRound}
                      preRoundTimeLeft={preRoundTimeLeft}
                      fmtTime={fmtTime}
                    />

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
                  {/* Compact Favorite Style, Streak Counter, and PWA Status */}
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    flexWrap: 'wrap'
                  }}>

                    

                    
                    {/* Stats only show if we have data */}
                    {homePageStats && (
                      <React.Fragment>
                      {/* Favorite Style */}
                      {favoriteConfig && (
                        <button
                          type="button"
                          onClick={() => setPage('logs')}
                          style={{
                            all: 'unset',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.375rem 0.625rem',
                            borderRadius: '9999px',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontSize: '0.8rem',
                            opacity: 0.9,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '0.9';
                            e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                          }}
                          title="Click to view workout logs"
                          aria-label={`Favorite style: ${favoriteConfig.label} - click to view workout logs`}
                        >
                          <ImageWithFallback
                            srcPath={favoriteConfig.iconPath}
                            alt={favoriteConfig.label}
                            emoji={favoriteConfig.emoji || '🎯'}
                            style={{ width: 14, height: 14, borderRadius: 3, objectFit: 'cover' }}
                          />
                          <span style={{ fontWeight: 600 }}>{favoriteConfig.label}</span>
                        </button>
                      )}
                      
                      {/* Streak Counter */}
                      <button
                        type="button"
                        onClick={() => setPage('logs')}
                        style={{
                          all: 'unset',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.375rem 0.625rem',
                          borderRadius: '9999px',
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: 'white',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          fontSize: '0.8rem',
                          opacity: 0.9,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.9';
                          e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                        }}
                        title="Click to view workout logs"
                        aria-label={`${homePageStats.current} day streak - click to view workout logs`}
                      >
                        <span role="img" aria-label="flame" style={{ fontSize: '0.9rem' }}>🔥</span>
                        <span style={{ fontWeight: 700 }}>{homePageStats.current}</span>
                      </button>
                      </React.Fragment>
                    )}
                  </div>
                  

                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                    {/* Step 1: Emphasis selection */}
                    <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      <div style={{ textAlign: 'center', position: 'relative' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', margin: '0 0 1rem 0' }}>Choose Your Fighting Style</h2>
                        <p style={{ color: '#f9a8d4', fontSize: '0.875rem', margin: 0 }}>
                        Select one or more styles to get started.
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
                  style={{ width: 48, height: 48, borderRadius:  8, objectFit: 'cover', display: 'inline-block' }}
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
  {/* More Button - Right Justified, Above Manage Techniques */}
  {emphasisList.length > 9 && (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: '1rem',
      paddingRight: '0.5rem'
    }}>
      <button
        type="button"
        onClick={() => setShowAllEmphases(v => !v)}
        style={{
          padding: '.75rem 1rem',
          borderRadius: '1rem',
          border: 'none',
          backgroundColor: 'transparent',
          color: '#f9a8d4',
          boxShadow: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 500,
          fontSize: '0.95rem',
          transition: 'all 0.2s',
          cursor: 'pointer',
          minWidth: 0,
          opacity: 1
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.backgroundColor = 'rgba(249, 168, 212, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.8';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        tabIndex={0}
        aria-label={showAllEmphases ? 'See less styles' : 'See more styles'}
        title={showAllEmphases ? 'Show fewer styles' : 'Show more styles'}
      >
        {showAllEmphases ? 'Less' : 'More'}
       

       

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

  {/* Manage Techniques Button - Center Justified, Below More Button */}
  <div 
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: '0.5rem',
      minHeight: '48px',
      paddingLeft: '0',
      paddingRight: '0',
      width: '100%'
    }}>
    <button
      onClick={() => {
        try { trackEvent(AnalyticsEvents.TechniqueEditorOpen); } catch {}
        setPage('editor');
      }}
      style={{
        padding: '.875rem 1.25rem',
        borderRadius: '1rem',
        border: '1px solid rgba(34, 211, 238, 0.2)',
        backgroundColor: 'rgba(34, 211, 238, 0.05)',
        color: '#f9a8d4',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontWeight: 500,
        fontSize: '0.95rem',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        minWidth: 0,
        opacity: 1,
        position: 'static',
        transform: 'none',
        left: 'auto',
        marginRight: '0',
        marginLeft: '0',
        textDecoration: 'none',
        outline: 'none',
        backdropFilter: 'blur(8px)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(34, 211, 238, 0.12)';
        e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.3)';
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(34, 211, 238, 0.05)';
        e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.2)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      }}
      title="Create custom techniques and modify existing ones"
    >
      <img
        src="/assets/icon_edit.png"
        alt=""
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          objectFit: 'cover'
        }}
        aria-hidden="true"
      />
      <span>Manage Techniques</span>
    </button>
  </div>

                    </div>
                  </section>



                  {/* Step 3: Rounds/Length/Rest */}
                  <section style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                    {/* Number of Rounds */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', textAlign: 'center', margin: 0 }}>Number of Rounds</h3>
                      <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      backgroundColor: 'rgba(255,255,255,0.1)',
      padding: '1rem 2rem',
      borderRadius: '1rem',
      border: '1px solid rgba(255,255,255,0.2)',
      minHeight: '70px'
    }}>
      <button type="button" onClick={() => setRoundsCount(Math.max(1, roundsCount - 1))} style={chipButtonStyle}>−</button>
      <div style={{ minWidth: '4rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white' }}>{roundsCount}</div>
        <div style={{ fontSize: '0.75rem', color: '#f9a8d4', marginTop: '0.25rem' }}>rounds</div>
      </div>
      <button type="button" onClick={() => setRoundsCount(Math.min(20, roundsCount + 1))} style={chipButtonStyle}>+</button>
    </div>
                    </div>

                    {/* Round Length */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', textAlign: 'center', margin: 0 }}>Round Length</h3>
                      <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      backgroundColor: 'rgba(255,255,255,0.1)',
      padding: '1rem 2rem',
      borderRadius: '1rem',
      border: '1px solid rgba(255,255,255,0.2)',
      minHeight: '70px'
    }}>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        className="round-length-input"
        value={roundMinInput}
        onChange={(e) => {
          const raw = e.target.value.replace(',', '.');
          if (/^\d*\.?\d*$/.test(raw)) {
            setRoundMinInput(raw);
          }
        }}
        onBlur={() => {
          let v = parseFloat(roundMinInput || '');
          if (Number.isNaN(v)) v = roundMin;
          v = Math.min(30, Math.max(0.25, v));
          const stepped = Math.round(v / 0.25) * 0.25;
          setRoundMin(stepped);
          setRoundMinInput(String(stepped));
        }}
        style={{
          width: '4rem',
          height: '3rem',
          textAlign: 'center',
          fontSize: '2rem',
          fontWeight: 700,
          borderRadius: '0.5rem',
          border: 'none',
          background: 'rgba(255,255,255,0.15)',
          color: 'white',
          boxShadow: 'none'
        }}
      />
      <div style={{ fontSize: '0.75rem', color: '#f9a8d4', marginTop: '0.25rem' }}>minutes</div>
    </div>
                    </div>

                    {/* Rest Time */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', textAlign: 'center', margin: 0 }}>Rest Time</h3>
                      <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      backgroundColor: 'rgba(255,255,255,0.1)',
      padding: '1rem 2rem',
      borderRadius: '1rem',
      border: '1px solid rgba(255,255,255,0.2)',
      minHeight: '70px'
    }}>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        className="rest-minutes-input"
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
          v = Math.min(10, Math.max(0.25, v));
          const stepped = Math.round(v / 0.25) * 0.25;
          setRestMinutes(stepped);
          setRestMinutesInput(String(stepped));
        }}
        style={{
          width: '4rem',
          height: '3rem',
          textAlign: 'center',
          fontSize: '2rem',
          fontWeight: 700,
          borderRadius: '0.5rem',
          border: 'none',
          background: 'rgba(255,255,255,0.15)',
          color: 'white',
          boxShadow: 'none'
        }}
      />
      <div style={{ fontSize: '0.75rem', color: '#f9a8d4', marginTop: '0.25rem' }}>minutes</div>
    </div>
                    </div>
                  </section>


                  
                  {/* Advanced Settings: Voice Speed and Selection */}
                  <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ ...linkButtonStyle, color: '#f9a8d4', fontSize: '0.875rem' }}>
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                  </button>
                  {showAdvanced && (
                    <div className="advanced-settings-panel" style={{ 
                      marginTop: '1rem', 
                      maxWidth: '32rem', 
                      marginLeft: 'auto', 
                      marginRight: 'auto',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      border: '1px solid rgba(96, 165, 250, 0.2)'
                    }}>
    
    {/* Training Options Section */}
    <div style={{ marginBottom: '2rem' }}>
      <h4 style={{ 
        color: '#60a5fa', 
        fontSize: '0.875rem', 
        fontWeight: 600, 
        margin: '0 0 1rem 0',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        Training Options
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Southpaw Mode toggle */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 500, color: '#f9a8d4', fontSize: '0.95rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={southpawMode}
              onChange={e => {
                const newValue = e.target.checked;
                setSouthpawMode(newValue);
                // Track southpaw mode toggle
                try {
                  trackEvent(AnalyticsEvents.SettingToggle, {
                    setting_name: 'southpaw_mode',
                    setting_value: newValue
                  });
                } catch (error) {
                  console.warn('Analytics tracking failed:', error);
                }
              }}
              style={{ 
                accentColor: '#60a5fa', 
                width: 18, 
                height: 18, 
                borderRadius: '4px',
                border: '2px solid rgba(96, 165, 250, 0.3)',
                cursor: 'pointer'
              }}
            />
            Southpaw Mode
          </label>
          <p style={{ 
            color: '#cbd5e1', 
            fontSize: '0.8rem', 
            margin: '0.25rem 0 0 2.5rem', 
            lineHeight: '1.4',
            textAlign: 'left'
          }}>
            Mirrors "Left" and "Right" in technique callouts for left-handed fighters
          </p>
        </div>
        
        {/* Calisthenics toggle */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 500, color: '#f9a8d4', fontSize: '0.95rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={addCalisthenics}
              onChange={e => setAddCalisthenics(e.target.checked)}
              style={{ 
                accentColor: '#60a5fa', 
                width: 18, 
                height: 18, 
                borderRadius: '4px',
                border: '2px solid rgba(96, 165, 250, 0.3)',
                cursor: 'pointer'
              }}
            />
            Include Calisthenics
          </label>
          <p style={{ 
            color: '#cbd5e1', 
            fontSize: '0.8rem', 
            margin: '0.25rem 0 0 2.5rem', 
            lineHeight: '1.4',
            textAlign: 'left'
          }}>
            Adds bodyweight exercises like jumping jacks and high knees to your workout
          </p>
        </div>
        
        {/* Read in order toggle */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 500, color: '#f9a8d4', fontSize: '0.95rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={readInOrder}
              onChange={e => setReadInOrder(e.target.checked)}
              style={{ 
                accentColor: '#60a5fa', 
                width: 18, 
                height: 18, 
                borderRadius: '4px',
                border: '2px solid rgba(96, 165, 250, 0.3)',
                cursor: 'pointer'
              }}
            />
            Read Techniques in Order
          </label>
          <p style={{ 
            color: '#cbd5e1', 
            fontSize: '0.8rem', 
            margin: '0.25rem 0 0 2.5rem', 
            lineHeight: '1.4',
            textAlign: 'left'
          }}>
            Calls techniques sequentially instead of randomly for structured practice
          </p>
        </div>
      </div>
    </div>

    {/* Voice Settings Section */}
    <div>
      <h4 style={{ 
        color: '#60a5fa', 
        fontSize: '0.875rem', 
        fontWeight: 600, 
        margin: '0 0 1rem 0',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        Voice Settings
      </h4>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      {/* Voice Dropdown */}
      <div style={{ flex: 2, minWidth: '180px' }}>
        <label htmlFor="voice-select" style={{ color: '#f9a8d4', fontWeight: 600, fontSize: '1rem', display: 'block', marginBottom: 4 }}>
          Voice
        </label>
        <select
          id="voice-select"
          value={voice?.name || ''}
          onChange={e => {
            const selected = voices.find(v => v.name === e.target.value) || null;
            
            if (selected) {
              const isEnglish = selected.lang.toLowerCase().startsWith('en');
              
              if (!isEnglish) {
                // Prevent selection of non-English voices and show warning
                console.warn('User attempted to select non-English voice:', selected.name, selected.lang);
                setVoiceCompatibilityWarning(`Cannot select "${selected.name}" - only English voices are supported for proper pronunciation of Muay Thai techniques. Please choose an English voice.`);
                return; // Don't set the voice
              }
              
              console.log('User selected English voice:', selected.name, selected.lang);
              setVoice(selected);
              saveVoicePreference(selected);
              
              // Check compatibility of the newly selected voice
              checkVoiceCompatibility(selected, voices);
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
            width: '100%',
            minWidth: '160px',
          }}
        >
          <option value="" disabled>Select a voice</option>
          {voices.map(v => {
            const isAmericanEnglish = v.lang.toLowerCase() === 'en-us' || 
                                    v.lang.toLowerCase() === 'en_us' ||
                                    v.lang.toLowerCase().startsWith('en-us') ||
                                    v.lang.toLowerCase().startsWith('en_us');
            const isOtherEnglish = v.lang.toLowerCase().startsWith('en') && !isAmericanEnglish;
            
            // More specific check for American English names (avoid false positives like "Australia")
            const isAmericanEnglishName = v.name.toLowerCase().includes('united states') ||
                                        v.name.toLowerCase().includes('us english') ||
                                        (v.name.toLowerCase().includes('english') && v.name.toLowerCase().includes(' us ')) ||
                                        (v.name.toLowerCase().includes('english') && v.name.toLowerCase().endsWith(' us'));
            
            let flag = '';
            if (isAmericanEnglish || isAmericanEnglishName) {
              flag = '🇺🇸 ';
            } else if (isOtherEnglish || v.name.toLowerCase().includes('english')) {
              flag = '🌐 ';
            }
            
            return (
              <option key={v.name} value={v.name} style={{ padding: '0.5rem 0.75rem' }}>
                {flag}{v.name} ({v.lang})
              </option>
            );
          })}
        </select>
      </div>
      {/* Test Voice Button */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', minWidth: '120px' }}>
        <button
          type="button"
          onClick={testVoice}
          style={{
            padding: '0.5rem 1.2rem',
            borderRadius: '0.5rem',
            border: '1px solid #60a5fa',
            background: 'linear-gradient(90deg, #60a5fa 0%, #818cf8 100%)',
            color: 'white',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(59,130,246,0.10)',
            width: '100%',
          }}
        >
          Test Voice
        </button>
      </div>
    </div>

    {/* Voice Compatibility Warning */}
    {voiceCompatibilityWarning && (
      <div style={{
        background: 'rgba(251, 191, 36, 0.1)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        borderRadius: '0.5rem',
        padding: '0.75rem',
        marginTop: '1rem',
        color: '#fbbf24',
        fontSize: '0.9rem',
        lineHeight: '1.5'
      }}>
        <strong>⚠️ Voice Notice:</strong> {voiceCompatibilityWarning}

      </div>
    )}

    {/* Voice Speed Slider */}
    <div style={{ marginBottom: '0.5rem' }}>
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
      <div style={{ color: '#f9a8d4', fontSize: '0.92rem', marginTop: '0.5rem', textAlign: 'left' }}>
        <span>
          <strong>Tip:</strong> {voiceCompatibilityWarning ? 
            'Voice issues detected. Try selecting an English voice or adjust the speed.' : 
            'All English voices work great for Muay Thai techniques. American English (🇺🇸) is preferred, but any English variant will provide clear pronunciation.'
          }
        </span>
        {!voices.length && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#fcd34d' }}>
            <strong>No voices available:</strong> Your system may not have text-to-speech support.
          </div>
        )}
      </div>
      </div>
    </div>
  )}


                  {/* Conditionally render Difficulty and Start button together in sticky bottom container */}
                  {!running && !isPreRound && hasSelectedEmphasis && (
                    <>
                      {/* Smooth, single-color gradient overlay from just above the container to the bottom */}
                      <div
                        style={{
                          position: 'fixed',
                          left: 0,
                          right: 0,
                          // Raise the overlay higher to accommodate the difficulty controls
                          top: `calc(70vh - 120px)`, // Adjusted to accommodate difficulty controls
                          bottom: 0,
                          zIndex: 998,
                          pointerEvents: 'none',
                          background: `
                            linear-gradient(
                              180deg,
                              rgba(24,24,36,0) 0%,
                              rgba(24,24,36,0.7) 100%
                            )
                          `,
                          opacity: 1,
                          transition: 'opacity 0.3s',
                        }}
                        aria-hidden="true"
                      />
                      
                      {/* Sticky bottom container with start button and difficulty controls */}
                      <div
                        style={{
                          position: 'fixed',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 999,
                          padding: '1rem 1rem 2.5rem 1rem',
                          background: 'linear-gradient(180deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.98) 100%)',
                          backdropFilter: 'blur(24px)',
                          borderTop: '1px solid rgba(255,255,255,0.12)',
                          boxShadow: '0 -8px 32px rgba(0,0,0,0.3), 0 -2px 8px rgba(0,0,0,0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.875rem'
                        }}
                      >
                        {/* Elegant difficulty selector */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: '0.625rem', 
                          width: '280px',
                          maxWidth: 'calc(100vw - 32px)',
                          margin: '0 auto',
                          padding: '0.75rem 0.625rem',
                          borderRadius: '1rem',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                          position: 'relative'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                          }}>
                            <label style={{ 
                              fontSize: '0.8rem', 
                              fontWeight: 500, 
                              color: 'rgba(255,255,255,0.9)', 
                              margin: 0,
                              letterSpacing: '0.025em',
                              textTransform: 'uppercase' 
                            }}>
                              Difficulty
                            </label>
                            <button
                              onClick={clearAllEmphases}
                              title="Clear all selections"
                              aria-label="Clear all emphasis selections"
                              style={{
                                position: 'absolute',
                                right: 0,
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '50%',
                                color: 'rgba(255,255,255,0.7)',
                                fontSize: '12px',
                                fontWeight: 400,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                padding: 0,
                                lineHeight: 1
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                                e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                              }}
                            >
                              ×
                            </button>
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            gap: '0.5rem'
                          }}>
                          <button 
                            className={`difficulty-btn ${difficulty === 'easy' ? 'active' : ''}`} 
                            onClick={() => setDifficulty('easy')} 
                            aria-pressed={difficulty === 'easy'}
                            style={{ 
                              flex: 1,
                              fontSize: '0.7rem', 
                              padding: '0.375rem 0.5rem',
                              borderRadius: '1rem',
                              opacity: difficulty === 'easy' ? 1 : 0.7,
                              fontWeight: difficulty === 'easy' ? 600 : 500
                            }}
                          >
                            Novice
                          </button>
                          <button 
                            className={`difficulty-btn ${difficulty === 'medium' ? 'active' : ''}`} 
                            onClick={() => setDifficulty('medium')} 
                            aria-pressed={difficulty === 'medium'}
                            style={{ 
                              flex: 1,
                              fontSize: '0.7rem', 
                              padding: '0.375rem 0.5rem',
                              borderRadius: '1rem',
                              opacity: difficulty === 'medium' ? 1 : 0.7,
                              fontWeight: difficulty === 'medium' ? 600 : 500
                            }}
                          >
                            Amateur
                          </button>
                            <button 
                              className={`difficulty-btn ${difficulty === 'hard' ? 'active' : ''}`} 
                              onClick={() => setDifficulty('hard')} 
                              aria-pressed={difficulty === 'hard'}
                              style={{ 
                                flex: 1,
                                fontSize: '0.7rem', 
                                padding: '0.375rem 0.5rem',
                                borderRadius: '1rem',
                                opacity: difficulty === 'hard' ? 1 : 0.7,
                                fontWeight: difficulty === 'hard' ? 600 : 500
                              }}
                            >
                              Pro
                            </button>
                          </div>
                        </div>

                        {/* Start button */}
                        <button 
                          onClick={startSession}
                          className="sticky-start-button"
                          style={{
                            all: 'unset',
                            width: '280px',
                            fontSize: '1.375rem',
                            fontWeight: 700,
                            color: 'white',
                            background: 'linear-gradient(135deg, #4ade80 0%, #22d3ee 50%, #3b82f6 100%)',
                            borderRadius: '1rem',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 12px 24px rgba(34,197,94,0.25), 0 6px 12px rgba(59,130,246,0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
                            padding: '0.875rem 2rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(.4,2,.3,1)',
                            maxWidth: 'calc(100vw - 32px)',
                            boxSizing: 'border-box',
                            textAlign: 'center',
                            display: 'inline-block',
                            letterSpacing: '0.025em',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 16px 32px rgba(34,197,94,0.35), 0 8px 16px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.3)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            e.currentTarget.style.boxShadow = '0 12px 24px rgba(34,197,94,0.25), 0 6px 12px rgba(59,130,246,0.2), inset 0 1px 0 rgba(255,255,255,0.2)';
                          }}
                        >
                          Let's Go!
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer stays visible on all pages */}
      <footer style={{ 
        textAlign: 'center', 
        marginTop: '4rem', 
        padding: '2rem', 
        paddingBottom: !isActive && hasSelectedEmphasis ? '200px' : '2rem',
        borderTop: '1px solid rgba(255,255,255,0.1)' 
      }}>
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
          <a
            href="https://www.instagram.com/nakmuayshotcaller?igsh=dTh6cXE4YnZmNDc4"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              opacity: 1,
              transition: 'opacity 0.2s',
              height: '32px',
              marginLeft: '0.5rem',
            }}
            aria-label="Instagram"
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <img
              src="/assets/icon.instagram.png"
              alt="Instagram"
              style={{
                height: '24px',
                width: '24px',
                objectFit: 'contain',
                borderRadius: '6px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
              }}
            />
          </a>
        </div>
      </footer>
    </div> {/* <-- This closes the <div style={{ position: 'relative', zIndex: 0 }}> */}
    
    {/* PWA Install Prompt - shows automatically after 30 seconds */}
    <PWAInstallPrompt
      isVisible={showPWAPrompt && !pwa.isInstalled}
      onInstall={async () => {
        try { 
          trackEvent(AnalyticsEvents.PWAInstallPrompt, { action: 'install_attempted' }); 
        } catch {}
        const success = await pwa.promptInstall();
        setShowPWAPrompt(false);
        return success;
      }}
      onDismiss={() => {
        try { 
          trackEvent(AnalyticsEvents.PWAInstallPrompt, { action: 'dismissed' }); 
        } catch {}
        setShowPWAPrompt(false);
      }}
      onDismissPermanently={() => {
        try { 
          trackEvent(AnalyticsEvents.PWAInstallPrompt, { action: 'dismissed_permanently' }); 
        } catch {}
        localStorage.setItem('pwa_install_dismissed', 'true');
        setShowPWAPrompt(false);
      }}
    />
    </>
  );
}

type WorkoutLogsProps = {
  onBack: () => void;
  emphasisList: { key: string; label: string; iconPath: string; emoji: string; desc: string; }[];
};