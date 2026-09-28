# Release Notes — v1.20.1

**Date:** 2026-09-27
**versionCode:** 106
**Type:** Bug fix. The pre-round countdown only. No change to the callout engine, the round or rest clocks, entitlement, logging, or the completion screen.

---

## Summary

A user sent a video of the app stuck on **"Get Ready!" at 5**. The countdown
never advanced and the Pause button did nothing; Stop was the only way out. It
happened to him in Timer Only, Freestyle and Nak Muay Newb alike, on an iPad.

The countdown could be killed outright by a single timer the platform failed to
deliver. It now reads a deadline instead of counting ticks, and has three
independent ways to recover. Pause also works during the countdown, where it had
never done anything at all.

---

## 1. Root cause

[src/features/workout/hooks/useWorkoutTimer.ts](../src/features/workout/hooks/useWorkoutTimer.ts)

The countdown was a chained `setTimeout`:

```js
const id = window.setTimeout(() => setPreRoundTimeLeft((t) => t - 1), 1000);
return () => window.clearTimeout(id);
```

Each tick existed only because the previous one fired and changed
`preRoundTimeLeft`, which re-ran the effect and armed the next. The effect's
other dependencies (`isPreRound`, `roundMin`, `onRoundStart`) do not change
during a countdown, so that chain was its own only means of rescheduling.

One undelivered timer therefore did not make the countdown *late*. It ended it,
permanently, with nothing left in the system able to re-arm it. `running` stays
false throughout pre-round, so no other state change could nudge it either.

The round and rest clocks never had this problem because `setInterval` re-arms
itself. Pre-round was the only phase built on a single-shot chain, and the
callout watchdog that would otherwise have caught it is explicitly disabled
during pre-round ([useCalloutEngine.ts:271](../src/features/workout/hooks/useCalloutEngine.ts#L271)).

**What triggered the lost timer on that device is still unknown.** It has never
reproduced unassisted — see the test plan below for what was ruled out. iOS has
several ways to defer or discard a timer (scrolling, WebView suspend/resume, Low
Power Mode coalescing). This release removes the mechanism that turns any of them
into a permanent freeze; it does not identify which one it was.

## 2. The fix

The countdown now reads an absolute deadline rather than counting:

- `startTimer` records `Date.now() + 5000`.
- A self-rearming 250ms interval computes `Math.ceil(remaining / 1000)`.
- A late tick costs a fraction of a second, a missed one costs nothing, and a
  stall longer than the whole countdown lands on the round rather than stopping
  short of it.

Three independent ways to advance, so nothing depends on one surviving: the
interval, an immediate check each time the effect runs, and `visibilitychange` —
which catches up a WebView that binned its timers while backgrounded.

`preRoundFiredRef` latches the handover to round one. Without it the transition
could re-fire and reset `timeLeft`; under test this showed up as the round clock
pinned at 3:00.

## 3. Pause during the countdown

`pauseTimer` and `pauseSession` both gated on `running`, which stays false for
the whole countdown — so the Pause button sat on screen through every session
doing nothing. It now works. Pausing banks the remaining milliseconds and
rebuilds the deadline on resume, so it never eats into the count.

[WorkoutProvider.tsx](../src/features/workout/contexts/WorkoutProvider.tsx): a
paused countdown reports status `paused` rather than `pre-round`. Otherwise it
reads as "Get Ready!" over a number that has stopped moving — indistinguishable
from the freeze this exists to escape. The wake lock now releases while paused
too.

---

## Files changed

| File | Change |
|---|---|
| `src/features/workout/hooks/useWorkoutTimer.ts` | Deadline-based countdown, recovery paths, transition latch, pause support |
| `src/features/workout/contexts/WorkoutProvider.tsx` | Pause guard, paused status during pre-round, wake lock on pause |

Commits: `f2e49f8`, merged as `31aa4af`.

---

## Test plan

Fault injection at the scheduling primitives, old build and new side by side,
against the production bundle:

| Fault | v1.20.0 | v1.20.1 |
|---|---|---|
| none | passes | passes |
| one dropped tick | **frozen at 5 forever** | passes |
| 8s total timer stall | **frozen** | catches up, starts round |
| all pre-round timers dead, then foreground | **frozen** | recovers, starts round |
| pause during countdown | **button does nothing** | holds count, resumes correctly |

Ruled out as causes along the way, each verified against the production build:
wake lock released in a loop, `wakeLock.request` never settling, no wake lock API
at all (NoSleep fallback), `speechSynthesis.speak` never calling back, CPU
throttled 6× and 20×. A hanging `decodeAudioData` was also ruled out — it blocks
`startSession` before `startTimer`, producing no Get Ready screen at all, which
is not the reported symptom.

`tsc -b` clean; 259 tests across 23 files pass.

### Manual smoke test

- [ ] Countdown runs 5→1 and starts the round, in all three free modes.
- [ ] Countdown lasts an honest five seconds (it previously ran long on slow devices).
- [ ] Pause during "Get Ready" holds the number and says "Paused"; Resume continues from there.
- [ ] Background mid-countdown and return — see the behaviour note below.
- [ ] Round, rest and completion unaffected.

---

## Behaviour change worth knowing

Backgrounding the app *during* the countdown now behaves differently. Previously
the chained timeout was throttled while hidden, so the countdown stretched and
carried on from roughly where it was on return. Now the five seconds elapse in
real time, so backgrounding for ten seconds and returning drops you into round
one with the bell already rung.

Note the three phases now differ: a running round auto-pauses when hidden
([useWorkoutTimer.ts:190](../src/features/workout/hooks/useWorkoutTimer.ts#L190)),
rest does not, and pre-round now runs on wall-clock. Making pre-round auto-pause
on hide would make it consistent, at the cost of requiring a Resume tap after a
stray notification during the most common five seconds in the app. Deliberately
left as-is pending a product call.

For everyone unaffected by the bug, the other differences are: the countdown is
now exactly five seconds rather than five timeouts plus per-tick overhead, and
digits can turn over up to 250ms late (below the threshold of noticing).

---

## Note on versioning

v1.20.0 (versionCode 105) was bumped and has release notes, but whether it
reached either store is not recorded in the repo. This ships as 1.20.1 /
versionCode 106 because a higher `versionCode` is always accepted while reusing
one that was already uploaded fails hard at Play Console.

**If 1.20.0 never reached users, the store "What's New" copy must cover the
completion screen redesign as well as this fix.**
