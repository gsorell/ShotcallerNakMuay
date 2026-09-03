/**
 * Was the purchase abandoned by the user, or did it actually fail?
 *
 * This lived inline in EntitlementProvider and got it wrong. It tested
 * `error.userCancelled`, which reads naturally and is never there: both native
 * plugins reject through Capacitor as `call.reject(message, code, ...)`, so
 * what arrives in JS is `{ message, code }` and nothing else. RevenueCat also
 * marks `userCancelled` deprecated in its own types, pointing at the code
 * instead.
 *
 * The cost of getting it wrong was invisible and ran for three days: every
 * cancellation was reported as `paywall_purchase_error`, `paywall_purchase_cancelled`
 * read near zero, and anyone who dismissed the store sheet was shown
 * "Purchase was cancelled" as though something had broken. That is precisely
 * the distinction the funnel instrumentation exists to make, inverted.
 *
 * Extracted so it can be tested, because the failure mode is silent - the
 * types allow `userCancelled` on an object that never carries it, so nothing
 * complained.
 */

/**
 * `PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR`. The enum lives in
 * `@revenuecat/purchases-typescript-internal-esm` and is deliberately not
 * re-exported by `@revenuecat/purchases-capacitor`, so reaching into the
 * internal package to import one string would be the more fragile choice.
 */
const PURCHASE_CANCELLED_ERROR = "1";

export interface PurchaseErrorLike {
  code?: string | number;
  /** @deprecated by RevenueCat, and absent across the Capacitor bridge. */
  userCancelled?: boolean | null;
  message?: string;
}

export const isUserCancellation = (error: unknown): boolean => {
  const err = error as PurchaseErrorLike | null | undefined;
  if (!err) return false;
  // The deprecated flag is still checked first: if a future plugin version
  // starts forwarding it, it is the more direct signal, and it costs nothing.
  if (err.userCancelled) return true;
  return String(err.code) === PURCHASE_CANCELLED_ERROR;
};
