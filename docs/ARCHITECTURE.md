# Nak Muay Shot Caller - Architecture Documentation

A comprehensive guide to the codebase structure, patterns, and systems used in the Nak Muay Shot Caller application.

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Feature Modules](#feature-modules)
5. [State Management](#state-management)
6. [Core Systems](#core-systems)
7. [Audio & TTS System](#audio--tts-system)
8. [Timer & Callout Engine](#timer--callout-engine)
9. [Technique Data System](#technique-data-system)
10. [PWA & Native Integration](#pwa--native-integration)
11. [Analytics](#analytics)
12. [Data Persistence](#data-persistence)
13. [Key Patterns & Conventions](#key-patterns--conventions)

---

## Overview

**Nak Muay Shot Caller** is a Muay Thai training timer application that calls out techniques using text-to-speech during shadowboxing or bagwork sessions. The app supports:

- Configurable round/rest timers
- Multiple fighting styles (emphases) with curated technique libraries
- Difficulty-based callout cadence (easy: 20/min, medium: 26/min, hard: 42/min)
- Custom technique editing
- Workout logging and statistics
- Cross-platform deployment (Web PWA, iOS, Android)

---

## Technology Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | React | 19.1.1 |
| Language | TypeScript | 5.9.3 |
| Bundler | Vite | 7.2.7 |
| Native Bridge | Capacitor | 8.x |
| Testing | Vitest | 4.0.15 |
| Linting | ESLint | 9.33.0 |

### Key Dependencies

```
react, react-dom     → UI framework
@capacitor/core      → Native bridge (iOS/Android)
@capacitor/preferences → Native storage
@anthropic-ai/capacitor-tts → Text-to-speech
html2canvas          → Screenshot capture for sharing
nosleep.js           → Prevent device sleep
```

---

## Project Structure

```
src/
├── main.tsx                 # React entry point with provider hierarchy
├── App.tsx                  # Main app component with routing
├── App.css                  # App-specific styles
├── index.css                # Global styles and animations
│
├── features/                # Feature-based code organization
│   ├── shared/              # Cross-feature utilities
│   │   ├── components/      # Shared UI components
│   │   ├── contexts/        # Global state (TTS, UI)
│   │   └── hooks/           # Reusable hooks (12+)
│   │
│   ├── workout/             # Timer and session management
│   │   ├── components/      # Timer UI components
│   │   ├── contexts/        # WorkoutProvider
│   │   └── hooks/           # Timer, settings, callout hooks
│   │
│   ├── technique-editor/    # Technique management
│   │   ├── components/      # Editor UI
│   │   ├── hooks/           # Technique data hooks
│   │   └── utils/           # Group sorting
│   │
│   └── logs/                # Workout history
│       ├── components/      # Logs and completion UI
│       └── hooks/           # Statistics calculations
│
├── constants/               # Configuration constants
│   ├── storage.ts           # Storage keys and defaults
│   └── techniques.ts        # Initial technique library
│
├── types/                   # TypeScript definitions
│   └── index.ts             # EmphasisKey, Difficulty, Page, etc.
│
├── utils/                   # Utility functions
│   ├── analytics.ts         # GA4 event tracking
│   ├── ttsService.ts        # TTS abstraction layer
│   ├── techniqueUtils.ts    # Pool generation
│   ├── logUtils.ts          # Workout log creation
│   ├── userSettingsManager.ts # Settings persistence
│   └── ...                  # Other utilities
│
└── assets/                  # Static assets
```

---

## Feature Modules

### Shared (`features/shared/`)

Cross-cutting utilities used by all other features.

**Components:**
- `AppLayout` - Main layout wrapper with header/footer
- `Header` - Top navigation with logo and help button
- `Footer` - Bottom navigation tabs
- `OnboardingModal` - Help instructions modal
- `PWAInstallPrompt` - App installation prompt UI

**Contexts:**
- `TTSProvider` - Text-to-speech state and controls
- `UIProvider` - Navigation, modals, and UI state

**Hooks (12+):**
| Hook | Purpose |
|------|---------|
| `useTTS` | Browser/Capacitor TTS abstraction |
| `useAudioSystem` | Unified audio (TTS + SFX + platform) |
| `useSoundEffects` | Bell and warning sounds |
| `useWakeLock` | Prevent device sleep |
| `usePWA` | PWA installation detection |
| `usePhoneCallDetection` | Auto-pause on incoming calls |
| `useNavigationGestures` | Mobile back button handling |
| `useVisibilityManager` | App visibility changes |
| `useUserEngagement` | Track user interaction metrics |
| `useAndroidAudioDucking` | Android volume management |
| `useIOSAudioSession` | iOS audio session config |
| `useSystemServices` | Initialize all platform services |

---

### Workout (`features/workout/`)

The core timer and session management system.

**Components:**
- `WorkoutSetup` - Pre-session configuration (rounds, rest, emphases)
- `ActiveSessionUI` - Live timer display during workout
- `StatusTimer` - Countdown timer component
- `StickyStartControls` - Start/pause/stop button bar
- `WorkoutConfiguration` - Settings panel
- `AdvancedSettingsPanel` - Southpaw mode, calisthenics, etc.

**Context:**
- `WorkoutProvider` - Central workout state orchestrator

**Hooks:**
- `useWorkoutTimer` - Timer state machine (pre-round → round → rest → complete)
- `useWorkoutSettings` - All workout configuration state
- `useCalloutEngine` - Technique callout scheduler with TTS

---

### Technique Editor (`features/technique-editor/`)

Manage and customize the technique library.

**Components:**
- `TechniqueEditor` - Main editor interface
- `TechniqueListSection` - Grouped technique display
- `TechniqueGroupPanel` - Editable group with add/delete
- `EmphasisSelector` - Multi-select emphasis buttons

**Hooks:**
- `useTechniqueData` - Load/persist techniques with versioning
- `useEmphasisList` - Generate emphasis options from techniques
- `useTechniqueEditor` - Editor UI state

---

### Logs (`features/logs/`)

Workout history and completion screens.

**Components:**
- `WorkoutLogs` - List of past workouts with filtering
- `WorkoutCompleted` - Post-workout summary screen

**Hooks:**
- `useHomeStats` - Calculate streak, most common emphasis, etc.

---

## State Management

The app uses a **three-context architecture** with React Context API:

```
                    main.tsx
                        │
          ┌─────────────┼─────────────┐
          │             │             │
    TTSProvider    UIProvider   WorkoutProvider
          │             │             │
          └─────────────┼─────────────┘
                        │
                      App.tsx
```

### TTSProvider
Manages text-to-speech state:
- Available voices and current selection
- `speak()`, `speakSystem()`, `speakSystemWithDuration()` methods
- Voice compatibility warnings
- Browser/Capacitor TTS abstraction

### UIProvider
Manages UI state:
- Current page (`timer`, `editor`, `logs`, `completed`)
- Modal visibility (onboarding, PWA prompt, advanced settings)
- Last workout data for completion screen
- Stats refresh trigger

### WorkoutProvider
The main orchestrator that composes:
- `useWorkoutSettings` - Configuration state
- `useWorkoutTimer` - Timer state machine
- `useCalloutEngine` - Technique callouts
- `useTechniqueData` - Technique library
- `useAudioSystem` - Audio controls
- `usePhoneCallDetection` - Call interruption
- `useWakeLock` - Screen wake lock

---

## Core Systems

### Navigation System

Custom page-based routing without a router library:

```typescript
type Page = "timer" | "editor" | "logs" | "completed";

// In UIProvider:
const [page, setPage] = useState<Page>("timer");

// Usage:
setPage("logs");  // Navigate to workout logs
```

Navigation is handled in `App.tsx` via a switch statement in `renderPageContent()`.

### Status System

The workout status is derived from timer state:

```typescript
type Status = "ready" | "running" | "paused" | "resting" | "pre-round";

const status = useMemo(() => {
  if (timer.isPreRound) return "pre-round";
  if (!timer.running) return "ready";
  if (timer.paused) return "paused";
  if (timer.isResting) return "resting";
  return "running";
}, [timer]);
```

---

## Audio & TTS System

### Architecture

```
useAudioSystem()
    │
    ├── useTTSContext()        → Text-to-speech
    │       └── useTTS()       → Browser/Capacitor abstraction
    │
    ├── useSoundEffects()      → Bell and warning sounds
    │
    └── platform
            ├── useAndroidAudioDucking()
            └── useIOSAudioSession()
```

### TTS Flow

1. **Voice Selection** - User selects from English voices
2. **Speak Request** - `speakSystemWithDuration(text, rate, onEnd)`
3. **Platform Detection** - Browser Web Speech API or Capacitor TTS
4. **Duration Measurement** - Callback with actual speech duration for scheduling

### Audio Unlocking (iOS Safari)

iOS Safari requires user gesture to unlock audio. The app handles this:

```typescript
// In startSession():
tts.ensureTTSUnlocked();      // Synchronous - must be in gesture handler
await sfx.ensureMediaUnlocked(); // Unlock sound effects
```

### Sound Effects

| Sound | File | Purpose |
|-------|------|---------|
| Bell | `big-bell-330719.mp3` | Round start/end |
| Warning | `interval.mp3` | 5-second rest warning |

---

## Timer & Callout Engine

### Timer State Machine

```
[Ready] → startTimer() → [Pre-Round 5s countdown]
                                ↓
                         [Round Active] ← onRoundStart (bell)
                                ↓ timeLeft === 0
                         onRoundEnd (bell)
                                ↓
                    ┌─ if currentRound < roundsCount ─┐
                    ↓                                  ↓
              [Rest Period]                   onWorkoutComplete
                    ↓                            [Ready]
         10s → onRestWarning (TTS "10 seconds")
          5s → onRestBell (warning sound)
          0s → onRestEnd → [Pre-Round] → [Round Active]
```

### Callout Engine Algorithm

The `useCalloutEngine` hook manages technique callouts:

1. **Cadence Calculation**
   ```typescript
   const cadencePerMin =
     difficulty === "easy" ? 20 :
     difficulty === "hard" ? 42 : 26;
   const baseDelayMs = 60000 / cadencePerMin;
   ```

2. **Technique Selection**
   - Sequential mode: Walk through pool in order
   - Random mode: Random selection from pool

3. **Southpaw Mode**
   - Mirrors left/right in technique names
   - Uses `mirrorTechnique(text, style)` utility

4. **Scheduling**
   - Measures actual TTS duration
   - Calculates next delay: `actualDuration + buffer + jitter`
   - Respects timing cap based on difficulty

---

## Technique Data System

### Structure

```typescript
interface TechniqueGroup {
  label: string;
  title: string;
  description: string;
  singles: string[];     // Single techniques
  combos: string[];      // Combination sequences
  exclusive?: boolean;   // If true, only this group when selected
}

// Storage format
Record<string, TechniqueGroup>
```

### Built-in Emphases (Fighting Styles)

| Key | Title | Focus |
|-----|-------|-------|
| `newb` | Nak Muay Newb | Basic strikes and defense |
| `khao` | Muay Khao | Clinch and knees |
| `mat` | Muay Mat | Heavy hands with kicks |
| `tae` | Muay Tae | Kicking specialist |
| `femur` | Muay Femur | Technical timing and counters |
| `sok` | Muay Sok | Elbows and close-range |
| `boxing` | Boxing | Fundamental boxing |
| `two_piece` | Two-Piece Combos | Short 2-strike combos |
| `southpaw` | Southpaw | Left-handed stance |
| `meat_potatoes` | Meat & Potatoes | Classic high-percentage |
| `buakaw` | Buakaw's Corner | Aggressive clinch/knees |
| `low_kick_legends` | Low Kick Legends | Dutch-style low kicks |
| `elbow_arsenal` | Elbow Arsenal | Close-range elbows |
| `ko_setups` | KO Setups | Knockout combinations |
| `tricky_traps` | Tricky Traps | Spinning techniques |
| `feints_and_fakeouts` | Feints and Fakeouts | Deceptive setups |
| `dutch_kickboxing` | Dutch Kickboxing | High-pressure volume |

### Pool Generation

```typescript
generateTechniquePool(
  techniques,        // All technique groups
  selectedEmphases,  // Which emphases are active
  addCalisthenics,   // Include calisthenics
  techniqueIndex     // Lookup index
): TechniqueWithStyle[]
```

---

## PWA & Native Integration

### PWA Configuration

**manifest.json:**
- Display: `standalone`
- Icons: 48-512px in webp format
- Shortcuts: Quick Start Timer, View Logs

**Service Worker (sw.js):**
- Cache-first for static assets
- Network-first for HTML/JS
- Audio file caching
- Offline fallback to index.html

### Capacitor Native Bridge

```typescript
// capacitor.config.ts
{
  appId: "com.shotcallernakmuay.app",
  webDir: "dist",
  plugins: {
    StatusBar: { style: "dark", backgroundColor: "transparent" }
  }
}
```

**Native Plugins Used:**
- `@capacitor/preferences` - Native key-value storage
- `@capacitor/status-bar` - Status bar styling
- `@capacitor-community/text-to-speech` - Native TTS
- `@capacitor/share` - Share workout results
- `@anthropic-ai/capacitor-tts` - Enhanced TTS

### Platform-Specific Handling

| Feature | iOS | Android | Web |
|---------|-----|---------|-----|
| TTS | Capacitor TTS | Web Speech API | Web Speech API |
| Audio Ducking | N/A | AudioFocus API | N/A |
| Wake Lock | Native | WakeLock API | NoSleep.js |
| Call Detection | Native API | Native API | N/A |

---

## Analytics

### Google Analytics 4 Integration

```typescript
// analytics.ts
export const GA_MEASUREMENT_ID = "G-5GY5JTX5KZ";

// Event tracking
trackEvent(AnalyticsEvents.WorkoutStart, {
  selected_emphases: [...],
  difficulty: "medium",
  rounds: 5
});
```

**Events Tracked:**
- Workout lifecycle (start, pause, resume, stop, complete)
- Settings changes (emphasis, difficulty)
- Navigation (page changes)
- PWA installation flow

**Platform Handling:**
- Web/Android: Standard gtag.js
- iOS Native: Measurement Protocol via CapacitorHttp (bypasses CORS)

---

## Data Persistence

### Storage Keys

```typescript
// constants/storage.ts
TECHNIQUES_STORAGE_KEY    = "shotcaller_techniques"
TECHNIQUES_VERSION_KEY    = "shotcaller_techniques_version"
WORKOUTS_STORAGE_KEY      = "shotcaller_workouts"
VOICE_STORAGE_KEY         = "shotcaller_voice_preference"
USER_SETTINGS_STORAGE_KEY = "shotcaller_user_settings"
```

### Default Settings

```typescript
const DEFAULT_USER_SETTINGS = {
  roundMin: 3,           // 3-minute rounds
  restMinutes: 1,        // 1-minute rest
  voiceSpeed: 1,         // Normal speed
  roundsCount: 5         // 5 rounds
};
```

### Workout Log Entry

```typescript
interface WorkoutLogEntry {
  timestamp: number;
  emphases: string[];
  difficulty: Difficulty;
  shotsCalledOut: number;
  roundsCompleted: number;
  roundsPlanned: number;
  roundLengthMin: number;
  restMinutes: number;
  status: "completed" | "abandoned";
  settings: { selectedEmphases, addCalisthenics, readInOrder, southpawMode };
}
```

---

## Key Patterns & Conventions

### 1. Ref Pattern for Callbacks

To avoid stale closures in timeouts/intervals, refs sync with state:

```typescript
const southpawModeRef = useRef(southpawMode);
useEffect(() => {
  southpawModeRef.current = southpawMode;
}, [southpawMode]);

// In timeout callback:
const mirrored = southpawModeRef.current
  ? mirrorTechnique(text)
  : text;
```

### 2. Feature-Based Organization

Code is organized by feature, not by type:

```
features/workout/
  ├── components/     # UI specific to workout
  ├── contexts/       # Workout state
  └── hooks/          # Workout logic
```

### 3. Context Composition

WorkoutProvider composes multiple hooks rather than managing everything directly:

```typescript
const settings = useWorkoutSettings(...);
const timer = useWorkoutTimer(...);
const calloutEngine = useCalloutEngine({ timer, settings, ... });
```

### 4. Memoization Strategy

- Contexts memoize value objects to prevent re-renders
- `useMemo` for derived values (status, pools)
- `useCallback` for handlers passed to children

### 5. Type Safety

Strict TypeScript with custom types:

```typescript
type EmphasisKey = "khao" | "mat" | "tae" | ...;
type Difficulty = "easy" | "medium" | "hard";
type Page = "timer" | "editor" | "logs" | "completed";
```

### 6. Audio Unlock Pattern

iOS Safari requires synchronous audio unlock during user gesture:

```typescript
const startSession = useCallback(async () => {
  // CRITICAL: TTS unlock must be synchronous - no await before!
  tts.ensureTTSUnlocked();
  await sfx.ensureMediaUnlocked();
  // ... rest of setup
}, []);
```

---

## Development Commands

```bash
# Development
npm run dev           # Start Vite dev server

# Build
npm run build         # Production build to dist/

# Testing
npm test              # Run Vitest tests

# Native
npx cap sync          # Sync web assets to native projects
npx cap open ios      # Open Xcode
npx cap open android  # Open Android Studio
```

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| No router library | Simple page-based nav, reduces bundle size |
| Context over Redux | App state is relatively simple, contexts suffice |
| Capacitor over React Native | Share web codebase, simpler native bridge |
| localStorage over IndexedDB | Simple key-value needs, sync API |
| Feature-based structure | Collocate related code, clear boundaries |
| Hooks over classes | Modern React patterns, easier composition |

---

*Last updated: January 2026*
*App Version: 1.4.24*
