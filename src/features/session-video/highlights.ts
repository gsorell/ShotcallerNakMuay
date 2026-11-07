import type { ClipCut } from "./motion";

/**
 * Which of a round's filmed callouts make the reel.
 *
 * The reel gets a share of its length from every round, so five rounds give
 * five rounds' best moments rather than one round's five best. Within a
 * round the busiest clips win. Clips that can't make it are let go as soon
 * as that is certain, so memory stays flat however long the session runs.
 */
export const REEL_MAX_MS = 30000;

/** A 1-round session gets a 12s reel; four rounds or more get the full 30s. */
export const reelBudgetMs = (rounds: number): number =>
  Math.min(REEL_MAX_MS, 6000 + 6000 * Math.max(1, rounds));

export const roundBudgetMs = (rounds: number): number =>
  reelBudgetMs(rounds) / Math.max(1, rounds);

/** Never more held than this many per round, waiting to be picked. */
const KEEP_PER_ROUND = 8;

export interface Candidate {
  /** Order filmed, for putting the picks back in time order. */
  seq: number;
  cut: ClipCut;
  /** The clip's video. */
  url: string;
  /** Lets go of the clip's video. */
  release(): void;
}

export class RoundPicker {
  private held: Candidate[] = [];

  /** Offers a filmed clip; keeps it only while it could still be picked. */
  offer(c: Candidate): void {
    if (c.cut.score <= 0) {
      c.release();
      return;
    }
    this.held.push(c);
    if (this.held.length > KEEP_PER_ROUND) {
      this.held.sort((a, b) => b.cut.score - a.cut.score);
      this.held.splice(KEEP_PER_ROUND).forEach((x) => x.release());
    }
  }

  /**
   * The round is over: the busiest clips that fit the round's share of the
   * reel, in the order they were filmed. Everything else is let go.
   */
  pick(budgetMs: number): Candidate[] {
    const byScore = [...this.held].sort((a, b) => b.cut.score - a.cut.score);
    const picked: Candidate[] = [];
    let used = 0;
    for (const c of byScore) {
      const len = c.cut.endMs - c.cut.startMs;
      if (used + len > budgetMs && picked.length > 0) {
        c.release();
        continue;
      }
      picked.push(c);
      used += len;
    }
    this.held = [];
    return picked.sort((a, b) => a.seq - b.seq);
  }

  /** Lets everything go without picking (the session was abandoned). */
  clear(): void {
    this.held.forEach((c) => c.release());
    this.held = [];
  }
}
