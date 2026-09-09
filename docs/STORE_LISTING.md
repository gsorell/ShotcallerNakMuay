# Store listing copy

Kept here because it lived only in the two consoles, which meant no history, no
diff, and no way to tell what changed between releases.

**The two descriptions are deliberately different, and should stay that way.**

| | App Store | Play |
|---|---|---|
| Description indexed for search? | **No** | **Yes** |
| What search actually reads | Name (30), subtitle (30), hidden keywords field (100) | Title (30), short description (80), **full description (4000)** |
| So the description is | a conversion surface — written for a human deciding | a conversion **and** ranking surface |

Writing one keyword-tuned description and pasting it into both wastes the Play
ranking opportunity and makes the App Store page read like machine output for
no gain at all. Apple never reads it.

---

## App Store — Description

> Written for the reader, not the crawler. The first two lines are what shows
> above the "more" fold on the product page, so they carry the whole pitch.

```
Someone in your corner, calling the shots.

Shot Caller is a Muay Thai round timer that calls techniques out loud while you
train. Set your rounds, pick a style, put the phone down. You keep your hands up
and your eyes forward, and the app calls the next shot.

No counting reps in your head. No stopping to read a screen. Just the bell, the
callout, and the work.

TRAIN THE WAY THE SPORT IS ACTUALLY FOUGHT

Nine styles, each with its own vocabulary:

- Nak Muay Newb - free, and where most people start
- Muay Mat - heavy hands and low kicks
- Muay Tae - the kicking specialist
- Muay Khao - clinch work and knees
- Muay Femur - the technician
- Muay Sok - elbows
- Meat & Potatoes - the high-percentage basics
- Boxing and Dutch Kickboxing for cross-training

Pick one or stack several, and the callouts change with them. Nak Muay Newb and
freestyle are free; the other eight styles come with Pro.

START FROM ZERO

Ten guided levels take you from your first jab to full combinations, one
technique at a time. Each level introduces the shot, drills it, then folds it
into everything you have already learned.

KNOW WHAT YOU ARE THROWING

35 techniques and 48 combinations, each with what it is for, how to throw it,
and the mistakes that make it miss.

BUILT FOR REAL SESSIONS

- Shadow boxing, heavy bag, or pads with a partner
- Rounds, round length, rest and difficulty all yours to set
- Southpaw mode
- Optional calisthenics between rounds
- Every session logged, with streaks and achievements

FREE TO START

The round timer, freestyle callouts, the Nak Muay Newb style and the first level
of the guided path are free, and always will be. No account, no card, no ads.

Pro opens the rest: the other eight styles, all ten levels, the full technique
library, the training options, and styles you build yourself.
```

### Subscription block — append verbatim to the App Store description

Apple's guideline 3.1.2 requires, in the metadata, the **title** and **length**
of each auto-renewing subscription, its **price** (and per-unit price where
useful), plus working links to the **Privacy Policy** and **Terms of Use**. A
description that drops any of it invites a rejection, so this is not optional
prose.

```
Shot Caller Pro

- Pro Monthly - $3.99 per month
- Pro Annual - $24.99 per year ($2.08 per month)
- Lifetime - $39.99, one time, no subscription

Pro unlocks the other eight fighting styles, the full ten-level guided path, the
technique library, the training options, and styles you build yourself. The round
timer, freestyle callouts, the Nak Muay Newb style and the first level stay free.

Both subscription plans start with a 7-day free trial. Payment is charged to
your Apple ID account at confirmation of purchase. Subscriptions renew automatically unless
auto-renew is turned off at least 24 hours before the end of the current period,
and your account is charged for renewal within 24 hours of the end of that
period. You can manage your subscription and turn off auto-renewal in your
Account Settings after purchase. Any unused portion of a free trial is forfeited
when you buy a subscription.

Privacy Policy: https://shotcallernakmuay.netlify.app/privacy-policy
Terms of Use: https://shotcallernakmuay.netlify.app/terms
```

Both URLs verified live (HTTP 200) on 2026-09-09.

All three prices, the per-month equivalent and the trial verified 2026-09-09
against the live pricing section at
`https://shotcallernakmuay.netlify.app/#pricing`, which is the canonical public
statement of them. The 7-day trial runs on **both** the monthly and annual
plans; Lifetime is a one-time purchase and has no trial. Note the site's own
caveat: these are US prices and the stores convert and may round by region.

For **Play**, this block is not required in the description — Play shows
subscription terms from the console itself. Keep the Play description clean and
let the store surface pricing.

---

## Play — Full description

> This one **is** indexed. The first ~167 characters also show as the snippet in
> Play search results, so the terms someone would actually type go there.
> Repetition is natural, not stuffed: Play penalises keyword spam and it reads
> badly to a human, who is the one who has to tap Install.

```
Shot Caller is a Muay Thai timer that calls out combos while you train. A round
timer, interval timer and combo generator in one, for shadow boxing, heavy bag
work and pad rounds.

Set your rounds, pick a style, and put the phone down. The timer runs the round
and calls the next technique out loud, so you train hands-free with your guard
up instead of stopping to read a screen.

NINE MUAY THAI AND KICKBOXING STYLES

The callouts follow how the sport is really fought:

- Nak Muay Newb - free, and where most people start
- Muay Mat - heavy hands and low kicks
- Muay Tae - the kicking specialist
- Muay Khao - clinch work and knees
- Muay Femur - the technician
- Muay Sok - elbows
- Meat & Potatoes - the high-percentage basics
- Boxing and Dutch Kickboxing for cross-training

Pick one or combine several and the combo generator draws from all of them.
Nak Muay Newb and freestyle are free; the other eight styles come with Pro.

A GUIDED PATH FOR BEGINNERS

Ten levels take you from your first jab to full combinations. Each level
introduces one technique, drills it, then works it into what you already know -
so a complete beginner can start shadow boxing on day one.

A TECHNIQUE LIBRARY

35 Muay Thai techniques and 48 combinations - punches, kicks, knees, elbows,
defence and footwork - each with what it is for, how to throw it, and the
common mistakes.

A ROUND TIMER THAT FITS YOUR TRAINING

- Shadow boxing, heavy bag and pad work
- Custom rounds, round length, rest periods and difficulty
- Southpaw mode
- Optional calisthenics between rounds
- Workout logs, training streaks and achievements

WHY CALLOUTS

A boxing timer tells you when to work. It cannot tell you what to throw, so most
heavy bag rounds turn into the same three combinations. Spoken callouts make you
react instead of repeat - which is closer to how sparring actually feels, and
the reason drilling with a coach beats drilling alone.

FREE TO START

The round timer, freestyle callouts, the Nak Muay Newb style and the first level
of the guided path are free, with no account and no ads.

Pro opens the other eight styles, all ten levels, the full technique library,
the training options, and styles you build yourself.
```

### Keyword coverage in the Play copy

Placed to read naturally, not stuffed. Rough counts:

| Term | Times |
|---|---|
| Muay Thai | 4 |
| timer (round / interval / boxing) | 6 |
| shadow boxing | 3 |
| heavy bag | 3 |
| pad work / pad rounds | 2 |
| combo / combinations / combo generator | 6 |
| kickboxing | 2 |
| technique(s) | 5 |
| beginner | 2 |

---

## Not changed here

- **App Store keywords field (100 chars)** — set 2026-09-08, unchanged:
  `round,interval,kickboxing,heavy,bag,pads,padwork,drills,striking,clinch,footwork,generator,trainer`
  It deliberately omits every word already in the name or subtitle, because
  Apple indexes all three fields and builds phrases across them.
- **App Store subtitle (30)** — `Shadow boxing combo callouts`
- **Play short description (80)** — `Round timer that calls out Muay Thai combos for shadow boxing, bag and pads`
