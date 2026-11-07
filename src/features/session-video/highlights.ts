import type { CallInfo } from "./calloutSignal";
import type { ClipCut } from "./motion";

/**
 * Which of a round's filmed callouts make the reel, and in what order.
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
 * The reel gets a share of its length from every round, no technique twice,
 * and each round ends on its best clip.
 */
export const REEL_MAX_MS = 30000;

/** A 1-round session gets a 12s reel; four rounds or more get the full 30s. */
export const reelBudgetMs = (rounds: number): number =>
  Math.min(REEL_MAX_MS, 6000 + 6000 * Math.max(1, rounds));

export const roundBudgetMs = (rounds: number): number =>
  reelBudgetMs(rounds) / Math.max(1, rounds);

/** Never more held than this many per round, waiting to be picked. */
const KEEP_PER_ROUND = 12;

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

export interface Candidate {
  /** Order filmed, for putting the picks back in time order. */
  seq: number;
  cut: ClipCut;
  calls: CallInfo[];
  score: number;
  /** The clip's video. */
  url: string;
  /** Lets go of the clip's video. */
  release(): void;
}

const sameTechnique = (c: Candidate): string =>
  (mainCall(c.calls)?.text ?? `#${c.seq}`).toLowerCase().replace(/\s+/g, " ");

export class RoundPicker {
  private held: Candidate[] = [];

  /** Offers a filmed clip; keeps it only while it could still be picked. */
  offer(c: Candidate): void {
    if (c.score <= 0) {
      c.release();
      return;
    }
    this.held.push(c);
    if (this.held.length > KEEP_PER_ROUND) {
      this.held.sort((a, b) => b.score - a.score);
      this.held.splice(KEEP_PER_ROUND).forEach((x) => x.release());
    }
  }

  /**
   * The round is over: the best clips that fit the round's share of the
   * reel, skipping techniques already in it (`shown`, which this adds to).
   * In the order filmed, except that the round's best comes last — the
   * reel builds to it. With `openStrong` (the first round), the runner-up
   * opens. Everything not picked is let go.
   */
  pick(
    budgetMs: number,
    shown: Set<string> = new Set(),
    openStrong = false
  ): Candidate[] {
    const byScore = [...this.held].sort((a, b) => b.score - a.score);
    const picked: Candidate[] = [];
    let used = 0;
    for (const c of byScore) {
      const len = c.cut.endMs - c.cut.startMs;
      const key = sameTechnique(c);
      if (shown.has(key) || (used + len > budgetMs && picked.length > 0)) {
        c.release();
        continue;
      }
      picked.push(c);
      shown.add(key);
      used += len;
    }
    this.held = [];
    if (picked.length < 2) return picked;

    const best = picked[0]!;
    const runnerUp = picked[1]!;
    const middle = picked
      .filter((c) => c !== best && !(openStrong && c === runnerUp))
      .sort((a, b) => a.seq - b.seq);
    return [...(openStrong ? [runnerUp] : []), ...middle, best];
  }

  /** Lets everything go without picking (the session was abandoned). */
  clear(): void {
    this.held.forEach((c) => c.release());
    this.held = [];
  }
}
