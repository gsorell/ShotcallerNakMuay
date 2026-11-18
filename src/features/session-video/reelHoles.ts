/**
 * Holes in a recorded reel: stretches where the recorder got no frames at
 * all, and how to close them.
 *
 * The canvas is repainted every animation frame, so while the page runs the
 * recorder gets a frame every ~33 ms, even of a picture standing still. On an
 * iPhone the page sometimes stops running for most of a second at a time
 * while a reel is filmed (TestFlight builds 100, 102 and 103: one frame, then
 * none for 0.7-1.2 s, just after a clip starts). The animation loop stops
 * with it, so nothing in the renderer can see the stall or pause the tape
 * over it; played back, each hole is the one frame before it, frozen. Nothing
 * was recorded in a hole, so closing it afterwards loses nothing.
 */

/** A gap between two frames longer than this is a hole, never a picture. */
export const HOLE_S = 0.1;

/** A hole, in the recording's own time (seconds). */
export interface Hole {
  /** Where the cut starts: one frame step after the frame before the hole. */
  atS: number;
  /** How much is cut. */
  cutS: number;
}

/**
 * The holes among frames presented at `timestamps` (seconds, any order),
 * each closed down to the recording's usual frame step.
 */
export const findHoles = (timestamps: number[]): { holes: Hole[]; stepS: number } => {
  const ts = [...timestamps].sort((a, b) => a - b);
  const gaps = ts.slice(1).map((t, i) => ({ from: ts[i] ?? t, gap: t - (ts[i] ?? t) }));
  const usual = gaps
    .map((g) => g.gap)
    .filter((g) => g > 0.001 && g <= HOLE_S)
    .sort((a, b) => a - b);
  const stepS = usual[Math.floor(usual.length / 2)] ?? 1 / 30;
  const holes = gaps
    .filter((g) => g.gap > HOLE_S)
    .map((g) => ({ atS: g.from + stepS, cutS: g.gap - stepS }));
  return { holes, stepS };
};

/** Where a frame at `t` lands once `holes` are closed. */
export const closedTime = (t: number, holes: Hole[]): number => {
  let shift = 0;
  for (const h of holes) if (t >= h.atS + h.cutS - 1e-6) shift += h.cutS;
  return t - shift;
};

/** A stretch of the reel and where its sound starts (see laySoundUnderReel). */
export interface SoundPart {
  durMs: number;
  soundFromMs?: number;
}

/**
 * The reel's parts once `holes` are closed. A part with a hole in it is split
 * there, and the sound the hole spanned is cut with it: after the hole, the
 * sound picks up where it would have been, as before the cut. A card's part
 * is shortened only.
 */
export const closeHolesInParts = (parts: SoundPart[], holes: Hole[]): SoundPart[] => {
  const pending = [...holes]
    .sort((a, b) => a.atS - b.atS)
    .map((h) => ({ atMs: h.atS * 1000, cutMs: h.cutS * 1000 }));
  const out: SoundPart[] = [];
  let startMs = 0;
  for (const part of parts) {
    const endMs = startMs + part.durMs;
    let pos = 0;
    for (let hole = pending[0]; hole && hole.atMs < endMs; hole = pending[0]) {
      const at = Math.max(0, hole.atMs - startMs);
      const cut = Math.min(hole.cutMs, part.durMs - at);
      if (at > pos) out.push(slice(part, pos, at - pos));
      pos = at + cut;
      if (cut >= hole.cutMs) pending.shift();
      else {
        hole.cutMs -= cut;
        hole.atMs = endMs;
        break;
      }
    }
    if (part.durMs > pos) out.push(slice(part, pos, part.durMs - pos));
    startMs = endMs;
  }
  return out.filter((p) => p.durMs >= 1).map((p) => ({ ...p, durMs: Math.round(p.durMs) }));
};

const slice = (part: SoundPart, fromMs: number, durMs: number): SoundPart => ({
  durMs,
  ...(part.soundFromMs !== undefined ? { soundFromMs: Math.round(part.soundFromMs + fromMs) } : {}),
});
