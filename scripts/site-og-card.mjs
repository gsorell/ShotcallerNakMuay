// ===========================================================================
// The site-wide social preview card.
// ---------------------------------------------------------------------------
// index.html has always pointed og:image at /assets/hero_og.jpg, which is the
// hero's BACKGROUND PLATE - a bare purple-to-teal gradient with nothing on it.
// Every time the site was pasted into Instagram, iMessage, Discord or Slack,
// the preview was that empty wash: no logo, no wordmark, no title. The tag was
// working exactly as written; what it pointed at was never a card.
//
// This builds the card. Same gradient as the ground, so it still looks like
// the site, with the thing that was missing on top of it.
//
// Why Chrome and not sharp
// ---------------------------------------------------------------------------
// technique-reference-og.mjs - the sibling that makes the blog's animated
// reference card - deliberately renders NO text, and its header says why:
// sharp's SVG rasteriser uses whatever fonts the machine happens to have, and
// "a card whose headline silently falls back to Times is worse than a card
// with no headline." That objection is sound and it applies here too.
//
// social-cards.mjs answers it: Chrome loads the real webfonts and can be ASKED
// whether it got them. The `document.fonts.check()` below turns a silent
// fallback into a hard failure, so this card can carry the tagline that the
// sharp-based sibling had to leave off. Uses playwright-core against the
// Chrome already installed, exactly like store-shots.mjs - nothing downloads a
// second browser.
//
// Run:  node scripts/site-og-card.mjs
// Only needs re-running if the logo, the gradient or the tagline change.
//
// Output: public/assets/og-card.jpg
//         Under public/ ON PURPOSE, unlike the Instagram art in
//         assets-src/social/. An og:image has to be fetchable by a scraper at
//         an absolute URL, so this one genuinely does belong in the bundle -
//         the same reason technique-reference-og.mjs writes to public/assets/.
// ===========================================================================

import { chromium } from "playwright-core";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve();

// 1.91:1, the aspect Facebook, Instagram, X, LinkedIn, Discord and iMessage
// all crop toward. hero_og.jpg is already exactly this, so the ground needs no
// cropping decision made for it.
const W = 1200;
const H = 630;

const OUT = path.join(root, "public/assets/og-card.jpg");
const GROUND = path.join(root, "public/assets/hero_og.jpg");
// All three Logo_Header_Banner_*.webp files are byte-identical (same md5) -
// "Smooth", "Smooth1" and "Transparency" are one asset under three names. It
// carries a real alpha channel, so it composites onto the gradient without the
// flat rgb(10,0,25) ground that technique-reference-og.mjs has to paint its
// whole card with to hide. Verified, not assumed: the banner was composited
// over a bright field and inspected before this script was written.
const LOGO = path.join(root, "public/assets/Logo_Header_Banner_Transparency.webp");

// Straight from :root in public/home.html. The card has to look like the page
// it previews.
const PALETTE = {
  bg: "#0c0710",
  accent: "#ff5fb0",
  heading: "#f4eef6",
};

// The marketing page's own <h1> and kicker, not new copy written for a card.
// The <em> on that h1 wraps "calling the shots." and is rendered in --accent;
// TAGLINE_TAIL reproduces that split rather than restating it.
const KICKER = "Muay Thai \u00b7 Kickboxing \u00b7 Boxing";
const TAGLINE_HEAD = "Someone in your corner,";
const TAGLINE_TAIL = "calling the shots.";

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];

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

/**
 * Files become data URIs because the page is loaded with setContent(), which
 * has no base URL for a relative href to resolve against. The banner is handed
 * over at its native 1400px and displayed at LOGO_W - downsampling in the
 * browser, never upsampling.
 */
async function dataUri(file, mime = "image/png") {
  const buf =
    mime === "image/jpeg"
      ? await sharp(file).jpeg({ quality: 95 }).toBuffer()
      : await sharp(file).png().toBuffer();
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const LOGO_W = 720;

const FONTS = `
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@500&display=block">`;

/**
 * Anton ships ONE weight. Asking for a heavier one makes the browser
 * synthesise a faux-bold and the condensed face smears - the same warning
 * carried by home.html's --display comment and by generate_blog.mjs.
 */
function html(ground, logo) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: ${W}px; height: ${H}px; overflow: hidden;
  background: ${PALETTE.bg};
  -webkit-font-smoothing: antialiased;
  position: relative;
}
.ground { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
/* The gradient's top-left corner is bright magenta and the wordmark's "SHOT"
   is pink - laid straight on top, the two sit at nearly the same luminance and
   the logo half-disappears. This scrim buys back the contrast while leaving
   the gradient clearly readable as itself. */
.scrim {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 78% 62% at 50% 50%, rgba(12,7,16,0.12) 0%, rgba(12,7,16,0.62) 100%),
    linear-gradient(180deg, rgba(12,7,16,0.44) 0%, rgba(12,7,16,0.26) 44%, rgba(12,7,16,0.52) 100%);
}
.card {
  position: relative; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 58px 80px 58px; text-align: center;
}
.kicker {
  font-family: 'IBM Plex Mono', monospace; font-weight: 500;
  font-size: 24px; letter-spacing: 0.22em; text-transform: uppercase;
  color: ${PALETTE.accent};
}
.logo { width: ${LOGO_W}px; margin: 34px 0 38px; display: block; }
.tagline {
  font-family: 'Anton', sans-serif; font-weight: 400;
  font-size: 58px; line-height: 1.0; letter-spacing: 0.01em;
  color: ${PALETTE.heading};
}
.tagline em { font-style: normal; color: ${PALETTE.accent}; }
/* A floor, so the card ends on a deliberate edge rather than fading into
   whatever the feed puts under it. Matches technique-reference-og.mjs. */
.rule { position: absolute; left: 0; right: 0; bottom: 0; height: 6px; background: ${PALETTE.accent}; }
</style></head><body>
<img class="ground" src="${ground}" alt="">
<div class="scrim"></div>
<div class="card">
  <div class="kicker">${KICKER}</div>
  <img class="logo" src="${logo}" alt="">
  <div class="tagline">${TAGLINE_HEAD} <em>${TAGLINE_TAIL}</em></div>
</div>
<div class="rule"></div>
</body></html>`;
}

const ground = await dataUri(GROUND, "image/jpeg");
const logo = await dataUri(LOGO);

const browser = await chromium.launch({ executablePath: await findChrome() });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

await page.setContent(html(ground, logo), { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);

// The check that makes rendering type here defensible at all. Google Fonts is
// a network dependency; a card that quietly fell back to Arial would be
// off-brand without looking broken, and it would ship to every link preview
// the site has. Fail loudly instead.
const got = await page.evaluate(() => ({
  anton: document.fonts.check('400 58px "Anton"'),
  mono: document.fonts.check('500 24px "IBM Plex Mono"'),
}));
const missing = Object.entries(got)
  .filter(([, ok]) => !ok)
  .map(([k]) => k);
if (missing.length) {
  await browser.close();
  throw new Error(
    `Webfonts did not load: ${missing.join(", ")}.\n` +
      `This card renders type, so a fallback face would ship an off-brand card ` +
      `that still looks fine. Check the network and re-run.`
  );
}

// The tagline is the one element that can overflow: Anton is condensed, so it
// fits far more than it looks like it will, but a reworded TAGLINE_* would
// wrap silently and push the layout off-centre. Measure it.
const line = await page.evaluate(() => {
  const el = document.querySelector(".tagline");
  return { height: el.getBoundingClientRect().height, width: el.scrollWidth };
});
if (line.height > 80) {
  await browser.close();
  throw new Error(
    `The tagline wrapped to more than one line (${Math.round(line.height)}px tall).\n` +
      `Shorten TAGLINE_HEAD/TAGLINE_TAIL or drop .tagline's font-size.`
  );
}

await fs.mkdir(path.dirname(OUT), { recursive: true });
await page.screenshot({ path: OUT, type: "jpeg", quality: 90 });
await browser.close();

const bytes = (await fs.stat(OUT)).size;
console.log(
  `Wrote ${path.relative(root, OUT)} - ${W}x${H}, logo ${LOGO_W}px, ` +
    `tagline ${Math.round(line.width)}px on one line, ${(bytes / 1024).toFixed(1)} KB`
);
