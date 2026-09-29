/**
 * Palette and dimensions for the shared-style card.
 *
 * In their own module rather than alongside the component so the card file
 * exports only a component — a file that mixes the two breaks Fast Refresh,
 * and the export is needed because ShareStyleFlow paints the same background
 * on the capture wrapper.
 *
 * The colours are the ones the rest of the brand already writes in, lifted
 * from `WorkoutCompleted`, which took them from `scripts/social-cards.mjs` so
 * that a card a user posts lands in a feed looking like the cards the account
 * posts.
 */
export const STYLE_CARD_BRAND = {
  bg: "#0c0710",
  heading: "#f4eef6",
  accent: "#ff5fb0",
  muted: "#9d8fa9",
  border: "#2e2240",
  /**
   * The wordmark's own ramp, stop for stop from `build_logo_banner.py`. The
   * flat opening 12% is deliberate — it holds magenta long enough to read as
   * magenta before the crossover.
   */
  ramp:
    "linear-gradient(90deg, #f838f8 0%, #f838f8 12%, #d660f8 30%, " +
    "#8898f8 50%, #4accf8 70%, #18f8f8 88%, #18f8f8 100%)",
};

/** Matches the challenge card, so both land in a feed at the same size. */
export const STYLE_CARD_WIDTH = 500;
