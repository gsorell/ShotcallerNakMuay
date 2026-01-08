# GitHub Actions iOS Build Setup Guide

This guide will help you set up automated iOS builds and TestFlight uploads using GitHub Actions.

## Prerequisites

1. An Apple Developer account
2. Access to App Store Connect
3. Your app must be registered in App Store Connect

## Step 1: Create App Store Connect API Key

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to **Users and Access** → **Keys** (under Integrations)
3. Click the **+** button to create a new API key
4. Give it a name (e.g., "GitHub Actions")
5. Set access level to **App Manager** or **Admin**
6. Click **Generate**
7. **Download the API key file** (.p8 file) - you can only download this once!
8. Note the following values:
   - **Key ID** (e.g., ABC123XYZ)
   - **Issuer ID** (found at the top of the Keys page)

## Step 2: Create Distribution Certificate

You need to create these on a Mac (or use existing ones):

### Option A: Using Xcode on a Mac

1. Open Xcode
2. Go to **Xcode** → **Preferences** → **Accounts**
3. Select your Apple ID and click **Manage Certificates**
4. Click **+** and select **Apple Distribution**
5. Export the certificate:
   - Open **Keychain Access**
   - Find the "Apple Distribution" certificate
   - Right-click → **Export**
   - Save as `.p12` file
   - Set a password (you'll need this for GitHub secrets)

### Option B: Using Fastlane Match (Recommended for teams)

```bash
# Install fastlane
gem install fastlane

# Initialize match
cd ios/App
fastlane match init

# Generate certificates
fastlane match appstore
```

## Step 3: Download Provisioning Profile

### Option A: Manual Download

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Profiles**
4. Create or download your **App Store** provisioning profile
5. Download the `.mobileprovision` file

### Option B: Using Xcode

1. Open your project in Xcode (`ios/App/App.xcodeproj`)
2. Select the App target
3. Go to **Signing & Capabilities**
4. Make sure **Automatically manage signing** is unchecked
5. Select your provisioning profile
6. Find it in: `~/Library/MobileDevice/Provisioning Profiles/`

## Step 4: Convert Files to Base64

You need to convert the certificate and provisioning profile to base64 for GitHub secrets:

### On Mac/Linux:
```bash
# Convert P12 certificate
base64 -i YourCertificate.p12 -o certificate.txt

# Convert provisioning profile
base64 -i YourProfile.mobileprovision -o profile.txt
```

### On Windows (PowerShell):
```powershell
# Convert P12 certificate
[Convert]::ToBase64String([IO.File]::ReadAllBytes("YourCertificate.p12")) | Out-File certificate.txt

# Convert provisioning profile
[Convert]::ToBase64String([IO.File]::ReadAllBytes("YourProfile.mobileprovision")) | Out-File profile.txt
```

## Step 5: Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each of the following:

| Secret Name | Description | Example/Source |
|-------------|-------------|----------------|
| `IOS_DIST_CERT_P12` | Base64-encoded distribution certificate | Content of certificate.txt |
| `IOS_DIST_CERT_PASSWORD` | Password for the P12 certificate | Password you set when exporting |
| `IOS_PROVISIONING_PROFILE` | Base64-encoded provisioning profile | Content of profile.txt |
| `PROVISIONING_PROFILE_SPECIFIER` | Name of the provisioning profile | Found in Xcode or profile filename |
| `APPLE_TEAM_ID` | Your Apple Team ID | Found in Apple Developer account (10-char ID) |
| `APP_STORE_CONNECT_API_KEY_ID` | API Key ID from Step 1 | From App Store Connect (e.g., ABC123XYZ) |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID from Step 1 | From App Store Connect (UUID format) |
| `APP_STORE_CONNECT_API_KEY` | Base64-encoded API key file | Convert the .p8 file to base64 |

### Converting the App Store Connect API Key (.p8 file):

**Mac/Linux:**
```bash
base64 -i AuthKey_ABC123XYZ.p8 -o apikey.txt
```

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_ABC123XYZ.p8")) | Out-File apikey.txt
```

## Step 6: Find Your Team ID

1. Go to [Apple Developer](https://developer.apple.com/account/)
2. Click on **Membership** in the sidebar
3. Your **Team ID** is listed there (10 characters, e.g., `A1B2C3D4E5`)

## Step 7: Find Provisioning Profile Specifier

The specifier is the name of your provisioning profile. You can find it:

1. **In Xcode:**
   - Open your project
   - Select target → Signing & Capabilities
   - The name shown in the Provisioning Profile dropdown

2. **In the file:**
   - Open the `.mobileprovision` file in a text editor
   - Search for `<key>Name</key>`
   - The string below is your specifier

## Step 8: Update Info.plist (if needed)

Make sure your `ios/App/App/Info.plist` has the correct bundle identifier:

```xml
<key>CFBundleIdentifier</key>
<string>com.shotcallernakmuay.app</string>
```

## Step 9: Run the Workflow

1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **Build iOS App** workflow
4. Click **Run workflow**
5. Choose whether to upload to TestFlight
6. Click **Run workflow** button

## Troubleshooting

### Code Signing Issues
- Ensure your provisioning profile matches your bundle ID
- Verify the certificate is valid and not expired
- Check that the Team ID matches

### Build Failures
- Check the GitHub Actions logs for specific errors
- Ensure all dependencies are listed in package.json
- Verify Capacitor configuration is correct

### Upload Failures
- Ensure API key has correct permissions (App Manager or Admin)
- Check that the API key hasn't expired
- Verify the Issuer ID and Key ID are correct

## Alternative: Simplified Workflow with Fastlane Match

For easier certificate management, consider using Fastlane Match:

1. Set up a private Git repository for certificates
2. Use `fastlane match` to manage certificates
3. Simplifies the GitHub Actions workflow

See [Fastlane Match documentation](https://docs.fastlane.tools/actions/match/) for details.

## Security Notes

- Never commit certificates or provisioning profiles to your repository
- Rotate API keys periodically
- Use repository secrets, not environment variables in workflow files
- Consider using a dedicated Apple ID for CI/CD
- Limit API key permissions to only what's needed

## Next Steps

After successful build:
1. Check TestFlight for your build (processing takes 10-30 minutes)
2. Add testers in App Store Connect
3. Submit for review when ready

## Resources

- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [Fastlane Documentation](https://docs.fastlane.tools/)
