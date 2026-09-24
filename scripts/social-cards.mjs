// ===========================================================================
// Social cards — post-ready imagery generated from the technique library.
// ---------------------------------------------------------------------------
// The account's problem was never discipline, it was inventory: 65 lessons and
// 37 sprite sheets already sit in this repo, and none of them have ever been
// posted. This turns that library into a queue in one command.
//
// Two card types, both 1080x1350 (Instagram's 4:5 portrait — the largest slot
// a static post gets in the feed):
//
//   technique  A silhouette, the name, the Thai name, and ONE cue.
//              Rule 2 of SOCIAL_VOICE.md: one idea per post.
//   mistake    The same figure with the lesson's `mistakes` list. This is the
//              format that actually travels — people share the thing they were
//              caught doing.
//
// Why type is rendered here when technique-reference-og.mjs refuses to
// ---------------------------------------------------------------------------
// That script's header states the objection plainly: rendering text through
// sharp's SVG rasteriser depends on whatever fonts the machine happens to
// have, and "a card whose headline silently falls back to Times is worse than
// a card with no headline."
//
// That is an argument against sharp's rasteriser, not against text. Chrome
// loads the real webfonts and, more importantly, can be ASKED whether it got
// them — `document.fonts.check()` below turns the silent failure into a hard
// one. sharp still does what it is genuinely better at: decoding sheets and
// measuring alpha.
//
// Uses playwright-core against the Chrome already on this machine, exactly
// like store-shots.mjs, so nothing downloads a second browser. Unlike that
// script it does NOT need the dev server — the lesson data is bundled straight
// out of TypeScript with esbuild, so a card can never disagree with the app.
//
// Run:  node scripts/social-cards.mjs
//       node scripts/social-cards.mjs --only=jab,teep --type=mistake
//
// Output: assets-src/social/<type>/<slug>.png  (+ captions.md)
//         Not under public/ — see store-shots.mjs for why generated marketing
//         art must never reach the web bundle or the native assets.
// ===========================================================================

import { chromium } from "playwright-core";
import esbuild from "esbuild";
import sharp from "sharp";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve();
const OUT = path.join(root, "assets-src/social");

const W = 1080;
const H = 1350;

// Straight from generate_blog.mjs. The cards have to look like they came off
// the same page as the blog and the app, not like a template with a logo on it.
const PALETTE = {
  bg: "#0c0710",
  panel: "#16101f",
  border: "#2e2240",
  accent: "#ff5fb0",
  cold: "#7cc7f2",
  heading: "#f4eef6",
  text: "#c7b8d1",
  muted: "#9d8fa9",
  dim: "#6d6079",
};

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];

const HANDLE = "@nakmuayshotcaller";

// --- args ------------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const wantType = args.type ?? "all";
const onlySlugs = args.only ? new Set(String(args.only).split(",")) : null;
const limit = args.limit ? Number(args.limit) : Infinity;

// --- 1. lesson data, straight out of TypeScript ----------------------------
//
// Bundled rather than parsed. A regex over techniqueLibrary.ts would work
// until the first entry that wraps a string differently, and it would fail
// silently by producing a card with half a sentence on it.

async function loadLibrary() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "shotcaller-social-"));
  const entry = path.join(tmp, "entry.mjs");
  const bundle = path.join(tmp, "bundle.mjs");
  const src = (p) => JSON.stringify(path.join(root, "src", p));

  await fs.writeFile(
    entry,
    `export { TECHNIQUE_LIBRARY, CATEGORY_META, lessonCard } from ${src("features/learn/data/techniqueLibrary.ts")};\n` +
      `export { spritesFor, LANDED_FRAME, SPRITE_FRAMES } from ${src("features/learn/data/techniqueSprites.ts")};\n`
  );

  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: bundle,
    alias: { "@": path.join(root, "src") },
    logLevel: "warning",
  });

  const mod = await import(`file://${bundle.replace(/\\/g, "/")}`);
  return { mod, cleanup: () => fs.rm(tmp, { recursive: true, force: true }) };
}

// --- 2. sprites ------------------------------------------------------------

/**
 * The alpha bounding box of a decoded cell. Lifted from
 * technique-reference-og.mjs, for the same reason it exists there: a cell is
 * mostly empty, and by wildly different amounts between a teep and a check.
 */
function inkBox(data, info) {
  let minX = info.width,
    maxX = -1,
    minY = info.height,
    maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("sheet cell is entirely transparent");
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * One figure as a transparent PNG data URI, cropped tight to its own ink.
 *
 * Cropping to the ink is why this needs no `inkOffset()` correction. That
 * function exists to nudge the five off-centre sheets back into the middle of
 * a fixed CELL box; here the box is thrown away and the ink itself becomes the
 * image, which centres all thirty-seven by construction.
 *
 * The cost is that relative scale between figures is lost — a check ends up
 * drawn as tall as a head kick. In the OG card's five-figure row that would
 * have been a lie about the techniques. On a card that shows exactly one
 * figure, seen days apart from the next one, filling the frame is worth more.
 */
async function figureDataUri(spriteSrc, LANDED_FRAME, SPRITE_FRAMES) {
  const file = path.join(root, "public", spriteSrc.replace(/^\//, ""));
  const meta = await sharp(file).metadata();
  const cell = meta.height;
  if (meta.width !== cell * SPRITE_FRAMES) {
    throw new Error(
      `${spriteSrc}: expected ${cell * SPRITE_FRAMES}x${cell} for ` +
        `${SPRITE_FRAMES} frames, got ${meta.width}x${meta.height}`
    );
  }

  const cellBuf = await sharp(file)
    .extract({ left: LANDED_FRAME * cell, top: 0, width: cell, height: cell })
    .ensureAlpha()
    .toBuffer();

  const { data, info } = await sharp(cellBuf).raw().toBuffer({ resolveWithObject: true });
  const box = inkBox(data, info);

  const png = await sharp(cellBuf)
    .extract(box)
    // 4x the on-card size. The silhouettes are the only real artwork on these
    // cards and Instagram recompresses everything it receives; upscaling a
    // 256px crop to fill 700px of frame would be visibly soft next to type.
    .resize({ width: box.width * 4, kernel: "lanczos3" })
    .png()
    .toBuffer();

  return `data:image/png;base64,${png.toString("base64")}`;
}

async function logoDataUri() {
  const png = await sharp(path.join(root, "public/assets/Logo_Header_Banner_Transparency.webp"))
    .resize({ width: 600 })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

// --- 3. what gets a card ---------------------------------------------------

const NUMBER_WORD = ["zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];

/**
 * Flatten the library into one job per FIGURE, not per lesson.
 *
 * A paired lesson (teep, check, the elbows) carries a `sides` record and two
 * sheets, and the two sides are deliberately written as separate copy — see
 * the SideLesson doc comment. Posting one card for "Teep" would have to pick
 * one of them and silently drop the other, so each side becomes its own post.
 */
function buildJobs({ TECHNIQUE_LIBRARY, CATEGORY_META, lessonCard, spritesFor }) {
  const categoryLabel = Object.fromEntries(CATEGORY_META.map((c) => [c.key, c.label]));
  const jobs = [];

  for (const entry of TECHNIQUE_LIBRARY) {
    const sheets = spritesFor(entry.slug);
    if (sheets.length === 0) continue; // not shot yet

    for (const sheet of sheets) {
      const card = lessonCard(entry, sheet.label);
      const slug = sheet.label
        ? `${entry.slug}-${sheet.label.toLowerCase()}`
        : entry.slug;
      jobs.push({
        slug,
        lessonSlug: entry.slug,
        name: card.name ?? entry.name,
        thai: entry.thai,
        numbering: entry.numbering,
        category: categoryLabel[entry.category] ?? entry.category,
        summary: card.summary,
        keyPoints: card.keyPoints ?? [],
        mistakes: card.mistakes ?? [],
        spriteSrc: sheet.src,
      });
    }
  }
  return jobs;
}

// --- 4. the cards ----------------------------------------------------------

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const FONTS = `
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@500&family=Public+Sans:wght@400;600;800&display=block">`;

/**
 * Anton ships ONE weight. Asking for a heavier one makes the browser
 * synthesise a faux-bold and the condensed face smears — the same warning
 * generate_blog.mjs carries. Every rule below asks for 400.
 */
const BASE_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: ${W}px; height: ${H}px; overflow: hidden;
  background: ${PALETTE.bg};
  color: ${PALETTE.text};
  font-family: 'Public Sans', -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  position: relative;
}
/* A wash behind the figure so it reads as lit rather than pasted on. */
body::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(ellipse 70% 45% at 50% 44%, #2a1030 0%, ${PALETTE.bg} 70%);
}
.card { position: relative; height: 100%; display: flex; flex-direction: column; padding: 64px 72px 56px; }
.eyebrow { display: flex; align-items: center; justify-content: space-between; }
.cat {
  font-family: 'IBM Plex Mono', monospace; font-weight: 500;
  font-size: 26px; letter-spacing: 0.22em; text-transform: uppercase;
  color: ${PALETTE.accent};
}
.num {
  font-family: 'Anton', sans-serif; font-weight: 400; font-size: 34px;
  color: ${PALETTE.heading};
  border: 3px solid ${PALETTE.border}; border-radius: 12px;
  padding: 6px 20px 2px; line-height: 1.25;
}
.name {
  font-family: 'Anton', sans-serif; font-weight: 400;
  text-transform: uppercase; color: ${PALETTE.heading};
  line-height: 0.92; letter-spacing: 0.01em;
}
.thai {
  font-family: 'IBM Plex Mono', monospace; font-weight: 500;
  font-size: 30px; color: ${PALETTE.cold}; letter-spacing: 0.08em; margin-top: 14px;
}
.figure { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
.figure img {
  max-height: 100%; max-width: 100%; object-fit: contain;
  /* The sheets are hot pink on transparent; this is what makes them glow
     instead of sitting flat on the wash. */
  filter: drop-shadow(0 0 28px rgba(255, 95, 176, 0.55))
          drop-shadow(0 0 70px rgba(255, 95, 176, 0.22));
}
.footer {
  display: flex; align-items: center; justify-content: space-between;
  border-top: 2px solid ${PALETTE.border}; padding-top: 26px; margin-top: 30px;
}
.footer img { width: 250px; opacity: 0.95; }
.footer span {
  font-family: 'IBM Plex Mono', monospace; font-weight: 500;
  font-size: 23px; color: ${PALETTE.dim}; letter-spacing: 0.05em;
}
.rule { position: absolute; left: 0; right: 0; bottom: 0; height: 8px; background: ${PALETTE.accent}; }`;

/**
 * Anton is condensed, so a long name fits far more than it looks like it will.
 * Stepping the size by length beats letting a 15-character name wrap onto a
 * second line and shove the figure out of the frame.
 */
function nameSize(name) {
  const n = name.length;
  if (n <= 9) return 130;
  if (n <= 14) return 108;
  if (n <= 19) return 88;
  return 72;
}

function techniqueCard(job, figure, logo) {
  const cue = job.keyPoints[0] ?? job.summary;
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}
.name { font-size: ${nameSize(job.name)}px; }
.cue {
  font-size: 38px; line-height: 1.42; color: ${PALETTE.heading}; font-weight: 400;
  border-left: 6px solid ${PALETTE.accent}; padding-left: 28px; margin-top: 22px;
}
</style></head><body><div class="card">
  <div class="eyebrow">
    <div class="cat">${esc(job.category)}</div>
    ${job.numbering ? `<div class="num">${esc(job.numbering)}</div>` : ""}
  </div>
  <div style="margin-top:26px">
    <div class="name">${esc(job.name)}</div>
    ${job.thai ? `<div class="thai">${esc(job.thai)}</div>` : ""}
  </div>
  <div class="figure"><img src="${figure}" alt=""></div>
  <div class="cue">${esc(cue)}</div>
  <div class="footer"><img src="${logo}" alt=""><span>${HANDLE}</span></div>
</div><div class="rule"></div></body></html>`;
}

function mistakeCard(job, figure, logo) {
  const items = job.mistakes
    .map((m) => `<li>${esc(m)}</li>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}
.name { font-size: ${nameSize(job.name)}px; }
.kicker {
  font-family: 'IBM Plex Mono', monospace; font-weight: 500; font-size: 26px;
  letter-spacing: 0.16em; text-transform: uppercase; color: ${PALETTE.muted}; margin-top: 16px;
}
/* The figure yields to the list here — the list is the post. It still has to
   FLEX rather than sit at a fixed height: it is the only element that can
   absorb the slack left by a short list, and pinning it leaves a band of dead
   ground under the footer. The cap goes on the image, not the box. */
.figure { margin: 8px 0 4px; }
.figure img { max-height: 400px; }
ul { list-style: none; display: flex; flex-direction: column; gap: 20px; }
li {
  position: relative; padding-left: 52px;
  font-size: 33px; line-height: 1.36; color: ${PALETTE.heading}; font-weight: 400;
}
/* Public Sans, not Anton: Anton has no U+00D7 and the browser substitutes it
   from whatever face it finds, which lands as a lumpy asterisk. */
li::before {
  content: '\\00d7'; position: absolute; left: 0; top: -3px;
  font-family: 'Public Sans', sans-serif; font-weight: 800;
  font-size: 40px; line-height: 1; color: ${PALETTE.accent};
}
</style></head><body><div class="card">
  <div class="eyebrow">
    <div class="cat">${esc(job.category)}</div>
    ${job.numbering ? `<div class="num">${esc(job.numbering)}</div>` : ""}
  </div>
  <div style="margin-top:26px">
    <div class="name">${esc(job.name)}</div>
    <div class="kicker">${NUMBER_WORD[job.mistakes.length] ?? job.mistakes.length} ways to ruin it</div>
  </div>
  <div class="figure"><img src="${figure}" alt=""></div>
  <ul>${items}</ul>
  <div class="footer"><img src="${logo}" alt=""><span>${HANDLE}</span></div>
</div><div class="rule"></div></body></html>`;
}

// --- 5. caption drafts -----------------------------------------------------
//
// DRAFTS. SOCIAL_VOICE.md §6 is explicit that generated copy is edited before
// it posts — the library's prose is written to be read on a lesson page, not
// to stop a thumb. These assemble the raw material in voice order (correction
// first, cost second) so the edit is a rewrite of two sentences, not a blank
// page.

const TAGS = "#NakMuay #MuayThai #ShotcallerNakMuay";

function caption(job, type) {
  if (type === "mistake") {
    return [
      `${job.name} — ${(NUMBER_WORD[job.mistakes.length] ?? job.mistakes.length).toLowerCase()} ways people ruin it:`,
      "",
      ...job.mistakes.map((m) => m.replace(/\.$/, "")),
      "",
      "[EDIT: pick the one that stings most and say why it feels like good work.]",
      "",
      TAGS,
    ].join("\n");
  }
  return [
    job.summary,
    "",
    ...job.keyPoints.slice(0, 2).map((k) => k),
    "",
    ...(job.thai ? [`${job.thai}`, ""] : []),
    "[EDIT: open on the correction, not the definition. Cut to one idea.]",
    "",
    TAGS,
  ].join("\n");
}

// --- 6. run ----------------------------------------------------------------

async function findChrome() {
  for (const p of CHROME) {
    try {
      await fs.access(p);
      return p;
    } catch {
      /* next */
    }
  }
  throw new Error(`No Chrome found. Looked in:\n  ${CHROME.join("\n  ")}`);
}

const { mod, cleanup } = await loadLibrary();
let jobs = buildJobs(mod);
if (onlySlugs) jobs = jobs.filter((j) => onlySlugs.has(j.slug) || onlySlugs.has(j.lessonSlug));
jobs = jobs.slice(0, limit);

if (jobs.length === 0) {
  await cleanup();
  throw new Error("No lessons matched. Check --only= against a slug in techniqueLibrary.ts.");
}

const types = wantType === "all" ? ["technique", "mistake"] : [String(wantType)];
for (const t of types) {
  if (t !== "technique" && t !== "mistake") {
    await cleanup();
    throw new Error(`Unknown --type=${t}. Use technique, mistake, or all.`);
  }
}

const logo = await logoDataUri();
const browser = await chromium.launch({ executablePath: await findChrome() });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

let fontsVerified = false;
const written = [];
const captions = [];
const skipped = [];

for (const t of types) {
  await fs.mkdir(path.join(OUT, t), { recursive: true });

  for (const job of jobs) {
    // A lesson with one mistake is a sentence, not a list. Rather than render a
    // card with a single bullet on it, say which lessons were passed over.
    if (t === "mistake" && job.mistakes.length < 2) {
      skipped.push(`${job.slug} (${job.mistakes.length} mistake${job.mistakes.length === 1 ? "" : "s"})`);
      continue;
    }

    const figure = await figureDataUri(job.spriteSrc, mod.LANDED_FRAME, mod.SPRITE_FRAMES);
    const html = t === "technique" ? techniqueCard(job, figure, logo) : mistakeCard(job, figure, logo);

    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);

    // The one check that makes rendering type here defensible. Google Fonts is
    // a network dependency, and a card that silently fell back to Arial is
    // exactly the failure technique-reference-og.mjs refused to risk. Fail
    // loudly on the first card instead of quietly on all seventy.
    if (!fontsVerified) {
      const got = await page.evaluate(() => ({
        anton: document.fonts.check('400 100px "Anton"'),
        mono: document.fonts.check('500 30px "IBM Plex Mono"'),
        sans: document.fonts.check('400 38px "Public Sans"'),
      }));
      const missing = Object.entries(got).filter(([, ok]) => !ok).map(([k]) => k);
      if (missing.length) {
        await browser.close();
        await cleanup();
        throw new Error(
          `Webfonts did not load: ${missing.join(", ")}.\n` +
            `These cards render type, so a fallback face would ship a card that is off-brand ` +
            `without looking broken. Check the network and re-run.`
        );
      }
      fontsVerified = true;
    }

    const file = path.join(OUT, t, `${job.slug}.png`);
    await page.screenshot({ path: file, type: "png" });
    written.push(path.relative(root, file));
    captions.push({ type: t, job });
  }
}

await browser.close();

// --- 7. the queue ----------------------------------------------------------

const md = [
  "# Caption drafts",
  "",
  `Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/social-cards.mjs\`.`,
  "",
  "**These are drafts.** `docs/SOCIAL_VOICE.md` §6 — generated copy is edited",
  "before it posts. The lesson prose was written for a lesson page; the edit is",
  "what makes it stop a thumb. Every block below carries an `[EDIT: ...]` line",
  "saying what that edit is. Delete the line when you have done it.",
  "",
  "---",
  "",
];
for (const { type, job } of captions) {
  md.push(`## ${job.name} — ${type}`, "", `\`assets-src/social/${type}/${job.slug}.png\``, "", "```", caption(job, type), "```", "");
}
await fs.writeFile(path.join(OUT, "captions.md"), md.join("\n"));

await cleanup();

console.log(
  `Wrote ${written.length} cards to ${path.relative(root, OUT)} ` +
    `(${types.join(" + ")}) at ${W}x${H}, from ${jobs.length} figures.`
);
if (skipped.length) {
  console.log(`Skipped ${skipped.length} mistake card(s) with fewer than 2 entries: ${skipped.join(", ")}`);
}
console.log(`Caption drafts: ${path.relative(root, path.join(OUT, "captions.md"))}`);
