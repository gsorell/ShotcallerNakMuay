// ===========================================================================
// The App Store product-page header.
// ---------------------------------------------------------------------------
// App Store Connect takes one "Header" asset per version, at 5244x2950 or
// 3840x1646. This builds both from the same parts as the site's social card
// (site-og-card.mjs): the hero gradient, the lockup, the page's own tagline.
//
// Chrome rather than sharp, for the reason that file gives at length: the
// card carries type, and Chrome can be asked whether it got the fonts.
//
// The lockup goes in as the SVG, not the 1400px banner. At these sizes the
// banner would be upsampled nearly 2x; the SVG's type is vector paths.
//
// Everything is sized in vh, so the two aspects share one layout and neither
// needs numbers of its own.
//
// Run:  node scripts/app-store-header.mjs
//
// Output: assets-src/store/appstore-header/  (gitignored, like the screenshots;
//         NOT under public/, where it would ship in the bundle)
// ===========================================================================

import { chromium } from "playwright-core";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve();

const SIZES = [
  { w: 5244, h: 2950 },
  { w: 3840, h: 1646 },
];
// Rendered at half size and doubled by the device scale factor: a 5244px
// viewport is past what Chrome will screenshot reliably.
const SCALE = 2;

const OUTDIR = path.join(root, "assets-src/store/appstore-header");
const GROUND = path.join(root, "public/assets/hero_desktop.webp");
const LOGO = path.join(root, "public/assets/logo-shotcaller.svg");

// Straight from :root in public/home.html.
const PALETTE = {
  bg: "#0c0710",
  accent: "#ff5fb0",
  heading: "#f4eef6",
};

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

const FONTS = `
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@500&display=block">`;

function html(ground, logo) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100vw; height: 100vh; overflow: hidden; }
body {
  background: ${PALETTE.bg};
  -webkit-font-smoothing: antialiased;
  position: relative;
}
/* The ground is a soft gradient with nothing in it to go blurry, which is the
   only reason a 1600px plate can be stretched this far. */
.ground { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
/* Same job as the scrim in site-og-card.mjs: the gradient's magenta corner
   sits at the luminance of the wordmark's pink and swallows it. */
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
  text-align: center;
}
.kicker {
  font-family: 'IBM Plex Mono', monospace; font-weight: 500;
  font-size: 3.4vh; letter-spacing: 0.22em; text-transform: uppercase;
  color: ${PALETTE.accent};
}
.logo { height: 22vh; margin: 5.5vh 0 6vh; display: block; }
.tagline {
  font-family: 'Anton', sans-serif; font-weight: 400;
  font-size: 8.6vh; line-height: 1.0; letter-spacing: 0.01em;
  color: ${PALETTE.heading}; white-space: nowrap;
}
.tagline em { font-style: normal; color: ${PALETTE.accent}; }
</style></head><body>
<img class="ground" src="${ground}" alt="">
<div class="scrim"></div>
<div class="card">
  <div class="kicker">${KICKER}</div>
  <img class="logo" src="${logo}" alt="">
  <div class="tagline">${TAGLINE_HEAD} <em>${TAGLINE_TAIL}</em></div>
</div>
</body></html>`;
}

const groundBuf = await sharp(GROUND).jpeg({ quality: 95 }).toBuffer();
const ground = `data:image/jpeg;base64,${groundBuf.toString("base64")}`;
const logo = `data:image/svg+xml;base64,${(await fs.readFile(LOGO)).toString("base64")}`;

await fs.mkdir(OUTDIR, { recursive: true });
const browser = await chromium.launch({ executablePath: await findChrome() });

for (const { w, h } of SIZES) {
  const page = await browser.newPage({
    viewport: { width: w / SCALE, height: h / SCALE },
    deviceScaleFactor: SCALE,
  });
  await page.setContent(html(ground, logo), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);

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
      `Webfonts did not load: ${missing.join(", ")}. Check the network and re-run.`
    );
  }

  // The widest thing on the card is the tagline, and it is set not to wrap -
  // so on a narrow enough canvas it would run off the edges instead.
  const widest = await page.evaluate(() =>
    Math.max(
      ...[".kicker", ".logo", ".tagline"].map(
        (s) => document.querySelector(s).getBoundingClientRect().width
      )
    )
  );
  if (widest > (w / SCALE) * 0.9) {
    await browser.close();
    throw new Error(`Content is ${Math.round(widest * SCALE)}px wide on a ${w}px canvas.`);
  }

  const out = path.join(OUTDIR, `header-${w}x${h}.png`);
  await page.screenshot({ path: out, type: "png" });
  await page.close();

  const meta = await sharp(out).metadata();
  if (meta.width !== w || meta.height !== h) {
    await browser.close();
    throw new Error(`${out} is ${meta.width}x${meta.height}, wanted ${w}x${h}.`);
  }
  const bytes = (await fs.stat(out)).size;
  console.log(
    `Wrote ${path.relative(root, out)} - ${w}x${h}, ${(bytes / 1048576).toFixed(1)} MB`
  );
}

await browser.close();
