// ===========================================================================
// Store screenshots for the App Store and Google Play.
//
// Why scripted rather than captured by hand
// ---------------------------------------------------------------------------
// The previous captures were taken on devices over months and range from
// 828x1792 to 840x1880 - landing-shots.mjs exists purely to crop that
// disagreement back into one window. They are also too small to submit: the
// App Store's 6.9" slot needs 1290x2796 and no amount of upscaling gets there.
//
// Driving the app instead makes the whole set reproducible. Every time the
// logo, a colour or a screen changes, re-running this is one command rather
// than a morning of tapping and cropping.
//
// Uses playwright-core against the Chrome already installed on this machine,
// so nothing downloads a second browser.
//
// Requires the dev server:  npm run dev
// Then:                     node scripts/store-shots.mjs
//
// Output: assets-src/store/<profile>/<nn>-<name>.png  (not shipped)
// ===========================================================================

import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:5173";
// Deliberately NOT under public/: anything there is copied into the web bundle
// by Vite and into the native app assets by Capacitor. 20MB of store artwork
// would ship to every user for no reason. These are upload artefacts, not app
// assets.
const OUT = "assets-src/store";

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];

// Store slots. The CSS viewport times the scale factor is what the store
// actually receives, so these are chosen to land on the required pixel sizes
// exactly rather than being resized afterwards.
const PROFILES = [
  { name: "appstore-6.9", width: 430, height: 932, scale: 3 }, // -> 1290x2796
  { name: "play-phone", width: 360, height: 640, scale: 3 }, //   -> 1080x1920
];

// `?pro=1` is the dev-only entitlement override (see devOverride.ts). It is
// compiled out of production builds, so it cannot leak into a shipped app -
// but it is the only way to reach Learn and Levels 2-11 in a browser, since
// the PWA carries no RevenueCat key by design.
const APP = `${BASE}/app?pro=1`;

const settle = async (page, ms = 900) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
};

// A fresh browser has no history, so the Logs screen reads "No workouts logged
// yet" - true, and useless as a store screenshot. scripts/dev-seed-charms.js
// already writes a realistic 12-day history (distinct styles, a 6-round day,
// several charms earned and Century Club left locked as a teaser), so reuse it
// rather than inventing a second set of fixtures that would drift from it.
//
// It is an IIFE writing to localStorage, so running it as an init script lands
// the data before the app's own scripts read it.
const SEED = await fs.readFile("scripts/dev-seed-charms.js", "utf8");

/** Ordered as the store shows them: the hero first, then the breadth. */
const SHOTS = [
  {
    name: "callout",
    note: "A round in progress with a technique called - the whole point of the app",
    async go(page) {
      await settle(page);
      await page.getByText("Meat & Potatoes").first().click();
      await page.getByRole("button", { name: /Let's Go/i }).click();
      // Sessions open on a "get ready" countdown, so wait for an actual
      // callout to be on screen rather than screenshotting the pre-roll.
      await page.locator(".active-session-callout").waitFor({ timeout: 40000 });
      await page.waitForTimeout(250);
    },
  },
  {
    name: "styles",
    note: "Choose Your Fighting Style - the first thing a new user meets",
    async go(page) {
      await settle(page);
    },
  },
  {
    name: "roadmap",
    note: "Start Here guided path",
    async go(page) {
      await settle(page);
      await page.getByText(/Begin level 1/i).first().click();
      await settle(page);
    },
  },
  {
    name: "learn",
    note: "Technique library shelves",
    async go(page) {
      await settle(page);
      await page.getByRole("button", { name: "Learn" }).first().click();
      await settle(page);
    },
  },
  {
    name: "lesson",
    note: "A single technique with its silhouette",
    async go(page) {
      await settle(page);
      await page.getByRole("button", { name: "Learn" }).first().click();
      await settle(page);
      await page.locator(".shelf-tile").first().click();
      await settle(page);
    },
  },
  {
    name: "logs",
    note: "Workout history, streak and charms (seeded)",
    async go(page) {
      await settle(page);
      await page.getByRole("button", { name: "Workout Logs" }).first().click();
      await settle(page);
    },
  },
  {
    name: "completion",
    note: "The shareable completion card, reached from a logged session",
    async go(page) {
      await settle(page);
      await page.getByRole("button", { name: "Workout Logs" }).first().click();
      await settle(page);
      await page.locator('[title="View completion screen"]').first().click();
      await settle(page);
    },
  },
];

async function findChrome() {
  for (const p of CHROME) {
    try {
      await fs.access(p);
      return p;
    } catch {}
  }
  throw new Error(`No Chrome found. Tried:\n  ${CHROME.join("\n  ")}`);
}

async function main() {
  const executablePath = await findChrome();
  const browser = await chromium.launch({ executablePath });
  let made = 0;

  for (const profile of PROFILES) {
    const dir = path.join(OUT, profile.name);
    await fs.mkdir(dir, { recursive: true });

    for (const [i, shot] of SHOTS.entries()) {
      // A fresh context per shot: the app keeps page state in React, so the
      // only reliable way to reach a screen is from a clean load.
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        deviceScaleFactor: profile.scale,
        isMobile: true,
        hasTouch: true,
      });
      await context.addInitScript(SEED);
      const page = await context.newPage();
      const file = path.join(dir, `${String(i + 1).padStart(2, "0")}-${shot.name}.png`);
      try {
        await page.goto(APP, { waitUntil: "domcontentloaded" });
        await shot.go(page);
        await page.screenshot({ path: file });
        const px = `${profile.width * profile.scale}x${profile.height * profile.scale}`;
        console.log(`  ${profile.name.padEnd(13)} ${shot.name.padEnd(10)} ${px}  ${file}`);
        made++;
      } catch (err) {
        console.error(`  ${profile.name} ${shot.name}: FAILED - ${err.message.split("\n")[0]}`);
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();
  console.log(`\n${made}/${PROFILES.length * SHOTS.length} shots written under ${OUT}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
