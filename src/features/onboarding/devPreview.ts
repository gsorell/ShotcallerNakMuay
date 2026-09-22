// ===========================================================================
// DEV-ONLY onboarding preview switches.
// ---------------------------------------------------------------------------
// The last onboarding step renders two completely different branches: the web
// one ("Get the app" / "Keep going in the browser") and the native one ("See
// Pro Plans" / "Maybe later — start free"). A browser can only ever show the
// web branch, so the native screen — the one a new installer actually meets —
// was unreviewable on this machine without building and installing the app.
//
// That is how a layout bug survived in it: on a 360x800 Android phone (the most
// common viewport there is) the native branch put "Maybe later — start free"
// 21px behind the system navigation buttons, with no scroll available to reach
// it. The only reachable action on a first-time user's screen was the paywall.
//
//     http://localhost:5173/?native=1   → render the NATIVE branch (persists)
//     http://localhost:5173/?native=0   → back to the real platform check
//
// Seeing the clipping also needs the system bars, which a desktop browser does
// not have: `env(safe-area-inset-*)` is 0 there, so the screen looks fine. Use
// the console snippet in docs/ONBOARDING_PREVIEW.md to simulate them.
//
// SAFETY: guarded by `import.meta.env.DEV`, which Vite replaces with the
// literal `false` in `npm run build`, so this whole body dead-code eliminates
// and cannot affect a shipped app — the same guarantee devOverride.ts relies
// on. Test mode is excluded so the suite always sees the real platform check.
// ===========================================================================

const NATIVE_BRANCH_KEY = "shotcaller_dev_native_branch";

/**
 * Resolved once per page load, not per render.
 *
 * This is read from a component body, so reading the URL, writing storage and
 * logging inside it would repeat on every render — ten identical console lines
 * and ten redundant writes on one load, which is what the first version did.
 * The URL cannot change without a navigation, so one resolution is enough.
 */
let resolved: boolean | null = null;

/**
 * True when the developer has asked this browser to render onboarding's native
 * branch instead of the web one. Always false in production and under vitest.
 */
export function isDevNativeBranchForced(): boolean {
  if (import.meta.env.MODE === "test") return false;
  if (!import.meta.env.DEV) return false;
  if (resolved !== null) return resolved;

  try {
    const param = new URLSearchParams(window.location.search).get("native");

    if (param === "1") {
      window.localStorage.setItem(NATIVE_BRANCH_KEY, "1");
      console.info(
        "[onboarding] DEV native-branch preview ON — the last step now renders the native (store) branch. Use ?native=0 to turn it off."
      );
    } else if (param === "0") {
      window.localStorage.removeItem(NATIVE_BRANCH_KEY);
      console.info("[onboarding] DEV native-branch preview OFF.");
    }

    resolved = window.localStorage.getItem(NATIVE_BRANCH_KEY) === "1";
  } catch {
    // Private mode / storage disabled: just behave normally.
    resolved = false;
  }
  return resolved;
}
