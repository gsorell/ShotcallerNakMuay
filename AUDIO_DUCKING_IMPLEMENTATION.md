# Audio Ducking Implementation - v1.4.2

## Overview
Implemented session-duration audio ducking to ensure workout callouts are audible when playing background music from Spotify or other music apps.

## Changes Made

### 1. Custom Android Audio Focus Plugin
**File:** `client/android/app/src/main/java/com/shotcallernakmuay/app/AudioSessionPlugin.java`

- Created a custom Capacitor plugin for Android audio focus management
- Uses `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` to request audio focus
- This signals to other apps (Spotify, etc.) to lower their volume to ~60-70%
- Audio focus is held for the entire workout session
- Released when the workout ends, restoring full music volume

**Key Methods:**
- `startSession()` - Requests audio focus with ducking
- `endSession()` - Releases audio focus, restoring music volume
- `hasAudioFocus()` - Checks current focus state

### 2. Plugin Registration
**File:** `client/android/app/src/main/java/com/shotcallernakmuay/app/MainActivity.java`

- Registered the custom plugin in the main activity
- Plugin is automatically loaded when the app starts

### 3. TypeScript Hook
**File:** `client/src/hooks/useAudioSession.ts`

- Created React hook to interface with the native plugin
- Provides clean API: `startSession()`, `endSession()`, `isSessionActive()`
- Handles errors gracefully - app continues if audio focus fails
- Ensures cleanup on component unmount

### 4. Integration with Workout Timer
**File:** `client/src/App.tsx`

- Added `useAudioSession` hook initialization
- **Start:** Audio session begins when "Let's Go!" button is pressed
- **End:** Audio session ends when:
  - User manually stops the workout
  - Workout completes all rounds naturally
- Audio focus is held throughout the entire session (no fluctuations)

## User Experience

### Before
- Spotify/music plays at full volume
- TTS callouts are difficult to hear
- Users miss important timing cues

### After
- When workout starts: Background music automatically lowers to ~60-70% volume
- Music stays at this level for the entire workout
- TTS callouts are clearly audible
- When workout ends: Music automatically returns to full volume
- **No constant volume fluctuations** - just one adjustment at start, one at end

## Technical Details

### Audio Focus Type
Using `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`:
- **Transient:** Focus is temporary (for the workout duration)
- **May Duck:** Asks other apps to lower (not pause) their audio
- Standard practice for navigation/fitness apps

### Platform Support
- **Android:** Full implementation using AudioManager API
- **iOS:** Already handled by existing `useIOSAudioSession` hook
- **Web:** No changes needed (browser handles audio priorities)

### Compatibility
- Android 5.0+ (API 21+)
- Modern API for Android 8.0+ (API 26+)
- Fallback for older Android versions included

## Testing Instructions

### Build & Deploy
```bash
cd client
npm run build
npx cap sync android
```

### Test Scenario
1. Open Spotify and start playing music
2. Open Shotcaller Nak Muay app
3. Configure a workout (any settings)
4. Press "Let's Go!" button
5. **Expected:** Music volume drops to ~60-70%
6. Listen for callouts during workout
7. **Expected:** All callouts are clearly audible
8. Stop or complete the workout
9. **Expected:** Music volume returns to 100%

### Verification
- Music should stay at reduced volume for entire workout
- No volume fluctuations during callouts
- Clean restore to full volume when session ends

## Version Info
- **Version:** 1.4.2
- **Build:** (To be determined after build)
- **Feature:** Audio ducking for workout sessions

## Notes
- Audio focus request is non-blocking - app continues if it fails
- Other apps may ignore ducking requests (rare)
- Users retain full control of their music app
- Music continues playing (not paused) - just quieter
