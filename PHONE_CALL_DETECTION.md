# Phone Call Detection Feature

This document describes the phone call detection and automatic workout pausing feature implemented in the Nak Muay Shot Caller app.

## Overview

The app now automatically detects incoming phone calls and pauses the workout session to prevent interruption of the training experience. This ensures that users can take phone calls without losing their workout progress or having technique callouts interfere with their conversation.

## How It Works

### Very Conservative Detection Approach
The system is designed to be extremely conservative and only interrupt workouts for genuine phone calls or when the device is completely locked/closed, not for normal app usage.

### Web/PWA Environment
- **Long Visibility Change Detection**: Only triggers after 30+ seconds of being hidden (genuine phone calls)
- **Focus/Blur Events**: Completely disabled to prevent false positives from normal app switching
- **Audio Context Monitoring**: Disabled to prevent interference from other apps or browser behavior
- **Very High Threshold**: 30-second minimum before considering any interruption

### Native Mobile Environment (iOS/Android)
- **Extended App State Monitoring**: Only triggers after 30+ seconds of app inactivity (likely phone calls)
- **Audio Session Interruptions**: Disabled by default to prevent false positives
- **Custom Native Plugin**: Provides direct phone call detection when available (future enhancement)

## Features

### Automatic Pause
- Workout automatically pauses when a phone call is detected
- TTS (Text-to-Speech) services are immediately stopped
- Timer and technique callouts are suspended

### Visual Indicators
- Phone call detection status is displayed in the UI with a pulsing animation
- Clear messaging informs users that the workout was paused due to a phone call
- Resume instructions are provided

### Smart Resume
- The app does NOT automatically resume when the call ends
- Users must manually press the Resume button to continue their workout
- This prevents accidental resumption and gives users control over when to continue

### Analytics Integration
- Phone call interruptions are tracked for analytics
- Helps understand user experience and workout completion patterns

## Technical Implementation

### Files Modified/Created

1. **`/src/hooks/usePhoneCallDetection.ts`** - Main detection hook
2. **`/src/utils/ttsService.ts`** - Enhanced with interruption handling
3. **`/src/App.tsx`** - Integrated phone call detection and UI
4. **`/src/App.css`** - Added pulse animation for indicators
5. **`/src/plugins/PhoneCallDetection/`** - Native plugin framework (future expansion)
6. **`capacitor.config.ts`** - Configuration for native features

### API Usage

```typescript
// Basic usage in a React component
const phoneCallDetection = usePhoneCallDetection({
  onCallStart: () => {
    // Handle phone call start
    pauseWorkout();
  },
  onCallEnd: () => {
    // Handle phone call end
    // Note: Don't auto-resume, let user decide
  },
  enabled: true,
  debug: false
});

// Check current state
if (phoneCallDetection.isInterrupted) {
  // Show phone call UI
}
```

### Configuration Options

```typescript
interface UsePhoneCallDetectionOptions {
  onCallStart?: () => void;           // Callback when call starts
  onCallEnd?: () => void;             // Callback when call ends
  onInterruptionChange?: (interrupted: boolean, reason: string) => void;
  enabled?: boolean;                  // Enable/disable detection (default: true)
  interruptionThreshold?: number;     // Min duration before considering interruption (default: 30000ms)
  debug?: boolean;                    // Enable debug logging (default: false)
}
```

## User Experience

### During a Phone Call
1. User receives or makes a phone call (or device is locked for extended period)
2. App detects the interruption after 30+ seconds of inactivity
3. Workout is automatically paused
4. TTS stops immediately to avoid interference
5. No visual indicators (clean, unobtrusive experience)

### After the Phone Call
1. User ends the phone call
2. App detects the call has ended
3. Interruption indicator may disappear (depending on detection method)
4. User manually presses "Resume" to continue workout
5. Workout continues from where it left off

### Fallback Behavior
- If phone call detection fails, users can still manually pause/resume
- Manual pause/resume controls remain fully functional
- No degradation of core workout functionality

## Browser/Platform Support

### Web Browsers
- **Chrome/Chromium**: Full support with all detection methods
- **Safari**: Good support, may have AudioContext limitations
- **Firefox**: Good support with visibility and focus detection
- **Mobile Browsers**: Variable support depending on OS restrictions

### Native Apps
- **iOS**: Best support with audio session monitoring and app state detection
- **Android**: Good support with app state and system interruption monitoring

## Troubleshooting

### False Positives
- Very rare with 30-second threshold - only genuine long interruptions trigger detection
- Normal app switching, tab changes, and multitasking will not interrupt workouts
- If false positives occur, they indicate extremely long periods of inactivity (30+ seconds)

### Missed Detections
- Very brief phone calls (under 30 seconds) may not be detected automatically
- VoIP calls or app-to-app calls that don't trigger visibility changes may not be detected
- Users can always manually pause if automatic detection fails

### Platform Limitations
- Web browsers have limited access to system-level phone call information
- Detection relies on indirect signals (visibility, focus, audio context)
- Native apps provide better detection capabilities

## Future Enhancements

### Planned Improvements
1. **Native Plugin Development**: Custom iOS/Android plugins for direct phone call monitoring
2. **Call Type Detection**: Distinguish between different types of interruptions
3. **Auto-Resume Options**: User preference for automatic resume after short calls
4. **Integration with VoIP Apps**: Better detection for app-based calls (WhatsApp, Zoom, etc.)
5. **Notification Integration**: Use system notifications to detect call states

### Analytics and Optimization
- Track detection accuracy and false positive rates
- Optimize thresholds based on user behavior patterns
- A/B test different resumption strategies

## Development Notes

### Testing Phone Call Detection
```javascript
// Enable debug mode
const phoneCallDetection = usePhoneCallDetection({
  debug: true, // Shows console logs
  enabled: true
});

// Manual testing
phoneCallDetection.forceInterruption('test');
phoneCallDetection.forceResume('test');
```

### Performance Considerations
- Minimal CPU overhead from event listeners
- AudioContext created only when needed
- Cleanup on component unmount prevents memory leaks
- Throttled event handling prevents excessive callbacks

### Security and Privacy
- No access to actual phone call content or numbers
- Only detects general interruption states
- All processing happens locally on device
- No phone call data is transmitted or stored

## Conclusion

The phone call detection feature significantly improves the user experience by automatically handling one of the most common workout interruptions. The implementation balances accuracy with performance, provides clear user feedback, and maintains full manual control as a fallback option.

The feature is designed to be unobtrusive when working correctly and helpful when phone calls occur, ensuring that users can maintain their training momentum without technical distractions.