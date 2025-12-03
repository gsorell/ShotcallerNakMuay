# Release Notes - Version 1.3.0

## 🎨 Custom App Icon Release

**Release Date:** October 21, 2025

### ✨ New Features

- **Custom App Icon**: Replaced default Capacitor logo with custom Shotcaller Nak Muay logo
  - Generated proper Android adaptive icons for all screen densities
  - Added round icons for supported launchers
  - Created PWA icons for web app installations
  - Generated splash screens with custom branding

### 🔧 Technical Updates

- Updated to version 1.3.0 (from 1.2.9)
- Incremented Android versionCode to 34
- Added @capacitor/assets for icon generation workflow
- Generated comprehensive icon sets:
  - Android: 74 generated icons/assets (1.69 MB total)
  - PWA: 7 generated icons (331.52 KB total)

### 📱 App Store Impact

- App will now display custom logo in Google Play Store
- Device home screens will show custom icon
- App switcher/recent apps will use custom icon
- System settings will display custom branding

### 🛠️ Build Information

- **Package Version:** 1.3.0
- **Android Version Code:** 34
- **Android Version Name:** 1.3.0
- **Bundle Size:** ~55.6 MB
- **Build Tools:** @capacitor/assets v3.0.5

### 📋 Files Changed

- Updated `client/package.json` version
- Updated `client/android/app/build.gradle` version info
- Generated all Android mipmap icons and splash screens
- Generated PWA icons in `client/public/assets/icons/`
- Added resources directory with source icon

### 🎯 Next Steps

Ready for Google Play Store deployment with custom branding.