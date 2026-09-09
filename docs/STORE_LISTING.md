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

- Muay Mat - heavy hands and low kicks
- Muay Tae - the kicking specialist
- Muay Khao - clinch work and knees
- Muay Femur - the technician
- Muay Sok - elbows
- Boxing and Dutch Kickboxing
- Nak Muay Newb and Meat & Potatoes, for everyone still finding their footing

Pick one or stack several. The callouts change with them.

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

The timer, the callouts, all nine styles and the first level are free. No
account, no ads, nothing to sign up for. Pro opens the full ten-level path, the
technique library and custom combinations.
```

**Then append your existing subscription block verbatim** — product names,
durations, prices, and the Terms of Use and Privacy Policy links. Apple's
guideline 3.1.2 requires that information in the metadata for auto-renewable
subscriptions, and removing it risks a rejection. It is the one part of the
current description that must survive the rewrite.

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

- Muay Mat - heavy hands and low kicks
- Muay Tae - the kicking specialist
- Muay Khao - clinch work and knees
- Muay Femur - the technician
- Muay Sok - elbows
- Boxing and Dutch Kickboxing for cross-training
- Nak Muay Newb and Meat & Potatoes for beginners

Pick one or combine several, and the combo generator draws from all of them.

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

The round timer, the callouts, all nine styles and the first level are free. No
account, no ads. Pro unlocks the full ten-level path, the technique library and
custom combinations.
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
