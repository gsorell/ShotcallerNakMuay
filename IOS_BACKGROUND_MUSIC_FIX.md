# iOS Background Music Compatibility Fix

## Problem
iOS users could not run the Shotcaller Nak Muay app while listening to Spotify or other background music apps simultaneously. This was due to iOS's strict audio session management where TTS (Text-to-Speech) would take exclusive control of the audio system.

## Solution Implemented

### 1. Capacitor TTS Plugin Configuration
**File: `capacitor.config.ts`**
- Added plugin configuration to use `ambient` audio session category
- Enabled `mixWithOthers` option to allow background music to continue

### 2. Custom iOS Audio Session Manager
**Files: `ios/App/App/AudioSessionManager.swift`, `ios/App/App/AudioSessionManagerPlugin.m`**
- Created native iOS plugin to explicitly configure audio session
- Uses `AVAudioSession.Category.ambient` with `.mixWithOthers` option
- Allows TTS to play while background music continues at reduced volume

### 3. Enhanced TTS Service
**File: `src/utils/ttsService.ts`**
- Added iOS-specific audio session management
- Improved Web Audio compatibility for iOS Safari
- Added cooperative AudioContext handling

### 4. iOS Audio Session Hook
**File: `src/hooks/useIOSAudioSession.ts`**
- Centralized iOS audio configuration logic
- Provides utilities for audio element configuration
- Handles platform detection and audio session setup

### 5. Audio Element Optimization
**File: `src/App.tsx`**
- Modified HTML Audio elements to be less intrusive on iOS
- Added `webkit-playsinline` and `playsinline` attributes
- Reduced volume levels on iOS for better mixing
- Improved audio unlock sequence to minimize background music interruption

## Technical Details

### Audio Session Categories
- **Before**: Used default TTS audio session (exclusive)
- **After**: Uses `ambient` category with `mixWithOthers` option

### Platform-Specific Behavior
- **Android**: No changes needed (already cooperative)
- **iOS Native**: Uses custom AudioSessionManager plugin
- **iOS Safari**: Enhanced Web Audio compatibility
- **Other platforms**: Maintains existing behavior

## Testing Instructions

### For iOS Native App:
1. Start playing music in Spotify/Apple Music
2. Open Shotcaller Nak Muay app
3. Start a workout with TTS enabled
4. Verify: Background music continues playing (possibly at reduced volume during TTS)

### For iOS Safari:
1. Start playing music in a background tab or native app
2. Open Shotcaller Nak Muay in Safari
3. Start a workout with TTS enabled
4. Verify: Background music is less likely to be interrupted

## Deployment Notes

### iOS Native App:
- The AudioSessionManager.swift and AudioSessionManagerPlugin.m files are automatically included
- No additional build steps required
- Configuration takes effect immediately on app launch

### Web Version:
- Changes are applied automatically
- No server-side configuration needed
- iOS Safari users will benefit immediately

## Rollback Instructions

If issues arise, the changes can be rolled back by:

1. Remove plugin configuration from `capacitor.config.ts`
2. Remove the `useIOSAudioSession` hook import from `App.tsx`
3. Revert audio element initialization in `App.tsx`
4. Remove iOS native files (optional, they won't affect the app if not used)

## Expected Behavior After Fix

### Successful Case:
- iOS user opens Spotify and starts playing music
- User opens Shotcaller Nak Muay and starts workout
- TTS announcements play while background music continues (ducked)
- Both audio sources coexist

### Fallback Case:
- If audio session configuration fails, app behaves as before
- TTS still works, but may interrupt background music
- No crash or functionality loss

This fix addresses the core iOS audio session management issue while maintaining backward compatibility and not affecting Android functionality.