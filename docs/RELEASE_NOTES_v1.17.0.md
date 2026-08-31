# Release Notes — v1.17.0

**versionCode:** 93 · **Previous:** v1.16.0 (versionCode 92)

The paywall stops being a price list. It now says what the stores are actually
offering — a seven-day free trial on every subscription — asks at the end of a
workout instead of before the first punch, and reports enough about itself that
the next change can be made on evidence rather than instinct.

---

## What shipped

### The free trial is finally visible

Both stores now carry a 7-day free trial on monthly and annual, configured on
2026-08-31. The old paywall could not have mentioned it: it read
`product.priceString` and nothing else, so `product.introPrice` — the field the
stores populate with the offer — was never looked at.

`describeIntroOffer` in [pricing.ts](../src/features/paywall/pricing.ts) reads
it now. When an offer exists the sheet leads with **"Try Shotcaller Pro free"**,
banners **"Start with 7 days free — cancel anytime"**, prints **"7 days free,
then $X.XX"** on the row, and the button reads **Try free** instead of **Get**.

Nothing is asserted that the store did not report. No offer, no trial UI — the
paywall falls back to exactly what it rendered before, which is what it did for
every build up to this one.

Apple returns the offer as `1 WEEK` and Play returns the same offer as `7 DAY`.
`normalizePeriod` converts weeks to days so one trial is not advertised two
ways depending on the phone.

### Plans that make a case for themselves

Three identical rows asked the user to do the comparison themselves. Annual now
carries the accent border, shows its per-month equivalent (`$29.99 per year ·
$2.50/mo`), and its badge carries the real saving computed against twelve
months of the monthly plan rather than a generic "Best value".

`annualSavingsPercent` returns null rather than a negative — a store
misconfiguration where annual costs more than 12 monthlies must not render as
"Save -4%".

### The ask moved to the end of a workout

The only automatic paywall fired during onboarding, before the user had thrown
a single punch. It now also fires after **workout 1 and workout 3**, once each,
persisted — the moment the product has just done its job and the charm the user
cannot claim is on screen.

Suppressed for Pro users, for anyone who met onboarding in the same session,
and — importantly — until entitlement resolves. `isPro` is false while status is
`unknown`, so acting before `ready` would have shown a paywall to a
grandfathered owner whose lookup had not come back yet.

### A free tier you can reach the end of

Free users could browse a locked shelf but never finish anything.

- Guided path: levels **2 and 3** join level 1 as free. One free level let
  people see the ladder without ever completing a run of it.
- Learn: the **Jab** and **Cross** lessons open without Pro — the two
  techniques level 1 teaches, so the path and the library agree.

This exposed a real gap. The free lessons made the "drill this" button
reachable without Pro for the first time, and that path called
`settings.toggleEmphasis` directly — style gating lived only in the emphasis
selector's UI. A free user could have drilled the free jab lesson in a Pro
style. Gated in [LearnSection.tsx](../src/features/learn/components/LearnSection.tsx).

### The funnel reports on itself

`paywall_open` and `paywall_purchase_success` could not distinguish "nobody
reaches the paywall" from "everybody closes it" from "the store call fails".
Added: `paywall_dismiss` (with reason, seconds open, whether plans loaded),
`paywall_plan_tap`, `paywall_purchase_cancelled`, `paywall_purchase_error`,
`paywall_restore`. Success now carries `value`/`currency` for GA4 revenue.

The gap between `paywall_open` and `paywall_plan_tap` is a copy problem. The
gap between `paywall_plan_tap` and `paywall_purchase_success` is a store
problem. They were previously the same number.

### RevenueCat and GA4 can be joined

A purchase could not be traced back to the session that produced it — the same
hole that made the Meta ads spend unmeasurable.

RevenueCat now carries `ga_client_id` as a subscriber attribute, and every GA4
event carries `rc_user_id`.

Deliberately **not** done by passing `appUserID` to `Purchases.configure`: that
re-keys existing subscribers onto a RevenueCat user with no entitlement
attached until they restore. It would have locked out a real payer to buy an
analytics join.

### The blog can send someone to a store

Twenty-one posts, and every CTA pointed at `/` — the PWA, where Pro cannot be
bought because RevenueCat is never configured on web. Each post and the index
now carry a store CTA, campaign-tagged per post: Play via `referrer`, Apple via
`ct`.

`APPLE_PROVIDER_TOKEN` in [generate_blog.mjs](../scripts/generate_blog.mjs) is
still `null` — `ct` tags the click but App Analytics cannot group it into a
campaign without `pt`. One constant, once the value is pulled from App Store
Connect.

---

## Files changed

| Area | Files |
|---|---|
| Paywall | `PaywallModal.tsx`, `pricing.ts` (new), `postWorkoutPrompt.ts` (new), `index.ts` |
| Entitlement | `EntitlementProvider.tsx`, `constants.ts`, `index.ts` |
| Free tier | `paths.ts`, `LearnSection.tsx` |
| Upsell timing | `WorkoutCompleted.tsx` |
| Analytics | `analytics.ts` |
| Blog | `generate_blog.mjs`, `public/blog/*.html` (22 regenerated) |
| Docs | `CONVERSION_INSTRUMENTATION.md` (new) |
| Tests | `paywallPricing.test.ts` (new), `postWorkoutPrompt.test.ts` (new), `roadmapCoverage.test.ts` |

---

## Test plan

Automated: 243 tests across 22 files, including 20 new ones covering intro-offer
parsing, the annual framing maths, and the post-workout prompt's persistence.

Manual, on an **internal testing track** build with an account that has **never
subscribed** — a sideloaded debug build cannot verify this, because Play Billing
only returns product details to an app installed through Play:

- [ ] Paywall title reads "Try Shotcaller Pro free"
- [ ] Banner reads "Start with 7 days free" on **both** platforms
- [ ] Monthly row: "7 days free, then $X.XX", button reads "Try free"
- [ ] Annual row carries the accent border and a real `Save N%`
- [ ] Free user: roadmap levels 1–3 open, level 4 hits the paywall
- [ ] Free user: Jab and Cross lessons open; any other lesson hits the paywall
- [ ] Free user: "drill this" on the Jab lesson hits the paywall, does not start
      a workout in a Pro style
- [ ] Paywall appears after workout 1 and workout 3, and not after workout 2
- [ ] Grandfathered owner sees no paywall at any of the above
- [ ] GA4 Realtime shows `paywall_open`, `paywall_plan_tap`, `paywall_dismiss`

---

## Store release notes

### Play Console (500 char hard limit)

```
Shot Caller Pro now starts with a 7-day free trial — every fighting style, the
technique editor, and the full charm progression, free for a week.

More to train with before you decide: the guided path's first three levels and
the Jab and Cross lessons are now free for everyone.

Annual plans show what they actually save you.
```

### App Store Connect "What's New"

```
Shot Caller Pro now starts with a 7-day free trial. Get every fighting style,
the technique editor, advanced training options and the full charm progression
free for a week, and cancel any time before it ends.

There's also more to train with before you decide. The first three levels of
the Start Here guided path are now free, along with the full Jab and Cross
lessons in the technique library — so you can work through a real run of the
path and see exactly what a lesson looks like.

Annual plans now show their per-month cost and what they save you against
paying monthly.
```

---

## Known follow-ups

- `APPLE_PROVIDER_TOKEN` in the blog generator is still `null`.
- The IAP review screenshot in App Store Connect shows the old paywall
  ("Unlock Shotcaller Pro"). Refresh it at the next submission.
- DebugView is unreachable — `analytics.ts` couples `GA_DEBUG_MODE` to both the
  `debug_mode` flag and the validation-only endpoint. See
  [CONVERSION_INSTRUMENTATION.md](./CONVERSION_INSTRUMENTATION.md).
- `npx eslint` fails on a flat-config migration error. Pre-existing; fails
  identically on a clean tree.
