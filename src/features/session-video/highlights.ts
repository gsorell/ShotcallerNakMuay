import type { CallInfo } from "./calloutSignal";
import type { ClipCut } from "./motion";
import type { Crop } from "./reelRenderer";

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
 * a technique at most twice and never twice running, and each round ends on
 * its best clip.
 */
export const REEL_MIN_MS = 12000;
export const REEL_MAX_MS = 60000;
/** Reel per minute of work. 5 × 3 minutes makes the full minute. */
const REEL_MS_PER_WORK_MINUTE = 4000;

/**
 * How long the reel runs, from how much work went into it. A flat 30s cap
 * shared over five rounds left two or three clips a round, and a 15-minute
 * session came out as 17 seconds.
 */
export const reelBudgetMs = (workMs: number): number =>
  Math.min(
    REEL_MAX_MS,
    Math.max(REEL_MIN_MS, (REEL_MS_PER_WORK_MINUTE * workMs) / 60000)
  );

export const roundBudgetMs = (workMs: number, rounds: number): number =>
  reelBudgetMs(workMs) / Math.max(1, rounds);

/** A technique appears at most this many times in a reel. */
export const MAX_SHOWINGS = 2;

/** The rough length of a clip, for how many to hold while a round runs. */
const TYPICAL_CLIP_MS = 2200;

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

/**
 * How many moves a clip holds: the strikes in its combination, plus one for
 * a between-call that followed. Sets how long the clip may run.
 */
export const strikesIn = (calls: CallInfo[]): number => {
  const main = mainCall(calls);
  const n = main ? parts(main.text).length : 1;
  return Math.max(1, n) + (calls.some((c) => c.between) ? 1 : 0);
};

export interface Candidate {
  /** Order filmed, for putting the picks back in time order. */
  seq: number;
  cut: ClipCut;
  calls: CallInfo[];
  score: number;
  /** Where in the frame to show; the whole frame if absent. */
  crop?: Crop;
  /** The clip's busiest moment, ms from its start: where slow motion goes. */
  peakMs?: number;
  /** The clip's video. */
  url: string;
  /** Lets go of the clip's video. */
  release(): void;
}

export const techniqueKey = (c: Candidate): string =>
  (mainCall(c.calls)?.text ?? `#${c.seq}`).toLowerCase().replace(/\s+/g, " ");

/** What the reel has shown so far, across rounds. */
export interface ReelSoFar {
  /** Times each technique has appeared. */
  shown: Map<string, number>;
  /** The technique the reel currently ends on. */
  lastKey?: string;
}

export const newReelSoFar = (): ReelSoFar => ({ shown: new Map() });

/**
 * Reorders so no technique follows itself, as far as the clips allow. `before`
 * is what the reel ends on already. The last clip (the round's best) stays
 * last unless it is the only thing that can move.
 */
export const avoidRepeatsInARow = (
  list: Candidate[],
  before?: string
): Candidate[] => {
  const out = [...list];
  const last = out.length - 1;
  for (let i = 0; i < out.length; i++) {
    const prev = i === 0 ? before : techniqueKey(out[i - 1]!);
    if (prev === undefined || techniqueKey(out[i]!) !== prev) continue;
    // Swap in the nearest later clip that differs, sparing the finale; the
    // finale only if nothing else can.
    let j = -1;
    for (let k = i + 1; k < last; k++) {
      if (techniqueKey(out[k]!) !== prev) {
        j = k;
        break;
      }
    }
    if (j < 0 && i < last && techniqueKey(out[last]!) !== prev) j = last;
    if (j >= 0) [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

export class RoundPicker {
  private held: Candidate[] = [];
  private readonly keep: number;

  /** `budgetMs`: this round's share of the reel, for how many to hold. */
  constructor(budgetMs: number) {
    this.keep = Math.max(12, Math.ceil((budgetMs / TYPICAL_CLIP_MS) * 2.5));
  }

  /** Offers a filmed clip; keeps it only while it could still be picked. */
  offer(c: Candidate): void {
    if (c.score <= 0) {
      c.release();
      return;
    }
    this.held.push(c);
    if (this.held.length > this.keep) {
      this.held.sort((a, b) => b.score - a.score);
      this.held.splice(this.keep).forEach((x) => x.release());
    }
  }

  /**
   * The round is over: the best clips that fit the round's share of the
   * reel, with no technique past MAX_SHOWINGS across the reel (`soFar`,
   * which this updates). In the order filmed, except that the round's best
   * comes last — the reel builds to it — and with `openStrong` (the first
   * round) the runner-up opens. No technique follows itself where the clips
   * allow. Everything not picked is let go.
   */
  pick(
    budgetMs: number,
    soFar: ReelSoFar = newReelSoFar(),
    openStrong = false
  ): Candidate[] {
    const byScore = [...this.held].sort((a, b) => b.score - a.score);
    const picked: Candidate[] = [];
    const counts = new Map(soFar.shown);
    let used = 0;
    for (const c of byScore) {
      const len = c.cut.endMs - c.cut.startMs;
      const key = techniqueKey(c);
      const times = counts.get(key) ?? 0;
      if (times >= MAX_SHOWINGS || (used + len > budgetMs && picked.length > 0)) {
        c.release();
        continue;
      }
      picked.push(c);
      counts.set(key, times + 1);
      used += len;
    }
    this.held = [];
    if (!picked.length) return picked;

    let ordered = picked;
    if (picked.length >= 2) {
      const best = picked[0]!;
      const runnerUp = picked[1]!;
      const middle = picked
        .filter((c) => c !== best && !(openStrong && c === runnerUp))
        .sort((a, b) => a.seq - b.seq);
      ordered = [...(openStrong ? [runnerUp] : []), ...middle, best];
    }
    ordered = avoidRepeatsInARow(ordered, soFar.lastKey);
    soFar.shown = counts;
    soFar.lastKey = techniqueKey(ordered[ordered.length - 1]!);
    return ordered;
  }

  /** Lets everything go without picking (the session was abandoned). */
  clear(): void {
    this.held.forEach((c) => c.release());
    this.held = [];
  }
}
