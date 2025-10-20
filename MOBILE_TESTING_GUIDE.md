# Mobile TTS Testing Guide

## 🚀 Quick Network Testing (Immediate)

1. **Start Dev Server** (already running):
   ```bash
   npm run dev
   ```

2. **Connect Mobile Device**:
   - Ensure phone is on same WiFi as computer
   - Open browser and go to: `http://192.168.1.245:5173/`

3. **Test TTS Features**:
   - ✅ Voice selection in settings
   - ✅ "Test Voice" button functionality
   - ✅ Workout technique callouts
   - ✅ "Get ready" and timer announcements

## 📱 PWA Testing (App-like Experience)

1. **Mobile Browser**: Open `http://192.168.1.245:5173/`
2. **Browser Menu**: Look for "Add to Home Screen" or "Install App"
3. **Install**: Follow prompts to install PWA
4. **Launch**: Open from home screen (runs like native app)
5. **Test**: All TTS should work in PWA mode

## 🔧 Capacitor Native App Testing

### For True Native App Experience:

1. **Build for Production**:
   ```bash
   npm run build
   ```

2. **Sync with Capacitor**:
   ```bash
   npx cap sync
   ```

3. **Android Testing**:
   ```bash
   npx cap run android
   ```

4. **iOS Testing** (Mac required):
   ```bash
   npx cap run ios
   ```

## 🎯 TTS-Specific Mobile Testing

### Current Implementation (Browser TTS):
- ✅ Works in mobile browsers
- ✅ Works in PWA mode
- ✅ Uses device's built-in voices
- ⚠️ May be affected by silent mode on iOS

### For Native Apps (Future Enhancement):
When you add `expo-speech` to Capacitor build:
- ✅ Works even when browser TTS is disabled
- ✅ Better voice quality and control
- ✅ Consistent across Android/iOS
- ✅ Works in silent mode

## 🔍 Testing Checklist

### Basic TTS Testing:
- [ ] Voice selection dropdown loads voices
- [ ] "Test Voice" button speaks
- [ ] Voice settings persist
- [ ] English voices are prioritized

### Workout TTS Testing:
- [ ] "Get ready" announcement
- [ ] Technique callouts during workout
- [ ] Timer warnings ("10 seconds")
- [ ] No TTS during rest periods
- [ ] TTS stops when workout stops

### Mobile-Specific Testing:
- [ ] Works with phone locked/unlocked
- [ ] Works with other apps running
- [ ] Volume controls affect TTS
- [ ] Works in landscape/portrait
- [ ] Works with headphones/bluetooth

## 🛠️ Troubleshooting

### If TTS doesn't work on mobile:
1. **Check browser compatibility** (Chrome/Safari recommended)
2. **Enable JavaScript** in browser settings
3. **Check volume/silent mode** (iOS especially)
4. **Try different voices** in settings
5. **Reload page** to refresh voice list

### Network Issues:
- Ensure devices on same WiFi
- Check Windows Firewall (may block port 5173)
- Try IP address instead of localhost

## 🚀 Next Steps for App Store Deployment

1. **Add expo-speech** to package.json
2. **Update TTS service** to use native APIs
3. **Build with Capacitor** for app stores
4. **Test on physical devices** with native build

The current browser-based TTS implementation provides excellent testing capabilities and will work great as a PWA until you're ready for full native deployment!