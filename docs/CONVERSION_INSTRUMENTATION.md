# Conversion Instrumentation — Setup Runbook

The conversion work on `feat/conversion-optimization` is code-complete, but four
parts of it are inert until something is configured **outside this repo**. This
is that configuration, in the order worth doing it.

| # | Task | Where | Blocks |
|---|---|---|---|
| 1 | ~~Confirm the store intro offers~~ ✅ | Play Console · App Store Connect · RevenueCat | The whole trial UI |
| 2 | Apple provider token | App Store Connect → App Analytics | Blog campaign attribution on iOS |
| 3 | ~~GA4 custom dimensions~~ ✅ | GA4 Admin | Every new funnel event being *reportable* |
| 4 | Deploy the blog | git push | The store CTAs going live |

Tasks 2–4 are independent. Task 1 is the one that changes what users see.

---

## 1. Confirm the store products carry introductory offers

### Why this is a *confirmation*, not a code change

The paywall never invents an offer. It reads `product.introPrice`, which
RevenueCat populates straight from the store, and renders the trial UI only
when that field comes back non-null (`describeIntroOffer` in
`src/features/paywall/pricing.ts`). If the stores are not offering a trial,
the paywall renders exactly as it did before — no error, no wrong claim, just
the old plan rows.

So there is nothing to "turn on" in the app. Either the store offers it and the
UI appears, or it doesn't and the UI stays away.

The only in-repo hint that a trial was ever configured is a comment in
`src/features/entitlement/constants.ts:18` — `premium_monthly` is annotated as
using base plan `monthly-trial`. That name is evidence, not proof.

> ## ✅ DONE 2026-08-31 — all four products carry a 7-day trial
>
> | Product | Store | Offer | State |
> |---|---|---|---|
> | `premium_monthly:monthly-trial` | Play | `freetrial7`, 7-day free trial | Active, 174 regions |
> | `premium_yearly:yearly-trial` | Play | `freetrial7`, 7-day free trial | Active, 174 regions |
> | `snm_pro_monthly` | Apple | "Free for the first week" | Live, no end date, 175 regions |
> | `snm_pro_annual` | Apple | "Free for the first week" | Live, no end date, 175 regions |
> | lifetime (both stores) | — | none | Correct — non-consumables take no intro offer |
>
> Play eligibility is set to **"Never had any subscription"** on both offers, so
> churning off one plan cannot earn a trial on the other. Apple enforces the
> equivalent automatically at subscription-group level, which is why its offers
> take no eligibility setting.
>
> RevenueCat's `default` offering carries all three packages, with the Play
> products correctly addressed as `productId:basePlanId`. The offer IDs
> deliberately do **not** appear in RevenueCat — Play applies the best eligible
> offer at purchase time and RevenueCat surfaces it through `defaultOption`.
>
> Neither store required a review submission: the Play offers activate directly,
> and Apple introductory offers added to already-Approved subscriptions go live
> on their start date without a new binary.
>
> **Remaining: verification on an internal-test build — see 1c.**

### 1a. Google Play

> **Original finding, kept as the record of what was wrong.** `premium_monthly`
> had exactly one row under "Base plans and offers" — the base plan
> `monthly-trial` itself. No offer had ever been attached to it. The base plan
> was *named* "monthly-trial" but carried no free-trial phase, so no Android
> user had ever been shown one. `premium_yearly` was in the same state.

Every one of these must be true, or `introPrice` is null on Android:

1. **Play Console → Monetize → Products → Subscriptions → `premium_monthly`.**
   Confirm the base plan **`monthly-trial`** exists and its state is **Active**
   (not Draft, not Inactive).
2. On that base plan, confirm there is an **offer** whose phase is a **free
   trial**, and that the offer's state is **Active**. In Play's model the base
   plan is the price and the *offer* is the trial — a base plan named
   "monthly-trial" with no offer attached gives you nothing. To add one, from
   the subscription page use **Add offer**:
   - **Offer ID**: e.g. `freetrial7`. Permanent and lowercase.
   - **Eligibility**: new customer acquisition, users who have never
     subscribed — otherwise it is a giveaway to existing subscribers.
   - **Countries/regions**: match the base plan's 174, or the offer sells in
     fewer places than the plan does.
   - **Phases**: one phase, type **Free trial**, 7 days.
   - Then **Activate it.** Offers are created as Draft, and a Draft offer
     returns nothing to the app. This is the step most easily missed.

   Because the base plan carries a **legacy price point**, Play may ask for the
   offer's regional pricing explicitly rather than inheriting it. That prompt
   is expected, not an error.
3. Check the offer's **eligibility criteria**. The usual setting is new-customer
   acquisition, which means *a user who has already used the trial sees no
   `introPrice`*. This is the single most common reason a trial "doesn't show
   up" during testing — see verification below.
4. **RevenueCat → Products.** The Android product must point at that base plan.
   RevenueCat identifies Play subscriptions as `productId:basePlanId`, so the
   entry should read **`premium_monthly:monthly-trial`**. A product pointing at
   the bare `premium_monthly` may resolve to a different base plan.
5. **RevenueCat → Offerings.** The offering marked **Current** must contain a
   package attached to that product. The app reads `offerings.current` only —
   see `getPackages()` in `src/features/entitlement/EntitlementProvider.tsx`.
   A product that exists but sits outside the current offering never reaches
   the paywall at all.

Repeat step 4–5 for `premium_yearly` if you want a trial on annual too.

### 1b. App Store Connect

Both subs are **Approved** and grouped ("Shotcaller Pro", group ID 22286004),
Pro Yearly at level 1 and Pro Monthly at level 2.

1. **App Store Connect → your app → Monetization → Subscriptions →** the
   subscription group → click the subscription's **Reference Name**
   (e.g. "Pro Monthly"). The group page itself has no offer controls.
2. In **Subscription Prices**, click **"View all Subscription Pricing"**. That
   page carries the tabs **Subscription Prices · Introductory Offers ·
   Win-Back Offers · Offer Codes · Promotional Offers**. Under **Introductory
   Offers**, use the **+** to create one: **Free Trial**, 1 week, all
   territories, start today, **no end date**.
3. It appears immediately under **Current Introductory Offers** as
   "Free for the first week". No review submission is required for an
   introductory offer on an already-Approved subscription; a subscription that
   has never been approved must be submitted with an app version first.
4. **Apple needs no eligibility setting.** Introductory offers are scoped to
   the subscription *group*: one per customer, ever. A user who trials monthly
   is automatically ineligible for the annual trial, so creating offers on both
   is safe.
5. Repeat for **`snm_pro_annual`**.
6. **`snm_lifetime` cannot have one.** It is a non-consumable, and Apple has no
   introductory-offer mechanism for non-consumables. The paywall handles this
   correctly already — it just renders no intro line on that row.

RevenueCat picks the offer up from StoreKit automatically; there is no
RevenueCat-side step for iOS beyond the product already being in the current
offering.

While you are in there: the IAP **review screenshot** on `snm_pro_monthly`
shows the old paywall ("Unlock Shotcaller Pro"). Once the trial ships the title
becomes "Try Shotcaller Pro free", so refresh that screenshot at the next
submission to keep it matching what a reviewer actually sees.

### 1c. Verifying it actually works

⚠️ **A sideloaded debug build cannot verify this on Android.** Play Billing only
returns product details to an app installed *through Play* with a matching
signing key. The Pixel here carries debug-signed builds, so `getOfferings()`
on that device will come back without usable pricing regardless of how the
console is configured. Verify on an **internal testing track** build with a
licensed tester account instead.

What "working" looks like in the app:

- The paywall title reads **"Try Shotcaller Pro free"** instead of "Unlock
  Shotcaller Pro".
- A blue banner reads **"Start with 7 days free — cancel anytime."** It reads
  "7 days" on both platforms by design: Apple reports the offer as 1 WEEK and
  Play reports it as 7 DAY, and `normalizePeriod` in `pricing.ts` converts
  weeks to days so one offer is not advertised two ways.
- The monthly row shows **"7 days free, then $X.XX"** and its button reads
  **"Try free"** instead of "Get".

If the title still says "Unlock", `introPrice` is null and one of the steps
above has not landed. Remember eligibility: **test with an account that has
never subscribed**, or the store will correctly report no offer.

---

## 2. Apple provider token (`pt`)

The blog's App Store links currently carry `ct` (the campaign token, set to the
post slug) but no `pt`. Without `pt`, App Analytics tags the click but cannot
group it into a campaign.

### Getting the value

1. **App Store Connect → App Analytics → Acquisition → Campaigns.**
2. Create a campaign (any name — it is only being used to mint a link).
3. App Store Connect generates a campaign URL. Copy the **`pt=` value** out of
   it. That number is your provider token and is the same for every link.

Using the campaign generator is the reliable route; the raw provider ID is
buried in different places depending on account type.

### Setting it

One line, in `scripts/generate_blog.mjs`:

```js
const APPLE_PROVIDER_TOKEN = null;   // ← replace null with the number, quoted
```

Then regenerate and commit the output:

```bash
node scripts/generate_blog.mjs
git add public/blog scripts/generate_blog.mjs
```

While it is `null` the links still work and still carry `ct` — they are simply
not grouped. Nothing breaks by leaving it.

**Android needs nothing here.** Play links already carry a full `referrer`
string (`utm_source=blog&utm_medium=organic&utm_campaign=<post-slug>`), which
Play Console reports on directly.

---

## 3. Register the GA4 custom dimensions

> ## ✅ DONE 2026-08-31
>
> All eight dimensions are registered on `G-5GY5JTX5KZ` (11 of the 50
> event-scoped quota used, counting the pre-existing `emphasis`,
> `selected_emphases` and `platform`).
>
> **If GA4 says "There is already a dimension or metric registered with this
> parameter name", it means exactly that — check the existing list before
> assuming the name is reserved.** `source` registers fine; the error was a
> duplicate of a dimension created moments earlier, not a collision with GA4's
> traffic-acquisition schema.

GA4 collects unregistered event parameters but **will not let you report on
them**. Until these are registered, the new funnel events show up as event
counts with no way to break them down.

**Two things worth knowing before you start:**

- **Registration is not retroactive.** A dimension reports only on data
  collected *after* you create it. (The same trap that left the emphasis data
  unanswerable before 2026-08-10 — those two dimensions are dated exactly that
  day.)
- It can take **24–48 hours** for a new dimension to appear in standard
  reports. **Realtime** (Reports → Realtime) shows event *names* arriving
  within seconds, which is enough to confirm the events fire.
- **DebugView is not currently reachable**, so do not plan on it for
  parameter-level inspection. `analytics.ts` couples `GA_DEBUG_MODE` to both
  the `debug_mode` flag and the endpoint, and the debug endpoint
  (`/debug/mp/collect`) only validates — it never records. Flipping that
  constant makes iOS events vanish rather than appear. On Android/web the gtag
  path sets no `debug_mode` at all. Decoupling the two is a small change if
  DebugView is ever wanted.

### Where

**GA4 Admin (gear icon) → Data display → Custom definitions.**

The **Event parameter** field is a combobox that suggests parameters GA4 has
already seen. A parameter that has never fired will not be in the list — type
it manually; it accepts free text and starts collecting when the parameter
first arrives.

Property: measurement ID `G-5GY5JTX5KZ`.

### Custom dimensions (tab 1)

**Create custom dimension**, Scope **Event**, for each row. The *Event
parameter* must match exactly; the *Dimension name* is just the display label.

| Dimension name | Event parameter | What it answers |
|---|---|---|
| Paywall Source | `source` | Which gate produced the open — the whole point of tagging them |
| Paywall Dismiss Reason | `reason` | Close button vs. tapping the overlay |
| Plans Loaded | `plans_loaded` | Whether they bounced off a paywall that had no plans to show |
| RevenueCat User ID | `rc_user_id` | The join key back to RevenueCat purchase records |
| Package Type | `package_type` | ANNUAL / MONTHLY / LIFETIME |
| Has Trial | `has_trial` | Whether the tapped plan carried an intro offer |
| Product ID | `product` | Which specific store product |
| Purchase Error | `error` | Why a purchase failed at the store |

> Name the first one **"Paywall Source"**, not "Source" — GA4 already has a
> built-in Source dimension for traffic acquisition and two things called
> Source in the reporting UI is needless confusion. The *parameter* may still
> be `source`; only the display name needs to differ.

### Custom metrics (tab 2)

`seconds_open` is a number, not a label, so it belongs here rather than as a
dimension — that way you get averages and distributions instead of one row per
distinct value.

| Metric name | Event parameter | Unit |
|---|---|---|
| Paywall Seconds Open | `seconds_open` | Standard |

### Do NOT register

`value` and `currency` are GA4 standard ecommerce parameters. They are already
understood natively on `paywall_purchase_success` and registering them as
custom definitions would only create duplicates.

### The events these belong to

For reference, the funnel now emits (all defined in `src/utils/analytics.ts`):

`paywall_open` → `paywall_plan_tap` → `paywall_purchase_success`

with the loss paths branching off as `paywall_dismiss` (never tapped a plan),
`paywall_purchase_cancelled` (backed out at the store sheet), and
`paywall_purchase_error` (the store call failed). Plus `paywall_restore` and
`paywall_legacy_claim`.

The gap between `paywall_open` and `paywall_plan_tap` is a copy/pricing
problem. The gap between `paywall_plan_tap` and `paywall_purchase_success` is a
store problem. Before this change the two were indistinguishable.

---

## 4. Deploy the blog

**There is no manual deploy step.** Netlify builds automatically on every push
to `main` (`netlify.toml`: `npm ci && npm run build`, publish `dist`).

One thing to know: **the blog generator does not run during the Netlify build.**
`npm run build` is `tsc -b && vite build`; Vite copies `public/blog/` verbatim
into `dist/`. So what deploys is the **committed HTML**, not freshly generated
output. The regenerated files are already staged on the branch — if you change
`scripts/generate_blog.mjs` later, you must re-run it and commit the result or
the site will not change.

### Steps

```bash
git checkout main
git merge feat/conversion-optimization
git push
```

Then watch the deploy in the Netlify dashboard.

### Verify after the deploy

1. Open any post, e.g.
   `https://shotcallernakmuay.netlify.app/blog/mastering-the-teep.html`.
2. Confirm the **"Train To It Tonight"** block appears between the article and
   "You Might Also Like".
3. Hover/inspect the two buttons and confirm the campaign tags survived:
   - Apple: `...id6757487630?ct=mastering-the-teep&mt=8` (plus `pt=` once task 2
     is done)
   - Play: `...&referrer=utm_source%3Dblog%26utm_medium%3Dorganic%26utm_campaign%3Dmastering-the-teep`
4. Check the blog index page has the block too, tagged `blog-index`.

### Rollback

Netlify dashboard → Deploys → the previous good deploy → **Publish deploy**.

---

## What to look at once data arrives

Give it a week of real traffic, then the questions that were unanswerable
before:

- **Which gate converts?** Break `paywall_open` down by Paywall Source. The new
  `workout_complete` source is the one to watch against `onboarding` — the whole
  premise of moving the ask is that it beats asking before the first punch.
- **Is the paywall being read or reflexively closed?** Average Paywall Seconds
  Open on `paywall_dismiss`. Under a couple of seconds means the paywall is
  firing where it isn't wanted, not that the price is wrong.
- **Where does the drop happen?** `paywall_open` → `paywall_plan_tap` →
  `paywall_purchase_success`, split by Has Trial once task 1 lands.
- **Did the blog produce anything?** Play Console acquisition reports by
  referrer; App Store Connect campaigns by `ct`. And for anyone who does
  subscribe, RevenueCat now carries `ga_client_id` as a subscriber attribute,
  so an individual purchase can be traced back to its session.
