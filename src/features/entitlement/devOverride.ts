// ===========================================================================
// DEV-ONLY entitlement override.
// ---------------------------------------------------------------------------
// The PWA has no RevenueCat API key by design (see EntitlementProvider), so in
// a browser everyone resolves to free-tier and the paywall can't load plans —
// which makes every Pro surface impossible to preview during development.
//
// This lets you flip the browser into "Pro" while working:
//
//     http://localhost:5173/?pro=1     → unlock (persists across reloads)
//     http://localhost:5173/?pro=0     → back to free tier
//
// SAFETY: every path is behind `import.meta.env.DEV`, which Vite replaces with
// the literal `false` in `npm run build`. The whole body then dead-code
// eliminates, so this cannot affect a shipped app, native or web.
// ===========================================================================

const DEV_PRO_KEY = "shotcaller_dev_pro";

/**
 * True when the developer has asked this browser to behave as a Pro user.
 * Always false in production builds and on native platforms in release.
 */
export function isDevProOverrideActive(): boolean {
  if (!import.meta.env.DEV) return false;

  try {
    const param = new URLSearchParams(window.location.search).get("pro");

    if (param === "1") {
      window.localStorage.setItem(DEV_PRO_KEY, "1");
      console.info(
        "[entitlement] DEV Pro override ON — this browser now behaves as a Pro user. Use ?pro=0 to turn it off."
      );
    } else if (param === "0") {
      window.localStorage.removeItem(DEV_PRO_KEY);
      console.info("[entitlement] DEV Pro override OFF — back to free tier.");
    }

    return window.localStorage.getItem(DEV_PRO_KEY) === "1";
  } catch {
    // Private-mode / storage-disabled browsers: just stay on the free tier.
    return false;
  }
}
