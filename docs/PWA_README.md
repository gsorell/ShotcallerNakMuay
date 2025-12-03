# PWA Integration for Shotcaller Nak Muay

This document explains the Progressive Web App (PWA) features added to enhance user engagement and provide a native app-like experience.

## Features Implemented

### 1. **Smart Install Prompting**
- **Non-intrusive**: Only shows install prompts to engaged users
- **Engagement-based triggers**:
  - Users with 2+ visits
  - Users who spend 2+ minutes on the site
  - Users who complete at least one workout
  - Users who spend 30+ seconds in current session

### 2. **Service Worker for Offline Functionality**
- Caches essential assets (hero images, logo, audio files)
- Enables offline access to core functionality
- Optimized caching strategy:
  - Static assets: Cache-first
  - Audio files: Cache-first (important for training sessions)
  - HTML/JS/CSS: Network-first with cache fallback

### 3. **Web App Manifest**
- Standalone app appearance when installed
- Custom app icons and branding
- Shortcuts for quick actions (Timer, Logs)
- Proper PWA metadata for app stores

### 4. **User Engagement Tracking**
- Tracks visit count, time on site, completed workouts
- Used to determine optimal timing for install prompts
- Respects user dismissal (won't prompt again for 7 days)

## Technical Implementation

### Files Added:
- `/public/manifest.json` - PWA manifest configuration
- `/public/sw.js` - Service worker for caching and offline functionality
- `/src/hooks/usePWA.ts` - React hook for PWA functionality
- `/src/components/PWAInstallPrompt.tsx` - Install prompt UI component
- `/src/components/PWAStatus.tsx` - Shows install status indicator

### Integration Points:
- Added to `App.tsx` with engagement tracking
- Manifest linked in `index.html`
- Service worker auto-registers on app start

## User Experience Flow

### First Visit:
1. User arrives at the site
2. Service worker registers and begins caching assets
3. No install prompt shown (allows exploration)

### Engaged User:
1. User meets engagement criteria (time spent, return visit, or completed workout)
2. Install prompt appears at bottom of screen
3. User can install immediately or dismiss

### Installed User:
1. App runs in standalone mode (no browser UI)
2. Better audio handling for workout sessions
3. Faster loading from cached assets
4. PWA status indicator shows "App Installed"

## Benefits for Users

### Performance:
- **Faster loading**: Cached assets load instantly
- **Better audio**: No browser interference with workout audio
- **Offline access**: Core functionality works without internet

### User Experience:
- **Native feel**: Runs like a native app when installed
- **Home screen access**: Quick access via app icon
- **Full screen**: No browser UI distractions during workouts

### Engagement:
- **Visual commitment**: Having the app icon increases likelihood of return
- **Smoother sessions**: No risk of accidentally navigating away during workouts

## Analytics Integration

PWA events are tracked via Google Analytics:
- `pwa_install` - When user installs the app
- `pwa_prompt_response` - User response to install prompt (accepted/dismissed)
- `pwa_prompt_dismissed` - Manual dismissal of prompt

## Future Enhancements

### Potential Additions:
- **Push notifications** for workout reminders (requires user permission)
- **Background sync** for workout data when offline
- **App shortcuts** for different workout types
- **Share target** to receive shared content

### App Store Distribution:
- Current PWA setup is compatible with:
  - **Microsoft Store** (Edge PWAs)
  - **Google Play Store** (Trusted Web Activities)
  - **Future iOS App Store** (when Apple adds PWA support)

## Testing PWA Features

### Desktop (Chrome/Edge):
1. Visit the site and engage (spend time or complete workout)
2. Look for install prompt or three-dot menu > "Install app"
3. App opens in standalone window

### Mobile (Android):
1. Visit site and engage
2. Install prompt appears or use "Add to Home Screen"
3. App appears on home screen and opens full-screen

### Mobile (iOS - Safari):
1. Visit site (no automatic prompt on iOS)
2. Tap share button > "Add to Home Screen"
3. App appears on home screen

## Development Notes

### Local Testing:
- Service worker only works on HTTPS or localhost
- Use `npm run dev` for local testing
- Chrome DevTools > Application tab shows PWA status

### Production Deployment:
- Ensure all manifest assets exist in `/public/assets/`
- Service worker must be served from root domain
- HTTPS required for PWA features

### Debugging:
- Chrome DevTools > Application > Manifest
- Check service worker registration and caches
- Lighthouse audit for PWA compliance