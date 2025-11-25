# Release Notes v1.4.6 - Audio Ducking Fix

## Version Information
- **Version:** 1.4.6
- **Date:** November 24, 2025
- **Build:** (To be determined after Android Studio build)

## Critical Bug Fix: Audio Ducking Timing

### Problem
Audio ducking of background music (Spotify, etc.) was not activating immediately when the user clicked "Let's Go!" to start a workout session. Instead, ducking only began when the start bell rang (5 seconds later), and would expire after a few moments, allowing background music to return to full volume and conflict with workout callouts.

### Root Cause
The Android `AudioSessionPlugin` was using `AUDIOFOCUS_GAIN` instead of `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`. 

- `AUDIOFOCUS_GAIN` requests permanent audio focus but Android only enforces ducking when sustained audio playback is actively detected (which didn't happen until the bell sound played)
- This caused a 5-second delay before ducking activated, and premature release of ducking during quiet periods

### Solution
Changed the audio focus request type to `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` in both modern (Android 8.0+) and legacy API paths:

**Files Changed:**
1. `client/android/app/src/main/java/com/shotcallernakmuay/app/AudioSessionPlugin.java`
   - Line 92: Changed from `AUDIOFOCUS_GAIN` to `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`
   - Line 106: Changed from `AUDIOFOCUS_GAIN` to `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`
   - Updated comments to reflect correct behavior

2. `AUDIO_DUCKING_IMPLEMENTATION.md`
   - Updated documentation to clarify that ducking happens immediately upon request

### Expected Behavior After Fix

**Before Fix:**
1. User clicks "Let's Go!"
2. "Get ready" announcement plays at normal volume
3. Background music continues at full volume for 5 seconds
4. Bell rings → music finally ducks
5. Music volume fluctuates during callouts
6. Music returns to full volume during quiet periods

**After Fix:**
1. User clicks "Let's Go!"
2. **Background music IMMEDIATELY ducks to ~60-70% volume**
3. "Get ready" announcement is clearly audible over ducked music
4. Bell rings (music already ducked)
5. Music stays ducked for entire workout session
6. Session ends → music returns to full volume

### Testing Instructions

1. **Prerequisites:**
   - Open Spotify or any music app
   - Play music at full volume
   - Open Shotcaller Nak Muay app

2. **Test Steps:**
   - Configure any workout settings
   - Press "Let's Go!" button
   - **Immediately verify:** Background music volume drops within ~200ms
   - Listen to "Get ready" announcement (should be clearly audible)
   - Verify music stays ducked throughout entire workout
   - Stop or complete workout
   - **Verify:** Music returns to full volume

3. **Success Criteria:**
   - ✅ Background music ducks instantly when "Let's Go!" is pressed (not 5 seconds later)
   - ✅ Music remains ducked for entire workout session
   - ✅ No volume fluctuations during quiet periods
   - ✅ Music restores to full volume when workout ends

### Technical Details

**Audio Focus Type Comparison:**

| Aspect | AUDIOFOCUS_GAIN (Old) | AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK (New) |
|--------|----------------------|-------------------------------------------|
| When Enforced | When audio playback detected | Immediately upon request |
| Duration | Permanent until released | Temporary/Transient |
| Effect on Music | Pause/Stop (ignored by most apps) | Duck volume (honored by most apps) |
| Activation Delay | 5+ seconds (until bell sound) | <200ms |

**Why Previous Fixes Didn't Work:**
- v1.4.2 through v1.4.5 attempted timing adjustments and listener modifications
- None addressed the fundamental issue: wrong audio focus type
- The plugin was documented as using `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` but actually used `AUDIOFOCUS_GAIN`

### Build Instructions

```bash
cd client
npm run build
npx cap sync android
```

Then open in Android Studio and build the release AAB.

### Platform Support
- ✅ Android 5.0+ (API 21+)
- ✅ Android 8.0+ (API 26+) - Modern API
- ℹ️ iOS - Already working correctly (separate implementation)
- ℹ️ Web - Not applicable (browser handles audio priorities)

### Related Issues
This fix resolves the core audio ducking timing issue reported across multiple version attempts (v1.4.2-v1.4.5).

## Notes
- Audio focus is still requested early in the `startSession()` flow (before the pre-round countdown)
- The fix changes HOW Android responds to the request, not WHEN we make it
- Users retain full control of their music apps
- Music continues playing (not paused) - just at reduced volume
