import type { CallInfo } from "./calloutSignal";

/**
 * How long the reel runs, and what the calls say about a clip: what kind of
 * technique it shows, and whether it was only defence. (Which clips make
 * the reel, and in what order: reelPlan.ts.)
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

/** A strike heard landing counts as much as a second of busy movement. */
export const HIT_WEIGHT = 1;

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
 * Whether a call is only defence (a check, a block, a slip): it moves a lot
 * on camera and shows little. Movement alone once filled a reel with checks.
 */
export const isDefenceOnly = (text: string): boolean => {
  const ps = parts(text);
  return ps.length > 0 && ps.every((p) => DEFENCE.test(p) && !POWER.test(p));
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
