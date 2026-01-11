# iOS Google Analytics Fix

## Problem
Google Analytics was not tracking events on iOS devices due to several issues:

1. **iOS WKWebView Restrictions**: iOS's WKWebView has Intelligent Tracking Prevention (ITP) that blocks third-party cookies and restricts `localStorage`/`sessionStorage`
2. **Storage Persistence**: `localStorage` and `sessionStorage` can be cleared by iOS between app sessions
3. **Network Security**: iOS requires explicit App Transport Security (ATS) configuration for external API calls
4. **Session Management**: Session IDs stored in `sessionStorage` were not persisting properly

## Solution Implemented

### 1. Capacitor Preferences Plugin
Replaced `localStorage` and `sessionStorage` with Capacitor's Preferences API, which:
- Uses native iOS storage (UserDefaults) that persists reliably
- Not affected by WebView privacy restrictions
- Survives app restarts and iOS memory management

### 2. Improved Storage Functions
- `getClientId()`: Now async, uses Preferences for native apps
- `getSessionId()`: Implements 30-minute session timeout with timestamp tracking
- Both functions have fallbacks for web platforms

### 3. iOS Info.plist Configuration
Added `NSAppTransportSecurity` settings to allow secure connections to:
- `google-analytics.com`
- `googleapis.com`

### 4. Enhanced Error Handling
- Better logging with platform information
- Visual indicators (✅/❌) for successful/failed events
- Detailed error messages for debugging

## Files Modified

### 1. `src/utils/analytics.ts`
- Added Capacitor Preferences import
- Made storage functions async
- Improved error handling and logging
- Added platform and version info to events

### 2. `package.json`
- Added `@capacitor/preferences@^8.0.0` dependency

### 3. `ios/App/App/Info.plist`
- Added `NSAppTransportSecurity` configuration for Google Analytics domains

## Testing Instructions

### Before Testing
1. Install dependencies: `npm install`
2. Sync iOS project: `npx cap sync ios`
3. Open in Xcode: `npx cap open ios`
4. Build and run on a physical iOS device or simulator

### Test Checklist

#### 1. Verify Analytics Initialization
Check Xcode console logs for:
```
[GA4] 📱 iOS detected - using Measurement Protocol
[GA4] Platform: ios
[GA4] isNativePlatform: true
[GA4] Retrieved existing client ID from Preferences
[GA4] Using existing session ID from Preferences
[GA4] Sending session_start event...
[GA4-MP] ✅ Event sent successfully: session_start
[GA4-MP] ✅ Event sent successfully: page_view
[GA4] ✅ iOS Analytics initialized successfully
```

#### 2. Verify Event Tracking
Trigger various events in the app (start workout, change settings, etc.) and check for:
```
[GA4-MP] Sending event: workout_start
[GA4-MP] Client ID: [timestamp].[random]
[GA4-MP] Session ID: [timestamp]
[GA4-MP] Platform: ios
[GA4-MP] Response status: 204
[GA4-MP] ✅ Event sent successfully: workout_start
```

#### 3. Google Analytics Real-Time View
1. Open Google Analytics (https://analytics.google.com)
2. Navigate to Reports > Realtime
3. Perform actions in the iOS app
4. Verify events appear within 30 seconds

#### 4. Session Persistence Test
1. Close the app completely (swipe up from multitasking)
2. Wait 10 seconds
3. Reopen the app
4. Check logs for "Using existing session ID" (should reuse session within 30 min)
5. Wait 31+ minutes and reopen
6. Check logs for "Created new session ID" (should create new session after timeout)

#### 5. Client ID Persistence Test
1. Close app completely
2. Restart device (optional but thorough)
3. Reopen app
4. Check logs for "Retrieved existing client ID from Preferences"
5. Client ID should match previous sessions

### Debug Mode
To enable verbose GA4 debug mode in Google Analytics:
1. Send events with `debug_mode: true` parameter
2. Use the GA4 DebugView in Google Analytics console

### Common Issues

#### Events Not Showing in Real-Time
- Wait up to 60 seconds (there can be a delay)
- Check Xcode console for error messages
- Verify internet connection on device
- Check that API secret is correct in `analytics.ts`

#### Storage Errors
If you see "Error managing client ID" or similar:
- Ensure `@capacitor/preferences` is properly installed
- Run `npx cap sync ios` again
- Clean and rebuild in Xcode

#### Network Errors
If you see "Failed to send event" with network errors:
- Verify Info.plist has correct NSAppTransportSecurity settings
- Check device internet connection
- Try on a different network (some corporate networks block analytics)

## Verification Commands

```bash
# Install dependencies
npm install

# Sync iOS with new plugin
npx cap sync ios

# Open in Xcode
npx cap open ios

# Build and run on device/simulator
# (Use Xcode UI to build and run)
```

## Expected Behavior

### First Launch
1. Generates new client ID and saves to Preferences
2. Creates new session ID with timestamp
3. Sends `session_start` event
4. Sends `page_view` event
5. Both events should show ✅ in console

### Subsequent Launches (within 30 min)
1. Retrieves existing client ID from Preferences
2. Reuses existing session ID (within timeout)
3. Sends events with same session ID

### After 30 Minutes
1. Retrieves existing client ID (persists forever)
2. Creates new session ID
3. Sends new `session_start` event

## Monitoring

### Console Logs to Watch
- `[GA4]` - Analytics initialization messages
- `[GA4-MP]` - Measurement Protocol event messages
- ✅ - Successful operations
- ❌ - Failed operations

### Key Metrics in Google Analytics
- **Active Users**: Should show iOS users in real-time
- **Events**: Should see session_start, page_view, workout_start, etc.
- **Platform**: Should correctly identify as "iOS"
- **App Version**: Should show current version (1.4.23)

## Rollback Instructions

If issues arise, you can revert changes:
```bash
git checkout HEAD -- src/utils/analytics.ts
git checkout HEAD -- ios/App/App/Info.plist
git checkout HEAD -- package.json
npm install
npx cap sync ios
```

## Additional Resources

- [GA4 Measurement Protocol Documentation](https://developers.google.com/analytics/devguides/collection/protocol/ga4)
- [Capacitor Preferences API](https://capacitorjs.com/docs/apis/preferences)
- [iOS App Transport Security](https://developer.apple.com/documentation/security/preventing_insecure_network_connections)
