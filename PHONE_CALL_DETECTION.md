# Phone Call Detection Feature

This document describes the phone call detection and automatic workout pausing feature implemented in the Nak Muay Shot Caller app.

## Overview

The app now automatically detects incoming phone calls and pauses the workout session to prevent interruption of the training experience. This ensures that users can take phone calls without losing their workout progress or having technique callouts interfere with their conversation.

## How It Works

### Web/PWA Environment
- **Visibility Change Detection**: Monitors when the browser tab/app becomes hidden
- **Focus/Blur Events**: Detects when the app loses focus
- **Audio Context Monitoring**: Tracks audio session interruptions
- **Threshold-based Detection**: Uses a configurable delay to prevent false positives from quick tab switches

### Native Mobile Environment (iOS/Android)
- **App State Monitoring**: Uses Capacitor's App plugin to detect when the app goes to background
- **Audio Session Interruptions**: Monitors iOS audio session interruption events
- **Custom Native Plugin**: Provides more granular phone call detection (when available)

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
  interruptionThreshold?: number;     // Min duration before considering interruption (default: 500ms)
  debug?: boolean;                    // Enable debug logging (default: false)
}
```

## User Experience

### During a Phone Call
1. User receives or makes a phone call
2. App detects the interruption within 500ms-1000ms
3. Workout is automatically paused
4. Visual indicator appears: "📞 Phone call detected - Workout paused automatically"
5. TTS stops immediately to avoid interference

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
- Adjust `interruptionThreshold` to reduce sensitivity
- Some quick tab switches might trigger detection on sensitive settings

### Missed Detections
- Some VoIP calls or app-to-app calls might not be detected
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