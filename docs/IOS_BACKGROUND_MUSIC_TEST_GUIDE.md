# iOS Background Music Compatibility Testing Instructions

## Problem Addressed
iOS users were reporting that their music (Spotify, Apple Music, etc.) was being cut off when they started a workout with the Shotcaller Nak Muay app. This issue was iOS-specific, as Android users could successfully continue their background music.

## Solution Implemented
The fix involves configuring iOS audio sessions to allow cooperative audio playback (mixing). This means both the background music and the TTS callouts can play simultaneously at their respective volumes without one interrupting the other.

## Changes Made

### 1. iOS Audio Session Configuration
- Updated `AppDelegate.swift` to configure AVAudioSession with `.mixWithOthers` option
- Uses `.playback` category with `.spokenAudio` mode for optimal TTS delivery
- Allows simultaneous playback of background music and TTS callouts
- Added `UIBackgroundModes` with `audio` in `Info.plist` to enable background audio handling

### 2. Audio Mixing Approach
- No audio focus management - both apps play simultaneously
- User can control background music volume independently
- TTS plays at configured volume without affecting other audio
- Simple, predictable behavior that works consistently

### 3. iOS Audio Session Hook
- Created `useIOSAudioSession.ts` hook for iOS-specific audio configuration
- Handles cooperative audio session management
- Configures audio elements with iOS-specific attributes for compatibility

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
   - **Expected Result:** Background music should continue playing at full volume while TTS callouts play simultaneously. Both audio streams are audible. User can adjust Spotify volume if needed to hear callouts better.

3. **Test Scenario 2: Apple Music Background Music**
   - Open Apple Music on iOS device
   - Start playing any music
   - Open Shotcaller Nak Muay app
   - Configure a workout with TTS callouts enabled
   - Start the workout
   - **Expected Result:** Background music should continue playing at full volume while TTS callouts play simultaneously. Both audio streams are audible. User can adjust Apple Music volume if needed to hear callouts better.

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
- Background music continues playing during TTS callouts (not stopped or paused)
- Both audio streams play simultaneously at their set volumes
- TTS callouts are audible alongside the music
- User can control background music volume independently via their music app
- No audio interruptions or conflicts

❌ **Failure Indicators:**
- Background music stops completely when workout starts
- Background music pauses when TTS plays
- App takes exclusive audio control preventing other audio
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

- **iOS**: Uses AVAudioSession with `.mixWithOthers` option - allows simultaneous playback without interruption
- **Android**: Native apps automatically support audio mixing - no special configuration needed
- Both platforms allow background music and TTS to play simultaneously at their respective volumes
- No audio focus management - simple cooperative audio playback
- Users can control background music volume via their music app at any time
- Web/PWA version benefits from improved audio session handling

## Rollback Instructions

If issues arise, the changes can be rolled back by:

1. Remove the `useIOSAudioSession` import and usage from `App.tsx`
2. Revert the audio element initialization to original volume levels
3. Remove the plugin configuration from `capacitor.config.ts`
4. Rebuild and redeploy

The native iOS files can remain as they won't affect the app if not actively used.