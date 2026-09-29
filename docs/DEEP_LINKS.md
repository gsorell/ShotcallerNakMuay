# Deep Links — Shared Custom Styles

How a style shared in a text message opens the native app.

---

## The flow

1. A Pro user taps **↗** on one of their styles in Manage Techniques.
2. The OS share sheet opens with a link: `https://shotcallernakmuay.netlify.app/s/#p=<code>`.
3. The friend taps that link in Messages / WhatsApp / wherever.
4. **The native app opens directly**, straight to a confirmation sheet:
   *"Jake shared a style with you — Flow Drills, 30 singles · 15 combos."*
5. On **Add to my styles**, the style is written to their library and the
   editor opens on it. Nothing is written before that tap.

If the app is not installed, the link opens the web app instead, which runs the
same confirmation.

## Why the style travels inside the link

There is no server in this path and deliberately never was one.

- **Nothing to moderate.** A hosted short code would turn user-typed text into
  a public URL, and that text is read aloud by TTS on the receiving phone.
  Person-to-person links behave like a text message: you only get what someone
  sent you.
- **Nothing to run.** No database, no functions, no uptime, no bill.
- **Nothing to rot.** The link works for as long as the message exists.

The payload sits in the URL **fragment**, so it never reaches Netlify's logs —
browsers and both mobile OSes hand `#...` to the app, not to the server.

A realistic 45-entry style encodes to roughly 500 characters, which fits in an
SMS. `SHARE_LIMITS.linkSoftMax` is the point past which the share sheet flags a
link as awkwardly long; the decoder accepts far more.

**The tradeoff:** no browsable public library, no rich social previews, no data
on which styles are popular. Those need a backend, and that is a different
project.

## What is where

| Piece | File |
|---|---|
| Encode / decode / sanitise | [`src/utils/styleShare.ts`](../src/utils/styleShare.ts) |
| Send (share sheet) | [`src/features/style-share/shareStyle.ts`](../src/features/style-share/shareStyle.ts) |
| Receive (all three doors) | [`src/features/style-share/useIncomingShare.ts`](../src/features/style-share/useIncomingShare.ts) |
| Confirmation sheet | [`src/features/style-share/ImportStyleModal.tsx`](../src/features/style-share/ImportStyleModal.tsx) |
| iOS entitlement | [`ios/App/App/App.entitlements`](../ios/App/App/App.entitlements) |
| Android intent filter | [`android/app/src/main/AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml) |
| Domain verification | [`public/.well-known/`](../public/.well-known/) |
| Live check | `npm run verify:deeplinks` |

---

## Setup that cannot be done from this repo

Both platforms need credentials that do not live in git. **Until these are
done, links open in the browser instead of the app** — everything else works,
so the failure is silent.

> **Status: both done, 2026-09-29.** Team ID and both Android fingerprints are
> filled in, and the regenerated iOS profile is in the
> `IOS_PROVISIONING_PROFILE` secret. What remains is to **deploy** so the
> `.well-known` files go live, and to ship builds that carry the entitlement.
> The procedure below is kept because it has to be repeated whenever the
> distribution certificate expires (2027-01-08) or the upload key is reset.

### 1. iOS — Associated Domains

The workflow signs manually against a pre-baked profile
([`ios-build.yml`](../.github/workflows/ios-build.yml) uses
`use_automatic_signing:false`), so an entitlement that is not in that profile
fails at codesign.

1. Apple Developer portal → Identifiers → `com.shotcallernakmuay.app` → enable
   **Associated Domains**.
2. **Regenerate** the App Store distribution provisioning profile. The existing
   one does not carry the new entitlement.
3. Base64-encode the new `.mobileprovision` and replace the
   `IOS_PROVISIONING_PROFILE` GitHub secret.
4. Put the 10-character Team ID into
   `public/.well-known/apple-app-site-association`, replacing
   `REPLACE_WITH_APPLE_TEAM_ID`, so the `appIDs` entry reads
   `ABCDE12345.com.shotcallernakmuay.app`.

No Mac is required — all four steps are the web portal plus a base64 encode.

> Apple's CDN caches the AASA file hard, so a correction can take a day to take
> effect. For on-device debugging only, `applinks:...?mode=developer` bypasses
> the cache when Associated Domains Development is enabled in Developer
> settings. Never ship that suffix.

### 2. Android — Digital Asset Links

`assetlinks.json` must list the SHA-256 of the certificate that signs the
**installed** app.

- **Play builds:** Play Console → Setup → App signing. Easiest route is the
  **Digital Asset Links JSON** snippet at the bottom of that page — Google
  generates it from the app signing key, so it cannot pick the wrong one. This
  is **not** the upload key: that page shows both, they are different, and the
  upload key is the one that looks right.
- **Your test device:** the Pixel carries debug-signed builds, so App Links
  will never verify there without the debug keystore's fingerprint too:

  ```
  keytool -list -v -keystore ~/.android/debug.keystore \
          -alias androiddebugkey -storepass android -keypass android
  ```

Both go in the `sha256_cert_fingerprints` array, replacing the two
`REPLACE_WITH_*` placeholders.

### 3. Verify against the live site

A green deploy badge is not evidence — Netlify has served stale content here
before, and a wrong `Content-Type` on the AASA file is invisible in git.

```
npm run verify:deeplinks
```

This checks both files over HTTPS for status, content type, valid JSON,
remaining placeholders, and fingerprint format, and asks **Google's own Digital
Asset Links verifier** whether Android will accept the site — which is the only
check that proves links will open the app rather than a chooser dialog.

---

## Gotchas worth keeping

- **Only `/s/` is claimed, never `/*`.** Claiming the whole host would hijack
  every link to the site — privacy policy, blog, sales page — into the app.
- **Cold start needs `getLaunchUrl`.** An `appUrlOpen`-only implementation
  misses the most common case: tapping a link with the app closed. The listener
  attaches too late to see the launch URL.
- **Deferred install does not carry the payload.** Someone who installs the app
  *after* being sent a style arrives with nothing — neither store passes the
  link through. That is what the paste box in Manage Techniques is for.
- **Imports can never land on a core style.** Groups share one flat map and the
  editor refuses to delete core keys, so an overwrite there would be
  unrecoverable. `importKeyFor` suffixes instead.
- **Everything inbound is sanitised.** Imported text is spoken by TTS and
  rendered as-is, so control characters are stripped, lengths and counts capped,
  and weights clamped.
- **Free users can import `FREE_IMPORT_LIMIT` styles**, then hit the paywall.
  Sharing is Pro-only. Receiving is deliberately cheaper than creating: that is
  the acquisition loop.

---

*Written for whoever ships the next release — assumes familiarity with the repo
but not with Universal Links or Digital Asset Links.*
