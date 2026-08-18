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
  /** Feathers the cut edge. A little is what stops the silhouette looking cut out. */
  softness: 0.05,
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
 * fps picks `frames` evenly across the trimmed clip; lumakey turns the wall
 * into alpha; geq repaints whatever survived as a flat colour while preserving
 * that alpha; the split/blur/overlay pair puts a soft saturated copy behind a
 * bright core, which is what reads as neon; tile lays the frames out in a row.
 */
function buildFilter(shot) {
  const { frames, size, cutoff, softness, background, glow } = shot;
  const core = rgb(shot.color);
  const halo = rgb(shot.glowColor);

  // Sampling rate that lands `frames` samples inside `duration` seconds. tile
  // consumes exactly `frames`, so an extra sample from rounding is harmless.
  const fps = (frames / shot.duration).toFixed(6);

  // Optional framing crop, as "w:h:x:y" in source pixels. You shoot wide enough
  // to keep the feet in on a head kick, which leaves a stance shot swimming in
  // empty room; this is how a clip gets tightened without a reshoot. Because the
  // tripod does not move, one crop usually serves every take from a session.
  const crop = shot.crop ? `crop=${shot.crop},` : "";

  // Square cell: fit the whole fighter inside, pad rather than crop further. A
  // clipped head kick is a worse failure than empty space in a stance shot.
  const fit =
    `${crop}scale=${size}:${size}:force_original_aspect_ratio=decrease,` +
    `pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=#00000000`;

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

  const flip = shot.flip ? "hflip," : "";

  const paint = (c) => `geq=r='${c.r}':g='${c.g}':b='${c.b}':a='alpha(X,Y)'`;

  const head = `fps=${fps},${flip}${key},${fit}`;

  if (!glow) return `${head},${paint(core)}`;

  return (
    `${head},split=2[a][b];` +
    `[a]${paint(core)}[core];` +
    `[b]${paint(halo)},gblur=sigma=${glow}[halo];` +
    `[halo][core]overlay=0:0:format=auto`
  );
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

    if (runFfmpeg(shot, out, args.frames)) {
      const label = args.frames
        ? `${shot.frames} frames`
        : `${(fs.statSync(out).size / 1024).toFixed(0)} KB`;
      console.log(`  ✓  ${shot.slug.padEnd(18)} ${label}`);
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
