# iOS Background Music Compatibility Testing Instructions

## Problem Addressed
iOS users were reporting that their music (Spotify, Apple Music, etc.) was being cut off when they started a workout with the Shotcaller Nak Muay app. This issue was iOS-specific, as Android users could successfully continue their background music.

## Solution Implemented
The fix involves configuring iOS audio sessions to allow cooperative audio playback, meaning both the background music and the TTS callouts can play simultaneously without the TTS interrupting the music.

## Changes Made

### 1. Capacitor Configuration Update
- Updated `capacitor.config.ts` to configure the TextToSpeech plugin with iOS-specific audio session settings
- Uses `ambient` audio session category with `mixWithOthers` option

### 2. iOS Audio Session Hook
- Created `useIOSAudioSession.ts` hook that configures iOS audio sessions for cooperative playback
- Uses the custom AudioSessionManager plugin that's already implemented in the iOS native code

### 3. Audio Element Optimization
- Modified audio element initialization in `App.tsx` to use iOS-specific settings
- Reduced volume levels slightly on iOS to ensure better mixing with background music
- Added `webkit-playsinline` and `playsinline` attributes for iOS compatibility

## Testing Instructions

### For iOS Native App Testing:

1. **Prerequisites:**
   - iOS device with the Shotcaller Nak Muay app installed
   - Music app (Spotify, Apple Music, etc.)

2. **Test Scenario 1: Spotify Background Music**
   - Open Spotify on iOS device
   - Start playing any music
   - Open Shotcaller Nak Muay app
   - Configure a workout with TTS callouts enabled
   - Start the workout
   - **Expected Result:** Background music should continue playing at full volume while TTS callouts are heard clearly

3. **Test Scenario 2: Apple Music Background Music**
   - Open Apple Music on iOS device
   - Start playing any music
   - Open Shotcaller Nak Muay app
   - Configure a workout with TTS callouts enabled
   - Start the workout
   - **Expected Result:** Background music should continue playing at full volume while TTS callouts are heard clearly

4. **Test Scenario 3: Web Browser Music**
   - Open Safari and play music from YouTube or any music streaming website
   - Open Shotcaller Nak Muay app
   - Start a workout with TTS enabled
   - **Expected Result:** Background music should be less likely to be interrupted (though full compatibility may vary by browser)

### For iOS Safari/PWA Testing:

1. **In Safari:**
   - Open a music streaming website in one Safari tab
   - Start playing music
   - Open Shotcaller Nak Muay in another tab or as a PWA
   - Start a workout with TTS enabled
   - **Expected Result:** Improved compatibility compared to before the fix

### What to Look For:

✅ **Success Indicators:**
- Background music continues playing during TTS callouts
- Both audio sources are audible
- No volume reduction (ducking) of background music during TTS
- Smooth audio transitions

❌ **Failure Indicators:**
- Background music stops when workout starts
- Background music pauses during TTS announcements
- Background music volume significantly reduces during TTS
- Complete audio conflict causing crashes

## Fallback Behavior
If the iOS audio session configuration fails for any reason, the app falls back to the previous behavior where TTS might interrupt background music, but all core functionality remains intact.

## Build and Deployment

After making these changes:

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Sync with Capacitor:**
   ```bash
   npx cap sync
   ```

3. **Build for iOS:**
   ```bash
   npx cap build ios
   ```

4. **Test on device:**
   ```bash
   npx cap run ios
   ```

## Technical Notes

- The fix only affects iOS devices; Android behavior remains unchanged
- The native AudioSessionManager plugin is already implemented in the iOS codebase
- The audio volume is slightly reduced on iOS (bell: 0.3 instead of 0.5, warning: 0.2 instead of 0.4) to ensure better mixing
- Web version benefits from improved AudioContext handling for iOS Safari

## Rollback Instructions

If issues arise, the changes can be rolled back by:

1. Remove the `useIOSAudioSession` import and usage from `App.tsx`
2. Revert the audio element initialization to original volume levels
3. Remove the plugin configuration from `capacitor.config.ts`
4. Rebuild and redeploy

The native iOS files can remain as they won't affect the app if not actively used.