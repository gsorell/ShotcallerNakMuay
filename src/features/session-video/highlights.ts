import type { CallInfo } from "./calloutSignal";
import type { ClipCut } from "./motion";

/**
 * What a filmed callout is worth, and how long the reel runs. (Which ones
 * make the reel, and in what order: reelPlan.ts.)
 *
 * A clip is judged on three things:
 *
 *   what landed   strikes heard hitting pads or a bag (the strongest signal,
 *                 when there is one: shadowboxing makes none)
 *   what moved    movement in the frame, against the session's own norm
 *   what was called — the app knows the technique, so it doesn't have to
 *                 guess it from the picture. Longer combinations and kicks,
 *                 knees and elbows count for more; a call that is only
 *                 defence (a check, a block) for much less. Movement alone
 *                 had filled a reel with checks: a raised leg near the lens
 *                 changes more pixels than a jab–cross across the room.
 *
 */
export const REEL_MIN_MS = 12000;
export const REEL_MAX_MS = 40000;
/** Added per minute of work, above the minimum. */
const REEL_MS_PER_WORK_MINUTE = 2000;

/**
 * How long the reel runs: 12s, growing with the work (a 5 × 3 session
 * reaches the 40s cap).
 *
 * History: 4s a minute up to a minute made 15+ clips of jump cuts; then a
 * 20s cap (2026-11-13) left two clips a round. A hand-cut 24–42s reel of a
 * 5 × 3 session, one technique type at a time, was preferred (2026-11-19):
 * the jump cuts came from repeats and bad framing, not from length.
 */
export const reelBudgetMs = (workMs: number): number =>
  Math.min(
    REEL_MAX_MS,
    REEL_MIN_MS + (REEL_MS_PER_WORK_MINUTE * workMs) / 60000
  );

/** A technique type (techniqueFamily) appears at most this many times in a reel. */
export const MAX_SHOWINGS = 2;

/** One hit counts for this much more than an ordinary clip's movement. */
const HIT_WEIGHT = 1.2;

const DEFENCE =
  /\b(check|block|parry|catch|slip|roll|duck|sway|lean|pull|guard|cover|step|pivot|shuffle|evade|weave|frame)\b/i;
const POWER =
  /\b(kick|knee|elbow|teep|uppercut|overhand|spinning|superman|sweep|dump)\b/i;

const parts = (text: string): string[] =>
  text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

/**
 * How much a called technique is worth showing, before anything about how it
 * was thrown: 1 for a single strike, more for a longer combination or one
 * with a kick, knee or elbow in it, much less for a call that is all defence.
 */
export const techniqueWeight = (text: string): number => {
  const ps = parts(text);
  if (!ps.length) return 1;
  const defenceOnly = ps.every((p) => DEFENCE.test(p) && !POWER.test(p));
  if (defenceOnly) return 0.25;
  const w = 1 + 0.35 * (ps.length - 1) + (ps.some((p) => POWER.test(p)) ? 0.4 : 0);
  return Math.min(2.5, w);
};

/** What kind of strike one part of a call is, for telling techniques apart on screen. */
const strikeClass = (part: string): string => {
  const p = part.toLowerCase();
  if (DEFENCE.test(p) && !POWER.test(p)) return "defence";
  if (/elbow/.test(p)) return "elbow";
  if (/knee/.test(p)) return "knee";
  if (/teep|push kick|front kick/.test(p)) return "teep";
  if (/\b(low|leg|calf|inside)\b.*kick|kick.*\b(low|leg|calf)\b/.test(p)) return "low kick";
  if (/kick/.test(p)) return "kick";
  if (/jab|cross|hook|uppercut|overhand|punch|straight|superman|^\s*[1-6]\s*$/.test(p)) return "punch";
  return p.trim().replace(/\s+/g, " ");
};

/**
 * What a call looks like on camera: its strikes by kind, in order, repeats
 * running together. "Jab, Cross, Left Kick" and "Cross, Right Kick" are both
 * "punch→kick" — on the bag they look the same, though the words differ.
 * Defence is left out unless it's all there is.
 */
export const techniqueFamily = (text: string): string => {
  const classes = parts(text).map(strikeClass);
  const attack = classes.filter((c) => c !== "defence");
  const seq = (attack.length ? attack : classes).filter((c, i, all) => c !== all[i - 1]);
  return seq.join("→") || text.toLowerCase().trim();
};

/** The clip's main call: the combination, not the check that followed it. */
export const mainCall = (calls: CallInfo[]): CallInfo | undefined =>
  calls.find((c) => !c.between) ?? calls[0];

/**
 * A clip's worth. `motionNorm` is what an ordinary clip's movement amounts
 * to this session, so movement is judged against the room, the light and
 * the distance it was filmed at.
 */
export const scoreClip = (
  cut: ClipCut,
  calls: CallInfo[],
  motionNorm: number
): number => {
  if (cut.endMs <= cut.startMs) return 0;
  const activity =
    cut.motion / Math.max(1e-6, motionNorm) + HIT_WEIGHT * cut.hits;
  return activity * techniqueWeight(mainCall(calls)?.text ?? "");
};

/**
 * How many strikes should land on a bag or pads for a clip's calls: each
 * attacking part once, a numbered part per number ("2 3" is two punches),
 * defence not at all, a between-call's attacks included. Lets the trim end
 * on the combination's last strike rather than guess from movement.
 */
export const expectedHits = (calls: CallInfo[]): number =>
  calls.reduce(
    (n, c) =>
      n +
      parts(c.text).reduce((m, p) => {
        if (DEFENCE.test(p) && !POWER.test(p)) return m;
        const numbers = p.match(/\b[1-6]\b/g)?.length ?? 0;
        return m + Math.max(1, numbers);
      }, 0),
    0
  );

/**
 * How many moves a clip holds: the strikes in its combination, plus one for
 * a between-call that followed. Sets how long the clip may run.
 */
export const strikesIn = (calls: CallInfo[]): number => {
  const main = mainCall(calls);
  const n = main ? parts(main.text).length : 1;
  return Math.max(1, n) + (calls.some((c) => c.between) ? 1 : 0);
};
