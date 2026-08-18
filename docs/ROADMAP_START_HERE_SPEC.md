# "Start Here" — Guided Beginner Roadmap

**Status:** Spec locked, not yet implemented
**Date:** 2026-08-10
**Companion doc:** the illustrated version of this spec is published as an
artifact (see the roadmap artifact link in the project notes). This file is the
source of truth for implementation.

---

## 1. Problem

Onboarding explains what the app *is*. It does not fix the actual cliff:
**Nak Muay Newb is 32 singles and 7 combos, all live from the first bell.** Set
difficulty to Novice and a first-timer still gets `1 2 3, Right Low Kick`
called at them before anyone has told them that `3` means left hook.

The missing piece is not content — there are already 63 written lessons across
19 style groups. It is **sequence**: the vocabulary delivered in an order, each
new technique drilled against the ones already learned, and nothing else in the
room.

The roadmap is therefore **a curated ordering of the pool the callout engine
already reads from**, wrapped in a progress track.

---

## 2. Locked decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | Free vs Pro | **Level 1 free.** Whole ladder visible. Levels 2–11 Pro. |
| 2 | Session granularity | **One level = one session.** Not a drip inside one long workout. |
| 3 | Names vs numbers | **Author both forms for every level.** Levels 1–2 speak names; 3+ speak numbers. Transition point is one config value. |
| 4 | Elbows | **Bonus Level 11**, unlocked after graduation, borrowing from Muay Sok / Elbow Arsenal. |
| 5 | Paths | **Data model supports many; ship one** (`foundations`). |
| 6 | Replays | **Count toward streaks; do not re-earn charms.** Matches existing charm behaviour. |

### Explicitly out of scope for v1

- Video or animation on lesson cards — the written lessons are already good and already paid for.
- Any form of assessment (rep counting, "did you land it", camera). The app cannot see the user and should not pretend.
- Additional paths (Path of the Mat, etc.). Shape the data for them; ship one.
- Cloud-synced progress. Everything else in the app is local; the roadmap should not be what introduces accounts.

---

## 3. Curriculum

**Ordering logic:** hands before legs (lowest injury risk, fastest wins);
distance before power (the teep teaches range, which every kick then needs);
defense arrives the moment the student can be countered; committed,
chin-exposing weapons last, because they punish bad fundamentals hardest.

**Invariant:** the union of `introduces` across Levels 1–10 is exactly the 32
`singles` in `INITIAL_TECHNIQUES.newb`. This is enforced by test, not by care.

| Lvl | Title | Introduces | Cum. | Tier |
|----|-------|-----------|------|------|
| 1 | Stance & the Two Numbers | Jab, Cross | 2 | Free |
| 2 | The Hooks | Left Hook, Right Hook | 4 | Pro |
| 3 | Owning the Distance | Left Teep, Right Teep | 6 | Pro |
| 4 | The Round Kick | Low Kick, Body Kick, Switch Kick | 9 | Pro |
| 5 | Don't Get Hit | Left Check, Right Check, High Guard Block, Long Guard | 13 | Pro |
| 6 | Move Your Head | Slip Left, Slip Right, Duck, Lean Back | 17 | Pro |
| 7 | Roll & Angle | Roll Left, Roll Right, Pivot Left, Pivot Right | 21 | Pro |
| 8 | Knees | Left Knee, Right Knee | 23 | Pro |
| 9 | Go to the Body | Jab to the Body, Cross to the Body, Left Hook to the Body, Right Hook to the Body | 27 | Pro |
| 10 | The Committed Shots | Left Uppercut, Right Uppercut, Overhand, Inside Leg Kick, Head Kick | 32 | Pro |
| — | **Graduation** | — | — | — |
| 11 | Bonus: Elbows | Left Elbow, Right Elbow, Up Elbow | +3 | Pro |

### Per-level rationale

1. **Stance & the Two Numbers.** Guard, stance, and the two punches every combination in the app is built on. Where `1` and `2` stop being noise.
2. **The Hooks.** Turning the hips into a punch for the first time. Also the numbers hand-off (see §5).
3. **Owning the Distance.** The teep before any round kick — safest thing the leg can do, and it teaches range, which every later kick depends on.
4. **The Round Kick.** The signature technique: shin, turnover, switch. Three heights of one mechanic, drilled together.
5. **Don't Get Hit.** Deliberately straight after kicks — the moment you can kick, you can be kicked. Checking is not an advanced idea.
6. **Move Your Head.** Blocks stop the shot; movement means it was never there. Also seeds the counters they will meet in The Answer Back.
7. **Roll & Angle.** Evasion that ends somewhere useful. Pivots are the first idea in the path that is neither strike nor shield — it is ring craft.
8. **Knees.** Khao, the weapon that makes this Muay Thai and not kickboxing. Held until the student can close distance safely.
9. **Go to the Body.** Same four punches, new target and new level change. Cheap once the hands are automatic, and it doubles the combination space. Introduces the `to the Body` suffix in the number language.
10. **The Committed Shots.** Everything that leaves you exposed if fundamentals are missing: uppercuts inside, overhand over the guard, inside leg kick, head kick.
11. **Bonus: Elbows** (post-graduation). Not in `newb`, so it sits past the finish line and doubles as a taste of a Pro style. Spinning elbows are deliberately left to Muay Sok.

### Combos per level

Both a named and a numbered form are authored for every level. Levels 1–2 play
the named form; Levels 3+ play the numbered form.

| Lvl | Numbered form (as played from L3) | Named form (as played L1–2) |
|----|-----------------------------------|------------------------------|
| 1 | `1 2` · `1 1 2` · `1 2 1` | `Jab, Cross` · `Jab, Jab, Cross` · `Jab, Cross, Jab` |
| 2 | `1 2 3` · `3 2` · `1 2 3 2` | `Jab, Cross, Left Hook` · `Left Hook, Cross` · `Jab, Cross, Left Hook, Cross` |
| 3 | `1, Left Teep` · `Right Teep, 2` · `1 2, Left Teep` · `Left Teep, 1 2` | (authored, unused) |
| 4 | `1 2, Body Kick` · `2 3, Low Kick` · `1 2, Switch Kick` · `1 2 3, Low Kick` | (authored, unused) |
| 5 | `Left Check, 1 2` · `Right Check, 2 3` · `High Guard Block, 2, Low Kick` · `Long Guard, 2 3` · `Right Check, Low Kick` | (authored, unused) |
| 6 | `1, Slip Right, 2` · `Slip Left, 2 3` · `Duck, 3 2` · `Lean Back, 2, Low Kick` · `1 2, Slip Right, 2` | (authored, unused) |
| 7 | `1 2, Roll Right, 2 3` · `2 3, Roll Left, 3 2` · `1 2 3, Pivot Left` · `Left Teep, Pivot Right, 2` · `Slip Left, 2, Pivot Left` | (authored, unused) |
| 8 | `1, Right Knee` · `2, Left Knee` · `1 2, Right Knee` · `Long Guard, Right Knee, Left Knee` | (authored, unused) |
| 9 | `1, 2 to the Body` · `1 2, 3 to the Body` · `1 to the Body, 2 3` · `1 2, 3 to the Body, 3 to the Head` · `2 3, 4 to the Body` | (authored, unused) |
| 10 | `1 2 5 2` · `Slip Right, 6 3` · `Overhand, Low Kick` · `Inside Leg Kick, 2 3` · `1 2, Head Kick` · `2 3, Low Kick, Head Kick` | (authored, unused) |
| 11 | `1 2, Right Elbow` · `3, Right Elbow` · `2, Up Elbow` · `1 2, Left Elbow, Right Elbow` | (authored, unused) |

> **Why author the unused forms.** Three reasons: the transition point becomes a
> one-line change if playtesting says Level 2 is too early or too late; a future
> "always speak names" accessibility toggle is then free; and the named form is
> what a split display/speech mode would need (see §9).

---

## 4. Anatomy of a level session

**Pre-session — Meet the technique.** Untimed cards for the *new* techniques
only: name, Thai name, number, key points, common mistakes. Resolved from the
existing lesson library by callout string. **Zero new lesson copy.**

Then three rounds:

| Round | Pool | Order | Purpose |
|-------|------|-------|---------|
| 1 — Introduction | New techniques only | Sequential | Time to find the shape of the movement. Not a test. |
| 2 — Integration | All cumulative singles | Random | First round that trains reaction rather than repetition. |
| 3 — Combinations | This level's combos | Random | The student now hears what the rest of the app sounds like. |

### Pinned session settings

A roadmap session sets its own configuration; the user does not choose. A
beginner picking "Pro" difficulty on Level 1 is a bad first experience.

- `roundMin`: 2 for Levels 1–4, 3 for Levels 5–11
- `restMinutes`: 1
- `roundsCount`: 3
- `difficulty`: `easy` for Levels 1–5, `medium` for Levels 6–11
- `addCalisthenics`: false
- `southpawMode`: inherited from the user's existing preference

> **Correction from the draft spec.** The draft proposed varying cadence
> *per round* (easy → easy → medium). `difficulty` drives both cadence and voice
> speed and sits in `useCalloutEngine`'s dependency array, so changing it
> mid-session restarts the callout loop — the same hazard as `readInOrder`
> (§6). **Difficulty is pinned per level, session-wide.** Only `readInOrder`
> varies per round, and that is exactly what the ref fix in §6 enables.

---

## 5. The names-to-numbers hand-off

This is the highest-value pedagogical detail in the feature, and the actual gap
being closed.

- Rounds 1 and 2 always speak singles by name (`Jab`, `Left Hook`). The `newb`
  singles are already authored as names, so this needs no new strings.
- Round 3 speaks the combo form for that level: **named** for Levels 1–2,
  **numbered** for Levels 3+.
- **Level 2's lesson card makes the hand-off explicit** — *from here on I'll
  call these by number* — with the mapping 1/2/3/4 and a pointer to the existing
  Header glossary.
- **Level 9's card extends the language** with the `to the Body` suffix.
- **Level 10's card adds 5 and 6** (uppercuts).

---

## 6. Technical design

### 6.1 Key discovery: the pool can be swapped mid-session

`useCalloutEngine` re-reads `currentPoolRef.current` on **every callout**
(`src/features/workout/hooks/useCalloutEngine.ts`, in `doCallout`). Therefore
swapping the pool at a round boundary requires **no engine change**.

`WorkoutProvider` already has a `handleRoundStart` callback (currently only
rings the bell). The per-round pool swap goes there:

```
handleRoundStart():
  if roadmapSession active:
    pool = poolForRound(level, timer.currentRound)
    calloutEngine.currentPoolRef.current = pool
    calloutEngine.orderedIndexRef.current = 0
  sfx.playBell()
```

### 6.2 The one required engine change

`readInOrder` is read from `settings` inside `startTechniqueCallouts`, and
`settings.readInOrder` is in that callback's dependency array. The auto-start
effect depends on the callback's identity, so **flipping `readInOrder`
mid-session tears down and restarts the callout loop.**

**Fix:** mirror the existing `southpawModeRef` / `voiceSpeedRef` pattern — add
`readInOrderRef` in `useWorkoutSettings`, keep it in sync via effect, and have
`doCallout` read `settings.readInOrderRef.current`. Remove `settings.readInOrder`
from the dependency array. This is a small, self-contained change that also
removes a latent bug for normal sessions.

### 6.3 Do not model the roadmap as an emphasis

`EmphasisKey` is a closed union hardcoded in three places in
`useWorkoutSettings` (initial state, `clearAllEmphases`, and the `timer_only` /
`freestyle` branch of `toggleEmphasis`). Every tile is a checkbox that composes
with the others.

A roadmap level is not a style you blend with Muay Sok — it is a scripted
session. It sets `calloutEngine.currentPoolRef.current` directly and bypasses
`generateTechniquePool` entirely. The emphasis system is left untouched.

### 6.4 Three places notice a session with no emphasis

1. **Logging.** `createWorkoutLogEntry` derives `emphases` labels from
   `settings.selectedEmphases`. A roadmap session must supply a synthetic label
   (`"Start Here · Level 4"`) and a structured `roadmap` field.
2. **Charms.** `distinctStyles()` in `features/logs/constants/charms.ts` counts
   distinct emphasis labels — a roadmap label would inflate *Jack of All
   Trades*. Add the roadmap label prefix to `NON_STYLE_LABELS`, or filter on the
   presence of the `roadmap` field.
3. **Resume & restart.** `resumeWorkout` and `restartSession` rebuild a session
   by mapping labels back to emphasis keys, which cannot work for a roadmap
   session. Both must branch on the log entry's `roadmap` field and re-launch by
   level id instead.

### 6.5 Charm plumbing

`readWorkoutHistory()` in `features/logs/utils/charms.ts` normalizes log entries
down to `{ timestamp, emphases, roundsCompleted, difficulty }`. Roadmap charms
need level completions, so:

- Extend `WorkoutLogLite` with `roadmap?: { pathId: string; levelId: number }`.
- Carry that field through `readWorkoutHistory()`'s mapping.
- New charm predicates count *distinct* completed levels, so replays cannot
  re-earn (decision 6).

`CharmCategory` gains a `"path"` member. The trophy case does not group by
category, so this is a type-only addition.

Proposed charms:

| id | Name | Earned when |
|----|------|-------------|
| `first_step` | First Step | Level 1 cleared |
| `half_the_alphabet` | Half the Alphabet | 5 distinct levels cleared |
| `graduate` | Graduate | Levels 1–10 all cleared |
| `sok_bonus` | Sharp Edges | Level 11 cleared |

### 6.6 Data model

```ts
// src/features/roadmap/data/paths.ts

export interface RoadmapLevel {
  id: number;                 // 1-based, ordered
  title: string;
  blurb: string;              // the "why this now" line from §3
  /** Callout strings introduced here. Must resolve to a Learn lesson. */
  introduces: string[];
  combosNumbered: string[];
  combosNamed: string[];
  free?: boolean;             // Level 1 only
  bonus?: boolean;            // Level 11 — sits past graduation
  session: {
    roundsCount: number;
    roundMin: number;
    restMinutes: number;
    difficulty: Difficulty;
  };
}

export interface RoadmapPath {
  id: string;                 // "foundations"
  title: string;
  levels: RoadmapLevel[];
  /** Which level first plays the numbered combo form. */
  numbersFromLevel: number;   // 3
  /** Emphasis key offered at graduation. */
  graduatesTo: EmphasisKey;   // "newb"
}
```

Cumulative singles for Level *n* are derived (`levels[0..n].introduces`), never
stored — the invariant in §3 depends on it.

### 6.7 Progress store

One localStorage key, `shotcaller_roadmap_progress`, added to
`src/constants/storage.ts`:

```json
{
  "version": 1,
  "paths": {
    "foundations": {
      "highestCleared": 4,
      "levels": {
        "1": { "firstClearedAt": "2026-08-10T18:22:04.000Z", "sessions": 2 }
      }
    }
  }
}
```

Completion is **attendance, not accuracy** — the app cannot see the student.
A level clears when its session reaches `onWorkoutComplete`.

### 6.8 Navigation & entry points

- `Page` union in `src/types/index.ts` gains `"roadmap"`.
- Route in `App.tsx` `renderPageContent()`, and add `"roadmap"` to the
  `useNavigationGestures` back-handler list alongside `"learn"`.
- **Entry points:** a dismissible "Start Here" banner above the style grid for
  anyone who has not cleared Level 1; a card in the `setup-action-row` beside
  *Learn the Techniques*; and a line in the onboarding Pro list
  (`OnboardingFlow.PRO_ITEMS`).

### 6.9 Pro gating

Mirror the Learn section exactly: the ladder is fully browsable, level titles
and what each teaches are visible, and `openPaywall("roadmap_level")` fires on
tapping a locked level. `useEntitlement().isPro` is the gate;
`level.free === true` bypasses it.

### 6.10 Analytics

New events in `AnalyticsEvents`:

- `roadmap_open` — `{ source }`
- `roadmap_level_start` — `{ path, level }`
- `roadmap_level_complete` — `{ path, level, replay }`
- `roadmap_graduate` — `{ path }`

Paywall opens are already tracked via the existing `openPaywall` source.

---

## 7. Tests

`src/__tests__/roadmapCoverage.test.ts`, twinning the existing
`learnCoverage.test.ts`:

1. Every string in every level's `introduces` resolves to a Learn lesson via
   `getEntryForCallout()`.
2. The union of `introduces` across Levels 1–10 **equals** the `singles` set of
   `INITIAL_TECHNIQUES.newb` — no extras, no omissions.
3. No technique is introduced twice across levels.
4. Every level has both `combosNumbered` and `combosNamed`, non-empty.
5. Exactly one level is marked `free`, and it is Level 1.

---

## 8. Build order

1. Data file + coverage tests (no UI). Locks the curriculum first.
2. `readInOrderRef` fix in `useWorkoutSettings` / `useCalloutEngine`.
3. Progress store + roadmap session launcher in `WorkoutProvider`, with the
   per-round pool swap in `handleRoundStart`.
4. Log entry `roadmap` field; `readWorkoutHistory` passthrough; resume/restart
   branching; `NON_STYLE_LABELS` fix.
5. Roadmap ladder screen + lesson cards + `Page` routing.
6. Pro gating, entry points, banner.
7. Charms + analytics.

Steps 1–2 are safe to land independently of everything else.

---

## 9. Possible follow-up (not v1)

**Split display and speech.** `currentCallout` drives both the on-screen text
and TTS. The ideal teaching moment is the screen showing `1 2` while the voice
says *"Jab, Cross"* — the mapping learned by association rather than
memorisation. This needs the engine to carry a display string alongside the
spoken one, and `ActiveSessionUI` to render it. Cheap-ish, genuinely valuable,
but it touches the engine's core loop, so it should not ride along with the
initial build.
