// ===========================================================================
// How a session's rounds are structured.
// ---------------------------------------------------------------------------
// A normal session used to be one flat pool read for every round. This turns
// the user's structure choices into a plan — one entry per round — and each
// entry into the pool the callout engine reads for that round. The engine
// re-reads its pool ref on every callout, so swapping it at a round boundary
// never restarts the loop; the guided path has always worked this way.
//
// Everything here is pure, so the rules (who gets which round, what happens
// when there are more styles than rounds) can be tested without a timer.
// ===========================================================================

import type { TechniquesShape, TechniqueWithStyle } from "@/types";
import { generateTechniquePool } from "@/utils/techniqueUtils";

export type MixMode = "blend" | "by_round";
export type CalisthenicsPlacement = "sprinkled" | "finisher" | "final_round";
export type IntensityShape = "steady" | "ramp" | "pyramid";

export interface RoundStructure {
  /** How several selected styles share the session. */
  mixMode: MixMode;
  /** Where calisthenics go, when they are switched on at all. */
  calisthenics: CalisthenicsPlacement;
  /** Round 1 calls single techniques only. */
  buildUp: boolean;
  /** How the pace moves from round to round. */
  intensity: IntensityShape;
  /**
   * `by_round` only: the style chosen for each round. `null` leaves the round
   * to the rotation; `BLEND_ALL` makes it a blended round.
   */
  customRounds: (string | null)[];
}

/** A round set, by hand, to draw on every selected style. */
export const BLEND_ALL = "*";

export const DEFAULT_ROUND_STRUCTURE: RoundStructure = {
  mixMode: "blend",
  calisthenics: "sprinkled",
  buildUp: false,
  intensity: "steady",
  customRounds: [],
};

const MIX_MODES: MixMode[] = ["blend", "by_round"];
const PLACEMENTS: CalisthenicsPlacement[] = [
  "sprinkled",
  "finisher",
  "final_round",
];
const SHAPES: IntensityShape[] = ["steady", "ramp", "pyramid"];

/** Whether a structure changes anything about a session at all. */
export function isDefaultStructure(s: RoundStructure): boolean {
  return (
    s.mixMode === "blend" &&
    s.calisthenics === "sprinkled" &&
    !s.buildUp &&
    s.intensity === "steady"
  );
}

/** Anything read back from storage or a log entry goes through here first. */
export function sanitizeRoundStructure(raw: unknown): RoundStructure {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ROUND_STRUCTURE };
  const r = raw as Partial<RoundStructure>;
  return {
    mixMode: MIX_MODES.includes(r.mixMode as MixMode)
      ? (r.mixMode as MixMode)
      : DEFAULT_ROUND_STRUCTURE.mixMode,
    calisthenics: PLACEMENTS.includes(r.calisthenics as CalisthenicsPlacement)
      ? (r.calisthenics as CalisthenicsPlacement)
      : DEFAULT_ROUND_STRUCTURE.calisthenics,
    buildUp: r.buildUp === true,
    intensity: SHAPES.includes(r.intensity as IntensityShape)
      ? (r.intensity as IntensityShape)
      : DEFAULT_ROUND_STRUCTURE.intensity,
    customRounds: Array.isArray(r.customRounds)
      ? r.customRounds
          .slice(0, 20)
          .map((k) => (typeof k === "string" && k ? k : null))
      : [],
  };
}

// Modes rather than styles: they carry no techniques, so they take no round.
const MODE_KEYS = new Set(["timer_only", "freestyle"]);

/**
 * The selected styles in the order they were picked.
 *
 * The selection itself is a map and remembers nothing about order, so this is
 * carried alongside it: whatever is still selected keeps its place, and
 * anything newly selected joins the end.
 */
export function reconcileStyleOrder(
  prev: readonly string[],
  selected: Record<string, boolean>
): string[] {
  const isOn = (k: string) => Boolean(selected[k]) && !MODE_KEYS.has(k);
  const kept = prev.filter(
    (k, i) => isOn(k) && prev.indexOf(k) === i
  );
  const added = Object.keys(selected).filter(
    (k) => isOn(k) && !kept.includes(k)
  );
  return [...kept, ...added];
}

export interface PlannedRound {
  /** Styles feeding this round. Empty on a calisthenics-only round. */
  styles: string[];
  content: "all" | "singles";
  calisthenics: "none" | "sprinkled" | "finisher" | "only";
  /** Multiplies the gap between callouts: above 1 is easier, below is faster. */
  paceFactor: number;
}

/** The easiest and hardest a round's pace is ever pushed. */
export const SLOWEST_PACE = 1.2;
export const FASTEST_PACE = 0.85;

export function paceFactors(shape: IntensityShape, rounds: number): number[] {
  const n = Math.max(1, Math.floor(rounds));
  if (shape === "steady" || n === 1) return Array(n).fill(1);
  const lerp = (t: number) =>
    Math.round((SLOWEST_PACE + (FASTEST_PACE - SLOWEST_PACE) * t) * 1000) /
    1000;
  return Array.from({ length: n }, (_, i) => {
    const along = i / (n - 1);
    // Two rounds cannot peak in the middle, so a pyramid there is a ramp.
    if (shape === "ramp" || n < 3) return lerp(along);
    return lerp(1 - Math.abs(2 * along - 1));
  });
}

export function planRounds(input: {
  structure: RoundStructure;
  /** Selected styles, in the order they were picked. */
  styles: readonly string[];
  roundsCount: number;
  addCalisthenics: boolean;
}): PlannedRound[] {
  const { structure, addCalisthenics } = input;
  const styles = [...input.styles];
  const total = Math.max(1, Math.floor(input.roundsCount));
  const pace = paceFactors(structure.intensity, total);

  // A session of one round has no "final" round to give away, so calisthenics
  // fall back to being mixed in rather than replacing the whole workout.
  const calRound =
    addCalisthenics && structure.calisthenics === "final_round" && total >= 2;
  const styleRounds = calRound ? total - 1 : total;
  const calisthenics: PlannedRound["calisthenics"] = !addCalisthenics
    ? "none"
    : structure.calisthenics === "finisher"
    ? "finisher"
    : calRound
    ? "none"
    : "sprinkled";

  const stylesFor = (i: number): string[] => {
    if (styles.length <= 1 || structure.mixMode === "blend") return styles;
    // A round someone set by hand wins. A choice that is no longer selected
    // is ignored, so the round goes back to the rotation.
    const pick = structure.customRounds[i];
    if (pick === BLEND_ALL) return styles;
    if (pick && styles.includes(pick)) return [pick];
    // Otherwise one style per round, in the order they were picked, cycling
    // when there are rounds to spare. With fewer rounds than styles nothing is
    // dropped: the last round blends whatever has not had a round of its own.
    if (styleRounds >= styles.length) return [styles[i % styles.length]!];
    if (i < styleRounds - 1) return [styles[i]!];
    return styles.slice(styleRounds - 1);
  };

  const plan: PlannedRound[] = [];
  for (let i = 0; i < styleRounds; i += 1) {
    plan.push({
      styles: stylesFor(i),
      // A warm-up needs something to warm up for.
      content: structure.buildUp && i === 0 && styleRounds >= 2 ? "singles" : "all",
      calisthenics,
      paceFactor: pace[i]!,
    });
  }
  if (calRound) {
    plan.push({
      styles: [],
      content: "all",
      calisthenics: "only",
      paceFactor: pace[total - 1]!,
    });
  }
  return plan;
}

/** Identifies a round's pool, so an in-order walk can pick up where it left. */
export function poolKey(round: PlannedRound): string {
  return `${round.styles.join("+")}|${round.content}|${round.calisthenics}`;
}

/** Whether any round differs from the first — i.e. there is something to say. */
export function planVaries(plan: readonly PlannedRound[]): boolean {
  const first = plan[0];
  if (!first) return false;
  return plan.some(
    (r) => poolKey(r) !== poolKey(first) || r.paceFactor !== first.paceFactor
  );
}

/**
 * How long the calisthenics finisher runs at the end of a round. Thirty
 * seconds of a normal round; a third of a short one, so a one-minute round is
 * not half burpees; nothing at all when the round is too short to split.
 */
export function finisherSeconds(roundMin: number): number {
  const roundSec = Math.round((Number(roundMin) || 0) * 60);
  const window = Math.min(30, Math.floor(roundSec / 3));
  return window >= 10 ? window : 0;
}

/** A share of the callouts, and what to call when that share comes up. */
export interface PoolShare {
  entries: TechniqueWithStyle[];
  share: number;
}

export interface RoundPool {
  /** Every callout in the round — what an in-order walk reads. */
  flat: TechniqueWithStyle[];
  /**
   * Set when several styles share the round. A random pick chooses a style
   * first and a technique second, so a style with sixty entries does not
   * drown one with ten.
   */
  shares: PoolShare[] | null;
}

const only = (key: string) => ({ [key]: true }) as Record<string, boolean>;

export function calisthenicsPool(
  techniques: TechniquesShape,
  techniqueIndex: Record<string, string>
): TechniqueWithStyle[] {
  return generateTechniquePool(
    techniques,
    only("calisthenics") as never,
    false,
    techniqueIndex
  );
}

export function buildRoundPool(
  techniques: TechniquesShape,
  round: PlannedRound,
  techniqueIndex: Record<string, string>
): RoundPool {
  if (round.calisthenics === "only") {
    return { flat: calisthenicsPool(techniques, techniqueIndex), shares: null };
  }
  if (round.styles.length === 0) return { flat: [], shares: null };

  const sprinkled = round.calisthenics === "sprinkled";

  // One style, everything in it: exactly the pool the app has always built.
  if (round.styles.length === 1 && round.content === "all") {
    return {
      flat: generateTechniquePool(
        techniques,
        only(round.styles[0]!) as never,
        sprinkled,
        techniqueIndex
      ),
      shares: null,
    };
  }

  const poolOf = (key: string): TechniqueWithStyle[] => {
    if (round.content === "singles") {
      const singles = generateTechniquePool(
        techniques,
        only(key) as never,
        false,
        techniqueIndex,
        { only: "singles" }
      );
      // A style made only of combinations still gets its round.
      if (singles.length) return singles;
    }
    return generateTechniquePool(
      techniques,
      only(key) as never,
      false,
      techniqueIndex
    );
  };

  const lanes = round.styles.map(poolOf).filter((lane) => lane.length > 0);
  const cal = sprinkled ? calisthenicsPool(techniques, techniqueIndex) : [];
  if (lanes.length === 0) return { flat: cal, shares: null };

  // Calisthenics keep the share they always had — their slice of the combined
  // list — and the styles split the rest evenly between them.
  const styleCount = lanes.reduce((sum, lane) => sum + lane.length, 0);
  const calShare = cal.length / (cal.length + styleCount);
  const shares: PoolShare[] = lanes.map((entries) => ({
    entries,
    share: (1 - calShare) / lanes.length,
  }));
  if (cal.length) shares.push({ entries: cal, share: calShare });

  // Dealt round-robin, so reading in order alternates between the styles
  // rather than walking the whole of the first before reaching the second.
  const all = cal.length ? [...lanes, cal] : lanes;
  const longest = all.reduce((max, lane) => Math.max(max, lane.length), 0);
  const flat: TechniqueWithStyle[] = [];
  for (let i = 0; i < longest; i += 1) {
    for (const lane of all) {
      if (i < lane.length) flat.push(lane[i]!);
    }
  }

  return { flat, shares: shares.length > 1 ? shares : null };
}

export function pickFromShares(
  shares: readonly PoolShare[],
  rng: () => number = Math.random
): TechniqueWithStyle | undefined {
  const total = shares.reduce((sum, s) => sum + s.share, 0);
  if (!(total > 0)) return undefined;
  let roll = rng() * total;
  let chosen = shares[shares.length - 1]!;
  for (const s of shares) {
    roll -= s.share;
    if (roll < 0) {
      chosen = s;
      break;
    }
  }
  if (!chosen.entries.length) return undefined;
  return chosen.entries[Math.floor(rng() * chosen.entries.length)];
}

/** What a round is, in words — for the rest screen and the plan preview. */
export function describeRound(
  round: PlannedRound,
  labelOf: (styleKey: string) => string
): { title: string; labels: string[]; notes: string[] } {
  const labels =
    round.calisthenics === "only"
      ? ["Calisthenics"]
      : round.styles.map(labelOf);
  const notes: string[] = [];
  if (round.content === "singles") notes.push("Single techniques only");
  if (round.calisthenics === "finisher") notes.push("Calisthenics finisher");
  if (round.paceFactor > 1) notes.push("Easier pace");
  if (round.paceFactor < 1) notes.push("Faster pace");
  return { title: labels.join(" + "), labels, notes };
}

/** The one line the setup screen shows for the current structure. */
export function structureSummary(
  structure: RoundStructure,
  styleCount: number,
  addCalisthenics: boolean
): string {
  const parts: string[] = [];
  if (styleCount >= 2) {
    parts.push(
      structure.mixMode === "by_round" ? "One style per round" : "Blended"
    );
  }
  if (structure.buildUp) parts.push("Warm-up round");
  if (structure.intensity === "ramp") parts.push("Building pace");
  if (structure.intensity === "pyramid") parts.push("Pyramid pace");
  if (addCalisthenics && structure.calisthenics === "finisher") {
    parts.push("Finisher");
  }
  if (addCalisthenics && structure.calisthenics === "final_round") {
    parts.push("Calisthenics round");
  }
  return parts.length ? parts.join(" · ") : "Standard";
}
