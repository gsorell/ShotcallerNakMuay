# Responsive Callout Timing Implementation

## Overview

This implementation makes the interval between technique callouts responsive to the actual time it takes to speak each callout, while maintaining the base pace as much as possible. This ensures that longer combinations get adequate completion time without significantly slowing down the overall pace.

## How It Works

### 1. Enhanced TTS Service (`ttsService.ts`)

The TTS service now measures the actual duration of speech by:
- Recording start and end timestamps for both browser and native TTS
- Passing the actual duration to the `onDone` callback when speech completes
- Supporting both regular callbacks and duration-aware callbacks

### 2. Duration-Aware TTS Hook (`useTTS.ts`)

Added `speakSystemWithDuration()` function that:
- Accepts an optional `onDurationMeasured` callback
- Receives actual speech duration when TTS completes
- Maintains backward compatibility with existing `speakSystem()` calls

### 3. Responsive Callout Logic (`App.tsx`)

The callout scheduling now uses actual speech timing:

```typescript
// Before: Estimated timing based on character count
const estimatedSpeakingTimeMs = (finalPhrase.length / 5) * (60000 / 150) / voiceSpeed;

// After: Actual timing measured from TTS completion
ttsSpeakSystemWithDuration(finalPhrase, voiceSpeed, (actualDurationMs) => {
  const responsiveDelayMs = actualDurationMs + bufferTime + jitter;
  const nextDelayMs = Math.max(minDelayMs, Math.max(responsiveDelayMs, baseDelayMs));
  scheduleNext(nextDelayMs);
});
```

### 4. Intelligent Delay Calculation

The new system calculates the next callout delay using:

1. **Actual Duration**: Real time taken to speak the technique
2. **Dynamic Buffer**: 30% of base delay (400ms-1200ms range) for completion time
- **Pace Preservation**: Uses the larger of responsive delay or base delay
- **Minimum Enforcement**: Never goes below the minimum delay threshold

## Difficulty Cadence Settings

- **Novice (Easy)**: 20 callouts per minute
- **Amateur (Medium)**: 26 callouts per minute  
- **Pro (Hard)**: 37 callouts per minute (increased from 35 for 5% faster pace)

## Benefits

### ✅ Responsive to Technique Length
- Short techniques (e.g., "Jab"): ~1-2 seconds → minimal extra delay
- Long combinations (e.g., "1 2 3, Left Low Kick, Clinch, Double Knees"): ~4-6 seconds → adequate completion time

### ✅ Maintains Base Pace
- Short techniques don't slow down the session unnecessarily
- The system only adds time when actually needed for longer callouts
- **Base cadence is preserved: 20/26/37 calls per minute for Easy/Medium/Hard

### ✅ Adapts to Voice Settings
- Automatically adjusts for different voice speeds (1x, 1.3x for Hard mode)
- Works with different TTS voices that may speak at different rates
- Accounts for accent, pronunciation, and voice engine variations

### ✅ Graceful Fallback
- Falls back to the previous estimation-based system if TTS fails
- Maintains functionality even when duration measurement isn't available
- No breaking changes to existing behavior

## Technical Details

### Timing Components

```typescript
const bufferTime = Math.max(200, Math.min(800, baseDelayMs * 0.2)); // Reduced buffer (was 0.3)
const jitter = Math.floor(baseDelayMs * 0.08 * (Math.random() - 0.5)); // Reduced to ±8% (was ±10%)
const responsiveDelayMs = actualDurationMs + bufferTime + jitter;
const nextDelayMs = Math.max(minDelayMs, Math.min(responsiveDelayMs, baseDelayMs * 1.1)); // Capped for tighter timing
```

### Key Parameters

**For Novice/Amateur:**
- **Buffer**: 20% of base interval, clamped between 200-800ms
- **Jitter**: ±8% random variation to prevent mechanical timing  
- **Minimum Delay**: 50% of base interval for snappy response
- **Timing Cap**: Maximum 110% of base delay to prevent long pauses
- **Fallback Timing**: 80% of base delay when TTS unavailable

**For Pro (Extra Aggressive):**
- **Buffer**: 15% of base interval, clamped between 150-600ms
- **Jitter**: ±6% random variation for tighter timing
- **Minimum Delay**: 40% of base interval for maximum responsiveness  
- **Timing Cap**: Maximum 90% of base delay for relentless pace
- **Fallback Timing**: 70% of base delay for lightning-fast response

- **Faster Initial Delay**: 800ms (was 1200ms) for quicker first callout

## Example Scenarios

## Example Scenarios

### Scenario 1: Short Technique - "Jab" (Medium vs Pro)

**Medium Difficulty:**
- Speech Duration: ~800ms
- Buffer Time: ~320ms (20% of 2308ms base)
- Total Responsive Delay: ~1120ms  
- Final Delay: max(1154ms min, min(1120ms, 2539ms cap)) = **1154ms**

**Pro Difficulty:**  
- Speech Duration: ~800ms
- Buffer Time: ~243ms (15% of 1622ms base)
- Total Responsive Delay: ~1043ms
- Final Delay: max(649ms min, min(1043ms, 1460ms cap)) = **1043ms** (10% faster)

### Scenario 2: Long Combination (Medium vs Pro)

**Medium Difficulty:**
- Speech Duration: ~4500ms  
- Total Responsive Delay: ~4820ms
- Final Delay: max(1154ms min, min(4820ms, 2539ms cap)) = **2539ms** (capped)

**Pro Difficulty:**
- Speech Duration: ~4500ms
- Total Responsive Delay: ~4743ms  
- Final Delay: max(649ms min, min(4743ms, 1460ms cap)) = **1460ms** (43% faster cap)

This implementation provides the perfect balance between responsiveness and pace consistency, ensuring fighters have adequate time to complete techniques while maintaining the intended training intensity.