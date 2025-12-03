# ShotcallerNakMuay Release Notes - Version 1.2.6

**Release Date**: October 21, 2025  
**Build**: 30 (Previous: 29)

## 🚀 Major Feature: Responsive Callout Timing

### What's New
- **Smart Interval Adjustment**: Callout intervals now adapt to the actual length of each technique callout
- **Enhanced Pro Difficulty**: Significantly more aggressive timing for advanced practitioners
- **Improved Flow**: Better rhythm and pacing throughout training sessions

### ⚡ Performance Improvements

#### Timing Optimizations
- **Faster Initial Callout**: Reduced delay from 1200ms to 800ms
- **Reduced Buffer Times**: 15-20% buffer (was 30%) for tighter spacing
- **Lower Minimum Delays**: 40-50% of base interval (was 70%) for snappier response
- **Smart Timing Caps**: Prevents excessively long pauses while maintaining technique completion time

#### Difficulty-Specific Enhancements
- **Novice**: 20 calls/min (unchanged) - comfortable learning pace
- **Amateur**: 26 calls/min (unchanged) - steady progression
- **Pro**: 37 calls/min (+2 from 35) - relentless challenge with 10-43% faster intervals

### 🔧 Technical Improvements
- Enhanced TTS service with actual speech duration measurement
- Responsive timing system that adapts to voice speed and technique complexity
- Improved cross-platform compatibility for timing accuracy
- Added comprehensive timing documentation

### 📊 Real-World Impact
- **Short techniques** (e.g., "Jab"): Much tighter spacing for better flow
- **Long combinations** (e.g., "1 2 3, Left Low Kick, Clinch, Double Knees"): Adequate completion time with intelligent caps
- **Pro difficulty**: Maximum responsiveness while maintaining technique execution quality

### 🎯 User Experience
- More dynamic and engaging training sessions
- Better technique completion timing
- Maintains original pace philosophy while improving responsiveness
- Smoother transitions between callouts

---

## Technical Details

### Files Modified
- `client/src/App.tsx` - Main callout logic with responsive timing
- `client/src/hooks/useTTS.ts` - Enhanced TTS hook with duration measurement
- `client/src/utils/ttsService.ts` - TTS service with actual timing capture
- `RESPONSIVE_CALLOUT_TIMING.md` - Comprehensive implementation documentation

### Version Updates
- Package version: 1.0.2 → 1.2.6
- Android versionName: 1.2.5 → 1.2.6
- Android versionCode: 29 → 30

---

*This release represents a significant improvement in training session dynamics while maintaining the core philosophy of technique-focused Muay Thai practice.*