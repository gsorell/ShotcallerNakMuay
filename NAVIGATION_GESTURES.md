# Navigation Gestures Implementation

## Overview
This app now supports standard mobile navigation gestures and hardware back button support for an intuitive user experience.

## Supported Navigation Methods

### 1. Hardware Back Button (Mobile Apps)
- **Platform**: Android devices when app is installed as PWA or native app
- **Behavior**: Pressing the hardware back button navigates back to the previous screen
- **Implementation**: Uses Capacitor's App plugin to listen for `backButton` events

### 2. Left-to-Right Swipe Gesture
- **Platform**: All touch devices (phones, tablets)
- **Gesture**: Swipe from the left edge of the screen toward the right
- **Requirements**:
  - Start touch within 50px of the left screen edge
  - Minimum 100px horizontal movement
  - Complete gesture within 500ms
  - Maximum 80px vertical deviation (to avoid interfering with scrolling)
- **Implementation**: Uses native touch events with gesture validation

### 3. Escape Key (Desktop)
- **Platform**: Desktop/laptop computers
- **Behavior**: Pressing the Escape key navigates back
- **Use Case**: Testing and desktop browser usage

## Navigation Flow

The navigation follows this priority order:

1. **Help Modal Open** → Close modal, return to current page
2. **Technique Editor** → Return to Timer page
3. **Workout Logs** → Return to Timer page  
4. **Workout Completed** → Return to Timer page
5. **Timer Page** → No action (prevents accidental app exit)

## Technical Implementation

### Key Components
- `useNavigationGestures` hook in `/src/hooks/useNavigationGestures.ts`
- Integrated into main App component
- Uses Capacitor App plugin for hardware back button support

### Gesture Detection Logic
```typescript
// Validates swipe gestures with these criteria:
- Touch starts within 50px of left edge
- Horizontal movement > 100px
- Gesture completes within 500ms
- Vertical deviation < 80px
- Prevents interference with vertical scrolling
```

### Dependencies
- `@capacitor/app` - Hardware back button support
- `@capacitor/core` - Core Capacitor functionality
- Built-in touch events - Swipe gesture detection

## Testing

### On Mobile Device
1. Install the app or access via PWA
2. Navigate to Technique Editor or Workout Logs
3. Try swiping from left edge to right
4. Try hardware back button (Android)

### On Desktop
1. Navigate to any modal or sub-page
2. Press Escape key
3. Should return to previous screen

### Development Debug Mode
Set `debugLog: true` in the useNavigationGestures hook call to see console logs for gesture detection debugging.

## Browser Compatibility
- **Touch Events**: All modern mobile browsers
- **Hardware Back Button**: Native apps and PWAs only
- **Escape Key**: All desktop browsers
- **Gesture Prevention**: Uses `preventDefault()` to avoid conflicts with browser navigation