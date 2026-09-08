# Release Notes — v1.17.2

**versionCode:** 95 · **Previous:** v1.17.1 (versionCode 94)

Two unrelated things. One the user can see and one they cannot: a roadmap
lesson's figure now opens to the frame stepper, and Meta can finally see an
install rather than only a purchase.

---

## What shipped

### A roadmap lesson's figure opens, and steps

A Start Here lesson card has always shown the technique's figure, but the
figure was inert. The only way to watch it move was to leave the roadmap,
open the Learn library and find the technique again.

Open the card and the figure is now a target of its own: a second tap enlarges
it into the same viewing mode the library opens. Shut, it stays click-through —
the first tap anywhere on the row still opens the lesson, and nothing about a
closed card changes.

The enlarged figure is named per **sheet**, not per lesson. A paired lesson
holds two sides with two names and two summaries, so enlarging the rear teep
from a card titled "Teep" says *Rear Teep*, exactly as the library does. The
name goes through the southpaw mirror; the prose does not.

### Meta can see an install, not just a purchase

v1.17.1 made a *purchase* traceable to an ad. It did nothing for *installs*,
which is the half that matters when buying traffic — Meta cannot optimise a
campaign toward installers it never learns about, so every pound of install
spend was being spent blind.

`facebook-core:18.3.0` is now in the Android build. Not the
`facebook-android-sdk` umbrella: this app wants app events and attribution,
not Login, Share or the Audience Network. There is no init call anywhere —
the SDK registers a ContentProvider that initialises it before `onCreate`, and
`AppEventsLogger.activateApp` is deprecated for exactly that reason. Four
manifest `meta-data` keys are the whole integration.

Two things that would each have made this look configured and deliver nothing:

- **Package visibility.** The Meta Install Referrer is read from a
  ContentProvider inside the Facebook or Instagram app, and on Android 11+ an
  undeclared package is invisible. `facebook-core` does not declare them
  itself — checked against the SDK's own manifest — so the `<queries>` block
  is ours. Without it, view-through installs and click-through installs that
  land in a later session are silently lost.
- **A placeholder App ID is not an error.** Meta accepts the event and drops
  it as unmatched, and the only symptom is a campaign that never learns. A
  new `checkMetaCredentials` gradle task fails any *release* build while the
  credentials are placeholders. Debug builds are untouched.

`com.android.installreferrer` arrives transitively with `facebook-core` and
must not be added again by hand.

---

## Verified before release

- `aapt2 dump resources` on the built APK reads back App ID `2148781392653981`
  and the client token — checked against the artefact, not the source file.
- Logcat on a Pixel 9 Pro XL shows the SDK calling
  `graph.facebook.com/v16.0/app/mobile_sdk_gk` with both credentials,
  `sdk_version=18.3.0`.
- **Meta Events Manager → Test events showed `Activate app` at 09:02:57 on
  2026-09-08**, matching a forced relaunch fired at 09:02:56. Dataset
  `2148781392653981` is receiving activity for the first time.

## The purchase double-count that did not happen

Automatic event logging is all-or-nothing — App Install, App Launch and
In-App Purchase are one switch — so enabling installs should also have enabled
SDK purchase logging beside RevenueCat's Conversions API, with no shared
`event_id` to deduplicate on. It does not, because the SDK cannot attach to
the billing client:

```
W/com.facebook.appevents.iap.InAppPurchaseBillingClientWrapperV5V7:
  Failed to create Google Play billing library wrapper for in-app purchase auto-logging
```

That is the known Play Billing v5+ breakage, and RevenueCat sits on v5+.
RevenueCat's CAPI therefore remains the sole purchase source, still net of
store commission and still excluding sandbox. **Re-check this if either the
Meta SDK or RevenueCat is upgraded** — Meta repairing that wrapper would start
double-counting revenue with no announcement.

---

## Privacy policy

Both copies described only the RevenueCat path, which stopped being the whole
truth the moment the device itself started reporting. They now say that Meta's
library reports installs and app opens from the device, and that it reports
nothing about what happens inside the app — not workouts, not settings, not
anything logged. Dated September 8 2026. iOS is unchanged and still sends no
advertising identifier.

---

## Store-side changes made outside this repo

- **Meta app `2148781392653981`**: the **Android platform was added** (package
  `com.shotcallernakmuay.app`, class `com.shotcallernakmuay.app.MainActivity`).
  v1.17.1's notes claimed both platforms were already attached; they were not.
- **Events Manager → dataset → Settings → "Automatic event logging for the
  Facebook SDK"** set to **On**. This is a single On/Off dropdown, not
  per-platform and not per-event, and it is **not** on the App Dashboard's
  Advanced page. Meta's own text: conflicting values between
  `AutoLogAppEventsEnabled` and this toggle resolve in the toggle's favour.
- App icon, Terms of Service URL and the data-deletion URL were filled in;
  the latter two had been pointing at `https://www.facebook.com/`.
- **Automatic Advanced Matching left Off** deliberately. Turning it on would
  send hashed email, phone and name to Meta, which neither privacy policy
  currently describes.

---

## Play Console release notes (500 char limit)

```
Tap a technique figure on an open Start Here lesson to enlarge it and step
through the movement frame by frame - the same viewer the technique library
uses, without leaving the roadmap. Paired techniques name each side
correctly, and southpaw stance is respected.

Also includes measurement changes for our own advertising. See the updated
privacy policy for what is collected and how to reset your advertising ID.
```

### App Store Connect "What's New"

Deliberately different from the Play text below — and it must stay that way.
iOS ships no Meta SDK and no advertising identifier, so a note claiming ad
measurement would describe something this build does not do on that platform.

```
The figures in Start Here now open. Tap a lesson to expand it, then tap the
technique's figure to enlarge it and step through the movement frame by frame
— the same viewer the technique library uses, without leaving the path you're
working through.

Paired techniques name each side properly, so enlarging the rear teep says
Rear Teep. Everything respects your stance if you train southpaw.
```

---

## Still not true of iOS

No Meta SDK, no ATT prompt, no advertising identifier, and therefore no iOS
attribution of any kind. That remains deliberate. It also means any campaign
built on this measurement is **Android-only**, and that SKAdNetwork — the
route that does not require an ATT prompt — has not been set up.
