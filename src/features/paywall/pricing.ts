import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

/**
 * Presentation maths for the paywall.
 *
 * Split out from the modal because this is the part with rules worth testing:
 * a wrong savings percentage or a trial claimed where the store offers none is
 * a store-listing violation, not a cosmetic bug.
 */

/** A store's introductory offer, reduced to something sellable. */
export interface IntroOffer {
  /** True when the offer costs nothing — the headline we actually want. */
  isFreeTrial: boolean;
  /** e.g. "7 days free" or "3 months for $1.99". */
  label: string;
}

/**
 * Format an amount in the product's currency.
 *
 * `priceString` from the store is already localised, so it is the right answer
 * whenever we are showing a price the store quoted. This exists only for
 * prices we *derive* (a per-month equivalent of an annual plan), which have no
 * store-provided string.
 */
export function formatMoney(
  amount: number,
  currencyCode: string | null | undefined
): string | null {
  if (!Number.isFinite(amount) || !currencyCode) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    // An unrecognised currency code throws rather than degrading. Showing no
    // derived price is better than showing a bare number with no currency.
    return null;
  }
}

/**
 * Weeks, re-expressed as days.
 *
 * The two stores describe one offer two different ways: a seven-day trial
 * comes back from Apple as 1 WEEK and from Play as 7 DAY. Left alone, the same
 * product advertises "1 week free" on an iPhone and "7 days free" on an
 * Android, which then has to be reconciled in screenshots, store listings and
 * support answers.
 *
 * A week is exactly seven days, so this changes the wording and not the claim.
 * Only WEEK is converted — a month is not exactly thirty days, and "1 month
 * free" is the honest phrasing for one anyway.
 */
function normalizePeriod(
  units: number,
  unit: string
): { units: number; unit: string } {
  if (unit === "WEEK") return { units: units * 7, unit: "DAY" };
  return { units, unit };
}

/** "day" → "7 days", respecting the singular. */
function pluralPeriod(units: number, unit: string): string {
  const noun = unit.toLowerCase();
  return `${units} ${units === 1 ? noun : `${noun}s`}`;
}

/**
 * Describe a package's introductory offer, or null when it has none.
 *
 * Android exposes this through the default subscription option, iOS through
 * the product's intro price; RevenueCat normalises both onto `introPrice`, so
 * one path covers the two stores.
 */
export function describeIntroOffer(pkg: PurchasesPackage): IntroOffer | null {
  const intro = pkg.product.introPrice;
  if (!intro) return null;

  const units = intro.periodNumberOfUnits;
  const unit = intro.periodUnit;
  if (!units || !unit || unit === "UNKNOWN") return null;

  const normalized = normalizePeriod(units, unit);
  const duration = pluralPeriod(normalized.units, normalized.unit);

  // A zero-price intro is a free trial. Anything else is a discounted period,
  // and `cycles` is how many of those periods the discount runs for.
  if (intro.price === 0) {
    return { isFreeTrial: true, label: `${duration} free` };
  }

  const cycles = intro.cycles > 1 ? `${intro.cycles} × ${duration}` : duration;
  return { isFreeTrial: false, label: `${cycles} for ${intro.priceString}` };
}

/**
 * What an annual plan works out to per month, e.g. "$2.49". Null when the
 * package is not annual or the price cannot be formatted.
 */
export function monthlyEquivalent(pkg: PurchasesPackage): string | null {
  if (pkg.packageType !== "ANNUAL") return null;
  const price = pkg.product.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  return formatMoney(price / 12, pkg.product.currencyCode);
}

/**
 * How much cheaper the annual plan is than paying monthly for a year, as a
 * whole percentage. Null unless both plans are present and the saving is real
 * — an annual plan that saves nothing should not claim to.
 */
export function annualSavingsPercent(
  packages: readonly PurchasesPackage[]
): number | null {
  const annual = packages.find((p) => p.packageType === "ANNUAL");
  const monthly = packages.find((p) => p.packageType === "MONTHLY");
  if (!annual || !monthly) return null;

  const annualPrice = annual.product.price;
  const monthlyPrice = monthly.product.price;
  if (!Number.isFinite(annualPrice) || !Number.isFinite(monthlyPrice)) {
    return null;
  }
  if (annualPrice <= 0 || monthlyPrice <= 0) return null;

  const percent = Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);
  return percent > 0 ? percent : null;
}
