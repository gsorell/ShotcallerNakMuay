import type { EntitlementStatus } from "./EntitlementProvider";

// Last resolved entitlement, cached so the FIRST paint after launch is already
// correct.
//
// Without this, every cold start renders as not-Pro (the honest answer before
// resolution) and then corrects itself once storage and RevenueCat reply — so
// a paying user watches lock badges appear and vanish, and the style grid
// reorder under them, every single launch. Seeding from the last known answer
// removes that flicker entirely for returning users.
//
// This is a rendering hint, NOT an entitlement source. It is deliberately not
// consulted by `evaluate()`: real access always comes from the legacy flag,
// RevenueCat, or the platform grandfather checks. A stale cache can at worst
// show the right UI a moment early, or briefly show Pro to someone whose
// subscription lapsed since last launch — self-correcting within a second.

const CACHE_KEY = "shotcaller_entitlement_cache";

const VALID: ReadonlySet<string> = new Set([
  "legacy_lifetime",
  "subscribed",
  "in_trial",
  "free",
]);

/** Last known status, or null on first ever launch / unreadable storage. */
export function readCachedStatus(): EntitlementStatus | null {
  try {
    const value = window.localStorage.getItem(CACHE_KEY);
    if (value && VALID.has(value)) return value as EntitlementStatus;
    return null;
  } catch {
    return null;
  }
}

/** Remember a resolved status. `unknown` is never cached — it is not an answer. */
export function writeCachedStatus(status: EntitlementStatus): void {
  if (status === "unknown") return;
  try {
    window.localStorage.setItem(CACHE_KEY, status);
  } catch {
    // Best-effort: a failed write only costs us one flicker next launch.
  }
}
