# ShotcallerNakMuay Release Notes - Version 1.3.8

**Release Date:** November 3, 2025  
**Build:** 42  
**Platform:** Android (.aab)

## 🎵 **Major New Features**

### iOS Background Music Compatibility
- **Fixed**: iOS users can now run workouts while background music (Spotify, Apple Music, etc.) continues playing
- **Technical**: Implemented cooperative audio session management using Capacitor TextToSpeech plugin configuration
- **Impact**: Resolves the most requested iOS feature - no more interrupted music during training sessions

### Smart Auto-Pause System
- **New**: App automatically pauses when you navigate away (close browser, switch apps)
- **Why**: Prevents silent callout failures where voice stops but timer keeps running
- **Behavior**: Manual resume required when you return (prevents accidental workout continuation)

## 🔧 **Technical Improvements**

### Audio System Enhancements
- Added `useIOSAudioSession` hook for iOS-specific audio configuration
- Configured Capacitor with `ambient` audio session category and `mixWithOthers` option
- Optimized audio element volumes on iOS (30% bell, 20% warning) for better mixing
- Fixed round start bell initialization issue

### Visibility Management
- Implemented page visibility detection using `document.visibilitychange` events
- Smart pause logic that only triggers during active workouts (not rest periods)
- Maintains user control - no automatic resume to prevent accidental starts

### Code Quality
- Removed vestigial phone call detection code that was causing TypeScript errors
- Improved error handling in audio initialization
- Enhanced build process with proper iOS compatibility checks

## 📱 **Platform Compatibility**

### iOS (Native App)
- ✅ **Full background music compatibility** - music continues at full volume during TTS
- ✅ **Smart auto-pause** when switching apps
- ✅ **Cooperative audio session** management

### iOS (Safari/PWA)
- ✅ **Improved compatibility** with background audio (browser limitations may still apply)
- ✅ **Auto-pause functionality** when tab switching

### Android
- ✅ **No changes** - existing functionality maintained
- ✅ **Auto-pause** now available for consistency

### Web Browsers
- ✅ **Enhanced visibility handling** for all desktop browsers
- ✅ **Consistent auto-pause behavior** across platforms

## 🧪 **Testing Guidelines**

### For iOS Native App:
1. Start background music in Spotify/Apple Music
2. Open Shotcaller Nak Muay and start workout
3. Verify music continues at full volume during TTS callouts
4. Test app switching (both audio should coexist)

### For All Platforms:
1. Start a workout session
2. Navigate away from app (close browser/switch apps)
3. Return to app - should show paused state
4. Resume manually - callouts should continue normally

## 📦 **Deployment Files**

- `ShotcallerNakMuay-v1.3.8-ios-background-music-compatibility.aab` - Android App Bundle for Google Play
- Updated web assets automatically deployed to hosting platform

## ⚠️ **Known Considerations**

- **iOS Safari**: Background music compatibility depends on browser limitations
- **Manual Resume**: Auto-pause requires manual resume - this is intentional for user control
- **Web Audio**: Some browsers may still pause audio when tab is backgrounded (platform limitation)

## 🎯 **Impact Summary**

This release addresses the top user request from iOS users while adding intelligent session management for all platforms. The combination of background music compatibility and smart auto-pause creates a much more professional training experience that adapts to real-world usage patterns.

**Recommended for immediate deployment** - addresses critical user experience issue with no breaking changes to existing functionality.