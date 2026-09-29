# Release Notes — v1.21.0

**Date:** 2026-09-29
**versionCode:** 107
**Type:** Feature. Style sharing, with native deep links on both platforms. Also
a Technique Manager redesign and a repair of the ESLint config. No change to the
callout engine, the round or rest clocks, entitlement, or audio.

---

## Summary

A user can send one of their custom styles to a training partner as a link.
Tapping it opens the app directly — on Android this is verified App Links, not a
browser hop — and the first thing shown is a confirmation naming the sender, the
style and its size. Nothing is written until they accept.

The style travels **inside the link**. There is no backend, nothing to keep
online, and nothing to moderate.

---

## 1. Why the payload is in the link

A hosted short code was the obvious design and is the wrong one here. It would
turn user-typed text into a public URL, and that text is **read aloud by TTS on
the receiving phone** — so a service with no moderation would be publishing
whatever anyone typed. Person-to-person links behave like a text message: you
only ever get what someone sent you.

The style is deflated, base64url'd, and placed in the URL **fragment** of
`/s/#p=...`. The fragment is never sent to the server, so the payload does not
reach Netlify's logs either.

Measured across every shipped style, links run **330–643 characters** (median
404) — comfortably inside SMS and every chat app.

[src/utils/styleShare.ts](../src/utils/styleShare.ts)

## 2. Deep links

| Platform | Mechanism |
|---|---|
| iOS | Associated Domains entitlement, `applinks:shotcallernakmuay.netlify.app` |
| Android | App Links intent filter, `autoVerify`, `pathPrefix="/s/"` |
| Both | `public/.well-known/`, served as `application/json` via netlify.toml |

`pathPrefix` is `/s/` and deliberately **not** `/`. Claiming the whole host would
hijack every link to the site — the blog, the privacy policy, the sales page —
into the app.

Receiving covers three doors, all of which are needed:

- **Warm** — `appUrlOpen`, via `onNewIntent` (Android, `launchMode="singleTask"`)
  or `continue userActivity` (iOS, already wired in AppDelegate).
- **Cold** — `getLaunchUrl`. This is the *common* case — tapping a link with the
  app closed — and the one an `appUrlOpen`-only implementation silently misses,
  because the listener attaches after the launch URL has been delivered.
- **Web** — the fragment on the current URL, plus `hashchange`.

[src/features/style-share/useIncomingShare.ts](../src/features/style-share/useIncomingShare.ts)

## 3. Everything inbound is sanitised

Imported text is spoken by TTS and rendered as-is, so it is treated as hostile:
control characters stripped, entry counts and string lengths capped, weights
clamped, unknown fields dropped, and a schema version that fails closed with
"update the app" rather than importing a half-understood style.

Imports can **never land on a core style**. Groups share one flat map and the
editor refuses to delete core keys, so an overwrite there would be unrecoverable
from inside the app — `importKeyFor` suffixes instead.

## 4. Free users can receive

Sharing is Pro. **Receiving is not**, up to `FREE_IMPORT_LIMIT` (2), then the
paywall. Receiving is deliberately cheaper than creating: a shared style is how a
paying user hands a friend something that works immediately, and charging at that
moment kills the loop at exactly the point it would pay off.

## 5. A sharing name

Collected in onboarding, **assigned lazily if not**. The lazy path is not an edge
case: Pro users never see onboarding (`if (isPro) return` in OnboardingProvider),
and neither does anyone who onboarded before this existed — which is every
current user. An assigned name gets one confirmation at the first share; a chosen
one shares in a single tap.

## 6. Technique Manager redesign

- Two headed panels and a permanent text field became **one row of two buttons**,
  which puts styles above the fold instead of pushing the first one off screen.
- **Your own styles lead, newest first.** Create, duplicate and import disagreed
  about where a style lands — only create prepended — so all three now go through
  `prependGroup`. This reverses a deliberate earlier decision to match the home
  grid's order; see the comment in `groupSorting.ts` for why the two screens now
  differ on purpose.
- Icon buttons are square. Padded like text buttons they left a style's name 90px
  of a 292px row, so "Nak Muay Newb" wrapped onto three lines.
- Whole-library backup moved into a collapsed **Manage data** section, and
  "Import Backup" became **"Restore from Backup"**: it sat a scroll away from the
  new "Import" with near-identical wording, and it *replaces* every custom style
  rather than adding one.

## 7. The shared card prints the domain

The completion card's footer said `SHOT CALLER`, which tells a stranger nothing
about where to find it. It now prints `shotcallernakmuay.netlify.app` in its
place — the two were the same word twice.

This matters because **Facebook and Instagram drop a share's caption entirely**
(verified on device 2026-09-24), so on those surfaces the image is the whole
message and it previously carried no route back to the app at all.

A QR was built for both cards and removed. What governs scanning is module size
*on glass*, and at the size a card is viewed in a chat that works out to ~0.25mm
per module against a practical floor nearer 0.3–0.4mm. Measurements are in the
challenge-cards notes so the work is not redone.

## 8. ESLint was broken and is now fixed

`eslint.config.js` handed flat config the *legacy* eslintrc object from
eslint-plugin-react-hooks, so **ESLint refused to start at all** — on every file.
Up to v5 `configs["recommended-latest"]` was the flat config; from v6 it reverted
to the eslintrc shape and the flat ones moved under `configs.flat`. The repo is
on v7.

Nothing had ever run it: no `lint` script, no CI step. Added `npm run lint`.

It surfaced 260 problems; 48 mechanical ones are fixed (all catch clauses — 25
unused bindings dropped, 23 empty blocks given real reasons). The remaining 210
are left deliberately: 123 `no-explicit-any` and 41 `no-unused-vars` are typing
work, and **25 React Compiler findings sit in the timer and audio paths**, where
a change needs a device to validate rather than a codemod. Two genuine
render-phase ref writes in `WorkoutProvider` are worth a look under StrictMode.

---

## Files changed

| Area | Files |
|---|---|
| Codec | `src/utils/styleShare.ts`, `src/utils/techniqueUtils.ts` |
| Feature | `src/features/style-share/*` (11 files) |
| Editor | `StyleActions.tsx`, `NewStyleDialog.tsx`, `TechniqueEditor.*`, `TechniqueGroupHeader/Panel`, `TechniqueQuickEdit`, `useTechniqueEditor`, `groupSorting` |
| Native | `AndroidManifest.xml`, `App.entitlements`, `project.pbxproj` |
| Hosting | `netlify.toml`, `public/.well-known/*` |
| Onboarding | `OnboardingFlow.tsx` |
| Cards | `WorkoutCompleted.tsx` |
| Tooling | `eslint.config.js`, `scripts/verify-deeplinks.mjs` |

Commits: `f327794`, `a4dd3d2`, merged as `3edbf74`; docs in `b9ad00d`.

---

## Test plan

**Automated:** 297 tests across 25 files pass, `tsc -b` clean. 23 of those cover
the share codec directly — round-trip, weighting and stars preserved, control
characters stripped, counts and lengths clamped, oversized payloads refused,
future schema versions rejected, and imports never colliding with a core style.
11 more cover the sharing identity and the free-import cap.

**Browser (Chrome, 390×844):** 18 assertions covering the decluttered editor, the
create-and-import ordering, the first-share name sheet, the home-tile share
button, and the Manage data disclosure.

**Android, on a Pixel 9 Pro XL (debug build), after deploying:**

| Check | Result |
|---|---|
| `pm get-app-links` domain state | `verified` (override explicitly disabled) |
| Device signing key vs `assetlinks.json` | matches the debug fingerprint |
| Cold start from a `VIEW` intent | app launches, import sheet shown |
| Link delivered to a running instance | sheet replaces, no restart |
| Google Digital Asset Links verifier | accepts the site |

**iOS: signing verified, not yet installed.** Run 36616848801 built and signed
with the new entitlement successfully; it failed only at upload, because 1.20.1
is already approved on the App Store (errors 90186 and 90062). That failure is
what confirmed the store status. Universal Links are therefore **unverified on
device** — Apple fetches the AASA through its own CDN and caches it, so the first
TestFlight install may not intercept links immediately.

### Manual smoke test

- [ ] Share a style; confirm the card image and the link both arrive.
- [ ] Tap the link on a second device — app opens, sheet shows the right sender.
- [ ] Accept; the style lands at the top of Manage Techniques.
- [ ] Free tier: two imports, then the paywall.
- [ ] Paste a link into Import Styles — same sheet.
- [ ] Round, rest and completion unaffected.

---

## Note on versioning

1.20.1 / versionCode 106 is **confirmed live on the App Store** — Apple rejected
a rebuild of it as a "previously approved version". Play status is still not
recorded in the repo; a higher `versionCode` is accepted regardless, so 107 is
safe either way.

Store copy must cover style sharing as the headline. If 1.20.1 never reached
Play, the Play listing also needs the pre-round countdown fix from that release.
