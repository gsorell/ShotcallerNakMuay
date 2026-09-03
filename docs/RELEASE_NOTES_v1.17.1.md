# Release Notes — v1.17.1

**versionCode:** 94 · **Previous:** v1.17.0 (versionCode 93)

A measurement release. Nothing in the app looks or behaves differently; what
changes is that a subscription can finally be traced back to the ad that
produced it, and that the privacy policy stops saying something this build
makes untrue.

---

## What shipped

### The app supplies an identifier Meta can match

v1.17.0 made the paywall funnel measurable in GA4 and joined RevenueCat to it
with `ga_client_id`. That answers "which gate converts". It cannot answer "did
the ad pay for itself", because Meta only matches a purchase to an ad click if
the event carries an identifier Meta recognises.

RevenueCat's Meta integration was wired on 2026-09-03 — Conversions API,
dataset `2148781392653981`, sandbox deliberately excluded, revenue reported
after store commission. Without this build it would have delivered events that
Meta accepted and silently discarded as unmatched.

[EntitlementProvider](../src/features/entitlement/EntitlementProvider.tsx) now
calls `collectDeviceIdentifiers()` after `Purchases.configure()`. On Android
that collects `$gpsAdId`, which needs
`com.google.android.gms.permission.AD_ID` in the manifest — without the
permission the value comes back as all zeros on anything targeting SDK 33+, and
we target 36.

It sits in its own `try` so a failure cannot cost us the `ga_client_id`
attribute set just above it, which is the more valuable of the two joins and
the one that works on every platform.

### iOS stays unmatched, on purpose

On iOS the same call collects `$idfa` only once App Tracking Transparency
consent has been granted. There is no ATT prompt in this app and this release
does not add one, so no advertising identifier leaves an iPhone. iOS purchases
are therefore invisible to Meta attribution — by design rather than by
accident, and worth remembering before reading any campaign report as though it
covered both platforms.

### The privacy policy stops contradicting the app

Both copies of the policy said, in as many words, *"We do not share personal
data with advertising networks."* True until this build; false the moment it
ships.

[privacy-policy.html](../public/privacy-policy.html) and
[PRIVACY_POLICY.md](PRIVACY_POLICY.md) now carry an **Advertising Measurement
(via Meta)** section: what is sent, that Android sends the Google Advertising ID
and iOS sends nothing, that no name, email or payment detail reaches Meta, and
how to reset or delete the identifier on either platform. The "No Sale of
Personal Data" section was rewritten to say what is now true — Meta is the only
advertising network anything is shared with, only for measuring our own ads.

The two files had drifted badly (the HTML was dated August 5 2026, the Markdown
October 22 2025). Both now read September 3 2026. Their remaining differences
were not reconciled.

---

## Store-side changes made outside this repo

- **Play Console → Data safety**: *Device or other IDs* and *Financial info →
  Purchase history* are both declared as collected **and shared**, purpose
  Advertising or marketing. Play rejects releases carrying `AD_ID` without the
  matching declaration.
- **Meta app** `2148781392653981`, published, iOS and Android platforms
  attached. Per-platform automatic in-app purchase logging was turned **off** on
  both — RevenueCat and the Meta SDK share no `event_id`, so leaving them on
  would double-count every subscription.

---

## How to tell it worked

Meta Events Manager, dataset `2148781392653981`, currently reads "Never
received events". One real Android subscription should turn that into a
`Subscribe`. Until exactly one has been seen end to end, the chain is
unproven.
