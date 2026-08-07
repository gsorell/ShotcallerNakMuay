// iOS grandfathering by original purchased build number.
//
// StoreKit reports the CFBundleVersion the user ORIGINALLY downloaded, which
// RevenueCat surfaces as `customerInfo.originalApplicationVersion`. Anyone
// whose original build predates the first free release bought the app while it
// still cost money.
//
// The subtlety that makes this its own module: Apple returns the literal
// string "1.0" for this field in the SANDBOX environment, and App Review runs
// in sandbox. Without special handling a reviewer parses to 1, compares below
// any real transition build, and gets silently grandfathered — so they never
// see the paywall and reject the IAPs as untestable. That is the same failure
// that made us disable legacy stamping on iOS; it would simply have returned
// through a different door.

/** Apple's fixed sandbox value for original_application_version. */
const SANDBOX_ORIGINAL_VERSION = "1.0";

/**
 * Whether this user bought the app before it went free on iOS.
 *
 * Returns false for anything uncertain. The failure modes are asymmetric:
 * granting too widely hands the product out for nothing, and granting to a
 * sandbox tester specifically means the App Review team cannot reach the
 * paywall and the release gets rejected.
 */
export function isGrandfatheredByOriginalVersion(
  originalApplicationVersion: string | null | undefined,
  transitionBuild: number | null
): boolean {
  // Not flipped yet — grandfather nobody.
  if (transitionBuild == null) return false;
  if (originalApplicationVersion == null) return false;

  const raw = originalApplicationVersion.trim();
  if (!raw) return false;

  // Sandbox / App Review. Real builds carry the CI run number as
  // CFBundleVersion ("52", "56"), and the Xcode project's own default is "1" —
  // never "1.0" — so this string is unambiguous enough to key off. A genuine
  // owner misidentified here still has the manual prior-purchase claim.
  if (raw === SANDBOX_ORIGINAL_VERSION) return false;

  const original = Number.parseInt(raw, 10);
  if (!Number.isFinite(original) || original <= 0) return false;

  return original < transitionBuild;
}
