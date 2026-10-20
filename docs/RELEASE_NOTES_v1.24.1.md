# Release Notes — v1.24.1

**Date:** 2026-10-20
**versionCode:** 112
**Type:** Patch. Two callout fixes in the session engine. No change to
purchases, audio routing, the native projects beyond the version, or the store
listing.

---

## Summary

Two things a user hears have changed since v1.24.0. Both are in the round, both
make the callouts closer to what a corner would actually say.

---

## 1. "Between callouts" follows combinations only

The "Between callouts" option (a jab or a check thrown in between calls) added
its extra call after **every** callout from the pool, single shots included.
Most styles are about half singles, so with it on roughly three calls in four
were single shots and the combinations were buried. Muay Khao: 38% of calls
heard were combinations with it off, 19% with it on.

Pool entries now carry whether they came from a style's combos, and the
between-callout follows only those. Khao with it on goes back up to 27%. The
"shots called" count still includes the extra calls, since they are work done.

[src/utils/techniqueUtils.ts](../src/utils/techniqueUtils.ts),
[src/features/workout/hooks/useCalloutEngine.ts](../src/features/workout/hooks/useCalloutEngine.ts)

## 2. The ten-second warning no longer names the next style

When consecutive rounds used different styles, the ten-second warning during
rest said "Next, Muay Khao". The voices are English-only and mangle the Thai
names ("Muay Femur" comes out as the bone), so the cue taught the wrong word.
It now says "10 seconds" and leaves the next round to the rest screen, which
still shows it.

[src/features/workout/contexts/WorkoutProvider.tsx](../src/features/workout/contexts/WorkoutProvider.tsx)

---

## Files changed

| Area | Files |
|---|---|
| Between callouts | `utils/techniqueUtils.ts`, `workout/hooks/useCalloutEngine.ts`, `workout/utils/roundPlan.ts`, `workout/components/RoundStructureSheet.tsx`, `types/index.ts` |
| Rest warning | `workout/contexts/WorkoutProvider.tsx` |

Commits: `90d0f2c`, `9a93cc7`. (`236a33f`, `14f599e` and `bf7463c` are
dashboard and store-art tooling and do not ship.)

---

## Store copy

### App Store — What's New

```
Sharper callouts.

- With "Between callouts" on, the extra jab or check now follows combinations only, so your combos are no longer buried under single shots.
- The ten-second warning during rest just says "10 seconds". The next round's style is still on the rest screen.
```

### Play — Release notes (≤500 chars)

```
Sharper callouts.
- With "Between callouts" on, the extra jab or check now follows combinations only, so your combos are no longer buried under single shots.
- The ten-second warning during rest just says "10 seconds". The next round's style is still on the rest screen.
```

---

## Test plan

**Automated:** 357 tests across 27 files pass, `tsc` clean. The between-callout
change has its own test in `techniqueWeighting.test.ts`.

### Manual smoke test

- [ ] Golden path: start a workout, first callout, rest, second round, complete.
- [ ] Between callouts on, a combo-heavy style: the jab or check follows
      combinations, never a single shot.
- [ ] Two rounds with different styles: the warning in rest says only
      "10 seconds"; the rest screen shows the next style.
