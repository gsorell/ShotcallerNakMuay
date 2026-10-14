/**
 * The palette the shared cards — the round's challenge card and the streak
 * card — are painted in.
 *
 * Lifted from `scripts/social-cards.mjs`, which in turn took it from
 * `generate_blog.mjs` so that the generated cards "look like they came off the
 * same page as the blog and the app". A card a user posts lands in the same
 * feed as the cards the account posts, so it answers to the same palette.
 *
 * What it replaces was #f9a8d4 — Tailwind's pink-300, which appears in neither
 * the palette above nor the wordmark, and was never a brand colour.
 */
export const CARD_BRAND = {
  bg: "#0c0710",
  heading: "#f4eef6",
  accent: "#ff5fb0",
  muted: "#9d8fa9",
  border: "#2e2240",
  /**
   * The card surface, straight from `social-cards.mjs`. The lift toward plum
   * at the centre is what keeps a near-black panel from reading as a hole in
   * the screen — it gives the trophy something to sit on.
   */
  surface:
    "radial-gradient(ellipse 70% 45% at 50% 40%, #2a1030 0%, #0c0710 70%)",
  /**
   * The wordmark's own ramp, stop for stop from `build_logo_banner.py`. The
   * magenta-to-cyan run is the logo's signature, and the flat opening 12% is
   * deliberate there — it holds magenta long enough to read as magenta before
   * the crossover, so it is kept here rather than smoothed out.
   */
  ramp:
    "linear-gradient(90deg, #f838f8 0%, #f838f8 12%, #d660f8 30%, " +
    "#8898f8 50%, #4accf8 70%, #18f8f8 88%, #18f8f8 100%)",
};

/** Width of an exported card, in CSS pixels before the capture's 2x scale. */
export const CARD_EXPORT_WIDTH = 500;
