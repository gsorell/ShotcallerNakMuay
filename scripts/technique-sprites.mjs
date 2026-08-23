#!/usr/bin/env node
// ===========================================================================
// TECHNIQUE SPRITES — turn raw shoot footage into the neon silhouette sheets
// the Learn / roadmap lesson cards display.
// ---------------------------------------------------------------------------
// One dependency: ffmpeg on PATH. No ImageMagick, no cwebp — ffmpeg keys the
// background, recolours the silhouette, adds the glow, tiles the frames and
// encodes the WebP in a single pass per technique.
//
// The shoot itself is specified in docs/TECHNIQUE_SHOT_LIST.md. This script
// assumes that spec: fixed tripod, plain background that contrasts strongly
// with the fighter. The keying is a luminance threshold, which is exactly why
// the shot list cares about contrast and not about lighting quality.
//
//   node scripts/technique-sprites.mjs --init            # stub manifest, 25 slugs
//   node scripts/technique-sprites.mjs                   # build everything
//   node scripts/technique-sprites.mjs --only jab        # rebuild one
//   node scripts/technique-sprites.mjs --only jab --frames
//
// `--frames` writes the six frames as separate PNGs instead of a sheet. Use it
// while dialling in `threshold` for a clip: the keying is the only part of this
// that needs a human eye, and a contact sheet of six PNGs is how you find the
// number. Everything downstream is deterministic.
// ===========================================================================

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The 25 lessons that cover the whole Start Here roadmap, in curriculum order.
// Source of truth for the list is docs/TECHNIQUE_SHOT_LIST.md; this copy only
// exists so `--init` can write a manifest you can fill in as you shoot.
const TIER_ONE = [
  "jab", "cross", "lead-hook", "rear-hook", "teep",
  "low-kick", "roundhouse-kick", "switch-kick", "check", "high-guard",
  "long-guard", "slip", "duck", "lean-back", "roll",
  "pivot", "straight-knee", "body-punching", "lead-uppercut", "rear-uppercut",
  "overhand", "inside-low-kick", "head-kick", "horizontal-elbow", "up-elbow",
];

const DEFAULTS = {
  /** Frames per sheet. Load → travel → land → recover, with room to breathe. */
  frames: 6,
  /**
   * Find the moment of furthest extension and hang the frames off it, rather
   * than sampling evenly across the window.
   *
   * This is not a refinement, it is the difference between catching the strike
   * and missing it. A jab is at full extension for roughly 60ms; six frames
   * spread evenly over a two-second window land one every 333ms and step
   * straight over it, producing six near-identical frames of guard and a sprite
   * that looks like the technique was never thrown.
   *
   * Set to a number to pin the extension to an exact timestamp instead of
   * detecting it, or false to go back to even sampling.
   */
  anchor: true,
  /**
   * Which frame the extension lands on, 1-based. Four of six leaves three
   * frames of wind-up and two of recovery, which is how a strike reads.
   */
  anchorFrame: 4,
  /** Cell size in px. 256 is 2x the ~150px slot, which is the retina case. */
  size: 256,
  /**
   * Everything on the wall side of this luma (0–1) becomes transparent. This is
   * the one knob you will actually turn: raise it if the fighter is getting
   * eaten, lower it if the wall is surviving. Tune it with --frames.
   *
   * 0.72 suits a white-ish wall. Note this is NOT ffmpeg's lumakey threshold —
   * see buildFilter, which converts it, because lumakey keys a band centred on
   * its threshold rather than everything past it.
   */
  cutoff: 0.72,
  /**
   * Feathers the cut edge before thresholding. Left at 0 with `solid` on, where
   * the source-resolution downscale supplies the anti-aliasing instead.
   */
  softness: 0,
  /**
   * Passes of morphological OPENING (erode, then dilate) on the mask, in source
   * pixels. Real rooms have thin dark features the key cannot tell from a
   * fighter: the seam where a wall meets the floor, scuff marks, a skirting
   * line. They are thin and a body is not, so opening deletes them and leaves
   * the silhouette. Drop to 0 to keep fine detail such as open fingers.
   */
  clean: 3,
  /**
   * Passes of morphological CLOSING (dilate, then erode), in source pixels.
   * The opposite job: fills interior holes and bridges broken outlines. A limb
   * at full speed is motion-blurred, so its edge blends toward the wall and the
   * key drops out in patches — that is what reads as a chewed profile and
   * shading inside the body. Closing welds those gaps shut.
   */
  close: 3,
  /**
   * Force every pixel of the mask fully opaque or fully clear.
   *
   * Feathered keying leaves half-transparent pixels wherever the fighter's luma
   * sits near the cutoff — motion-blurred limbs, shadowed cloth — and those read
   * as grey shading inside a silhouette that should be one flat colour. The
   * anti-aliasing is not lost: the mask is built at source resolution and the
   * downscale to the cell re-softens the outline.
   */
  solid: true,
  /** "bright" = light wall, dark fighter. "dark" = the other way round. */
  background: "bright",
  /** Bright core, saturated glow — the app's roadmap accent pair. */
  color: "#f9a8d4",
  glowColor: "#ec4899",
  glow: 6,
  /**
   * libwebp compression effort (0–6). Not image quality: the encode is lossless
   * and has to be — see runFfmpeg.
   */
  effort: 6,
};

const MANIFEST = "raw/shots.json";
const OUT_DIR = "public/assets/technique";

// ------------------------------------------------------------------- args --

function parseArgs(argv) {
  const args = { only: null, frames: false, init: false, manifest: MANIFEST, out: OUT_DIR };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--init") args.init = true;
    else if (a === "--frames") args.frames = true;
    else if (a === "--only") args.only = argv[++i];
    else if (a === "--manifest") args.manifest = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else die(`Unknown argument: ${a}`);
  }
  return args;
}

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

// ------------------------------------------------------------------ ffmpeg --

function requireFfmpeg() {
  const probe = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    die("ffmpeg is not on PATH. Install it and try again — it is the only dependency.");
  }
  return probe.stdout.split("\n")[0];
}

/** "#ec4899" → { r: 236, g: 72, b: 153 } */
function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) die(`Not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * The filtergraph, and the only interesting part of this script.
 *
 * Order matters more than any single filter here. Everything that shapes the
 * mask happens at SOURCE resolution, and the downscale to the cell comes last.
 * Run the morphology after the downscale instead and it chews visible 256px
 * blocks out of the outline; run it before, and the same passes act on single
 * source pixels while the downscale quietly anti-aliases the result.
 *
 * lumakey turns the wall into alpha; the mask is then binarised, opened to drop
 * room noise and closed to weld motion-blur gaps; geq repaints whatever survived
 * as flat colour; the split/blur/overlay pair puts a soft saturated copy behind
 * a bright core, which is what reads as neon; tile lays the frames out in a row.
 */
function buildFilter(shot, { sequence = false } = {}) {
  const { frames, size, cutoff, softness, background, glow, clean, close, solid } = shot;
  const core = rgb(shot.color);
  const halo = rgb(shot.glowColor);

  // Sampling rate that lands `frames` samples inside `duration` seconds. Only
  // used when the frames were not already chosen by anchoring.
  const fps = (frames / shot.duration).toFixed(6);
  const pick = sequence ? "" : `fps=${fps},`;

  const flip = shot.flip ? "hflip," : "";

  // Optional framing crop, as "w:h:x:y" in source pixels. You shoot wide enough
  // to keep the feet in on a head kick, which leaves a stance shot swimming in
  // empty room; this is how a clip gets tightened without a reshoot. Because the
  // tripod does not move, one crop usually serves every take from a session.
  const crop = shot.crop ? `crop=${shot.crop},` : "";

  // lumakey keys a BAND centred on `threshold`, half-width `tolerance` — it is
  // not a cutoff. Pinning threshold at 1 and setting tolerance to 1-cutoff makes
  // the keyed band [cutoff, 1], which is the "everything brighter than this is
  // wall" behaviour we actually want. Getting this wrong keys a mid-grey band
  // and leaves a white wall fully opaque, which looks like the filter silently
  // doing nothing.
  const tolerance = (1 - cutoff).toFixed(4);
  const invert = background === "dark" ? "negate," : "";
  const key =
    `format=rgba,${invert}lumakey=threshold=1:tolerance=${tolerance}:softness=${softness}`;

  // Mask surgery, on the alpha plane only.
  const rep = (filter, n) => Array.from({ length: n }, () => filter);
  const steps = [];
  if (solid) steps.push("geq=lum='if(gt(lum(X,Y),128),255,0)'");
  if (clean > 0) steps.push(...rep("erosion", clean), ...rep("dilation", clean));
  if (close > 0) steps.push(...rep("dilation", close), ...rep("erosion", close));

  const mask = steps.length
    ? `,split[mk][ma];[ma]alphaextract,${steps.join(",")}[mm];[mk][mm]alphamerge`
    : "";

  // Square cell: fit the whole fighter inside, pad rather than crop further. A
  // clipped head kick is a worse failure than empty space in a stance shot.
  // lanczos because this downscale is now doing the anti-aliasing.
  const fit =
    `scale=${size}:${size}:force_original_aspect_ratio=decrease:flags=lanczos,` +
    `pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=#00000000`;

  const paint = (c) => `geq=r='${c.r}':g='${c.g}':b='${c.b}':a='alpha(X,Y)'`;

  const head = `${pick}${flip}${crop}${key}${mask},${fit}`;

  if (!glow) return `${head},${paint(core)}`;

  return (
    `${head},split=2[a][b];` +
    `[a]${paint(core)}[core];` +
    `[b]${paint(halo)},gblur=sigma=${glow}[halo];` +
    `[halo][core]overlay=0:0:format=auto`
  );
}
/**
 * The timestamp of furthest extension inside the window.
 *
 * Measured as the horizontal span of the silhouette, counting only columns that
 * hold a few stacked dark pixels. The column threshold matters: a bare bounding
 * box is pinned to the full frame width on every single frame by the one-pixel
 * wall/floor seam, which makes every frame look equally extended.
 */
function findExtension(shot) {
  const W = 120, H = 140, FPS = 30, MIN_COL = 3;

  const run = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-ss", String(shot.start), "-t", String(shot.duration),
    "-i", shot.file,
    "-vf", `fps=${FPS},${shot.crop ? `crop=${shot.crop},` : ""}scale=${W}:${H},format=gray`,
    "-pix_fmt", "gray", "-f", "rawvideo", "-",
  ], { maxBuffer: 1 << 28 });

  if (run.status !== 0 || !run.stdout) return null;

  const buf = run.stdout;
  const frames = Math.floor(buf.length / (W * H));
  if (frames < 2) return null;

  const cut = Math.round(shot.cutoff * 255);
  const darkBg = shot.background === "dark";
  const widths = new Int32Array(frames);

  for (let f = 0; f < frames; f++) {
    const off = f * W * H;
    const col = new Int32Array(W);
    for (let y = 0; y < H; y++) {
      const row = off + y * W;
      for (let x = 0; x < W; x++) {
        const v = buf[row + x];
        if (darkBg ? v > cut : v < cut) col[x]++;
      }
    }
    let lo = -1, hi = -1;
    for (let x = 0; x < W; x++) if (col[x] >= MIN_COL) { if (lo < 0) lo = x; hi = x; }
    widths[f] = hi < 0 ? 0 : hi - lo + 1;
  }

  const sorted = [...widths].sort((a, b) => a - b);
  const median = sorted[Math.floor(frames / 2)];
  let peak = 0;
  for (let f = 1; f < frames; f++) if (widths[f] > widths[peak]) peak = f;

  // A window with no strike in it has no peak worth anchoring to; say so rather
  // than anchoring on noise.
  if (widths[peak] - median < 4) return null;

  return { t: shot.start + peak / FPS, width: widths[peak], median };
}

/** Frame timestamps with the extension landing on `anchorFrame`. */
function anchoredTimes(shot, peakTime) {
  const step = shot.duration / shot.frames;
  const times = [];
  for (let i = 0; i < shot.frames; i++) {
    times.push(Math.max(0, peakTime + (i - (shot.anchorFrame - 1)) * step));
  }
  return times;
}

/**
 * Pull the chosen frames one at a time, then key and tile them as a sequence.
 * Six seeks costs a little more than one decode pass and buys exact timing.
 */
function runAnchored(shot, outPath, asFrames, times) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sprite-"));
  try {
    times.forEach((t, i) => {
      const grab = spawnSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", String(t), "-i", shot.file, "-frames:v", "1",
        "-update", "1", path.join(tmp, `f${String(i + 1).padStart(2, "0")}.png`),
      ], { encoding: "utf8" });
      if (grab.status !== 0) throw new Error(grab.stderr || "frame grab failed");
    });

    const filter = buildFilter(shot, { sequence: true });
    const tiled = asFrames ? filter : `${filter},tile=${shot.frames}x1`;

    const args = [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", path.join(tmp, "f%02d.png"),
      "-filter_complex", tiled,
    ];
    if (asFrames) {
      args.push("-frames:v", String(shot.frames), outPath);
    } else {
      args.push("-frames:v", "1", "-c:v", "libwebp",
                "-lossless", "1", "-compression_level", String(shot.effort),
                "-pix_fmt", "yuva420p", outPath);
    }

    const run = spawnSync("ffmpeg", args, { encoding: "utf8" });
    if (run.status !== 0) {
      console.error(run.stderr?.trim() || "(no stderr)");
      return false;
    }
    return true;
  } catch (err) {
    console.error(String(err.message || err).trim());
    return false;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function runFfmpeg(shot, outPath, asFrames) {
  const filter = buildFilter(shot);
  const tiled = asFrames ? filter : `${filter},tile=${shot.frames}x1`;

  // -ss before -i is the fast seek; the clip is already close to the mark
  // because the slate makes takes easy to find.
  const args = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(shot.start),
    "-t", String(shot.duration),
    "-i", shot.file,
    "-filter_complex", tiled,
  ];

  if (asFrames) {
    args.push("-frames:v", String(shot.frames), outPath);
  } else {
    // Lossless is not a quality preference, it is a correctness requirement.
    // ffmpeg's lossy libwebp path writes a bare `VP8 ` chunk, which has no way
    // to store alpha at all — the sheet encodes "successfully" and every
    // silhouette comes out on an opaque black box. Only the lossless `VP8L`
    // path carries the alpha channel. Flat-coloured silhouettes compress well
    // losslessly anyway, so this costs very little.
    args.push("-frames:v", "1", "-c:v", "libwebp",
              "-lossless", "1", "-compression_level", String(shot.effort),
              "-pix_fmt", "yuva420p", outPath);
  }

  const run = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (run.status !== 0) {
    console.error(run.stderr?.trim() || "(no stderr)");
    return false;
  }
  return true;
}

// -------------------------------------------------------------------- init --

function writeStubManifest(file) {
  if (fs.existsSync(file)) die(`${file} already exists — delete it first if you mean to start over.`);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const stub = {
    _readme: [
      "One entry per lesson. `file` is the clip, `start` is the second the rep",
      "begins at, `duration` covers load through recover — usually 0.7-1.2s for",
      "a punch, 1.0-1.6s for a kick. Anything in `defaults` can be overridden",
      "per shot; `threshold` is the one you will actually reach for.",
      "Set `flip: true` to mirror a shot. Delete entries you have not filmed yet —",
      "the script skips what is missing rather than failing the run.",
    ].join(" "),
    defaults: DEFAULTS,
    shots: TIER_ONE.map((slug) => ({ slug, file: `raw/${slug}.mov`, start: 0, duration: 1 })),
  };

  fs.writeFileSync(file, JSON.stringify(stub, null, 2) + "\n");
  console.log(`\n  Wrote ${file} with ${TIER_ONE.length} stub entries.`);
  console.log(`  Fill in file/start/duration as you cut takes, then run the script again.\n`);
}

// -------------------------------------------------------------------- main --

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.init) {
    writeStubManifest(args.manifest);
    return;
  }

  console.log(`\n  ${requireFfmpeg()}`);

  if (!fs.existsSync(args.manifest)) {
    die(`No manifest at ${args.manifest}. Run with --init to create one.`);
  }

  const manifest = JSON.parse(fs.readFileSync(args.manifest, "utf8"));
  const defaults = { ...DEFAULTS, ...(manifest.defaults ?? {}) };
  let shots = (manifest.shots ?? []).map((s) => ({ ...defaults, ...s }));

  if (args.only) {
    shots = shots.filter((s) => s.slug === args.only);
    if (!shots.length) die(`No shot with slug "${args.only}" in ${args.manifest}.`);
  }

  fs.mkdirSync(args.out, { recursive: true });

  let built = 0;
  let skipped = 0;
  let failed = 0;

  for (const shot of shots) {
    if (!fs.existsSync(shot.file)) {
      console.log(`  ·  ${shot.slug.padEnd(18)} no footage yet (${shot.file})`);
      skipped++;
      continue;
    }

    const out = args.frames
      ? path.join(args.out, `${shot.slug}-%02d.png`)
      : path.join(args.out, `${shot.slug}.webp`);

    // Anchor first: without it a fast strike is simply not in the sheet.
    let peak = null;
    let note = "";
    if (shot.anchor === true) {
      peak = findExtension(shot);
      if (!peak) note = "  (no strike found — even sampling)";
    } else if (typeof shot.anchor === "number") {
      peak = { t: shot.anchor };
    }

    const ok = peak
      ? runAnchored(shot, out, args.frames, anchoredTimes(shot, peak.t))
      : runFfmpeg(shot, out, args.frames);

    if (ok) {
      const label = args.frames
        ? `${shot.frames} frames`
        : `${(fs.statSync(out).size / 1024).toFixed(0)} KB`;
      const at = peak ? ` @ ${peak.t.toFixed(2)}s` : "";
      console.log(`  ✓  ${shot.slug.padEnd(18)} ${label}${at}${note}`);
      built++;
    } else {
      console.log(`  ✗  ${shot.slug.padEnd(18)} ffmpeg failed`);
      failed++;
    }
  }

  console.log(
    `\n  ${built} built · ${skipped} awaiting footage · ${failed} failed\n`
  );
  if (failed) process.exit(1);
}

main();
