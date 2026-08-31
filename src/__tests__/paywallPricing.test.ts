import { describe, expect, it } from "vitest";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

import {
  annualSavingsPercent,
  describeIntroOffer,
  formatMoney,
  monthlyEquivalent,
} from "@/features/paywall/pricing";

/**
 * A package, cut down to the fields the paywall reads. The real type carries
 * two dozen more, none of which the presentation maths touches.
 */
function pkg(
  packageType: string,
  price: number,
  opts: {
    priceString?: string;
    currencyCode?: string;
    introPrice?: {
      price: number;
      priceString: string;
      cycles: number;
      periodUnit: string;
      periodNumberOfUnits: number;
    } | null;
  } = {}
): PurchasesPackage {
  return {
    identifier: `$rc_${packageType.toLowerCase()}`,
    packageType,
    product: {
      identifier: `snm_${packageType.toLowerCase()}`,
      title: packageType,
      price,
      priceString: opts.priceString ?? `$${price.toFixed(2)}`,
      currencyCode: opts.currencyCode ?? "USD",
      introPrice: opts.introPrice ?? null,
    },
  } as unknown as PurchasesPackage;
}

const trial = (units: number, unit: string) => ({
  price: 0,
  priceString: "$0.00",
  cycles: 1,
  periodUnit: unit,
  periodNumberOfUnits: units,
});

describe("intro offers", () => {
  it("reads a zero-price intro as a free trial", () => {
    const offer = describeIntroOffer(
      pkg("MONTHLY", 4.99, { introPrice: trial(7, "DAY") })
    );
    expect(offer).toEqual({ isFreeTrial: true, label: "7 days free" });
  });

  // Apple returns the seven-day trial as 1 WEEK and Play returns the same
  // trial as 7 DAY. Both must reach the user as the same sentence.
  it("says the same thing about both stores' seven-day trial", () => {
    const apple = describeIntroOffer(
      pkg("MONTHLY", 4.99, { introPrice: trial(1, "WEEK") })
    );
    const play = describeIntroOffer(
      pkg("MONTHLY", 4.99, { introPrice: trial(7, "DAY") })
    );
    expect(apple?.label).toBe("7 days free");
    expect(apple).toEqual(play);
  });

  it("converts longer week periods too", () => {
    expect(
      describeIntroOffer(pkg("MONTHLY", 4.99, { introPrice: trial(2, "WEEK") }))
        ?.label
    ).toBe("14 days free");
  });

  it("leaves months alone, where the singular is the honest phrasing", () => {
    // A month is not exactly thirty days, so it is not converted.
    expect(
      describeIntroOffer(pkg("MONTHLY", 4.99, { introPrice: trial(1, "MONTH") }))
        ?.label
    ).toBe("1 month free");
  });

  it("describes a discounted intro as a price, not a trial", () => {
    const offer = describeIntroOffer(
      pkg("MONTHLY", 4.99, {
        introPrice: {
          price: 1.99,
          priceString: "$1.99",
          cycles: 3,
          periodUnit: "MONTH",
          periodNumberOfUnits: 1,
        },
      })
    );
    expect(offer).toEqual({
      isFreeTrial: false,
      label: "3 × 1 month for $1.99",
    });
  });

  it("reports no offer when the store provides none", () => {
    expect(describeIntroOffer(pkg("MONTHLY", 4.99))).toBeNull();
  });

  // The paywall prints this claim verbatim next to a "Try free" button. An
  // unusable period is not a trial we can promise, so it must not become one.
  it("refuses an unusable period rather than inventing one", () => {
    expect(
      describeIntroOffer(pkg("MONTHLY", 4.99, { introPrice: trial(7, "UNKNOWN") }))
    ).toBeNull();
    expect(
      describeIntroOffer(pkg("MONTHLY", 4.99, { introPrice: trial(0, "DAY") }))
    ).toBeNull();
  });
});

describe("annual framing", () => {
  it("divides an annual price into a per-month equivalent", () => {
    expect(monthlyEquivalent(pkg("ANNUAL", 29.99))).toBe("$2.50");
  });

  it("only computes it for the annual plan", () => {
    expect(monthlyEquivalent(pkg("MONTHLY", 4.99))).toBeNull();
    expect(monthlyEquivalent(pkg("LIFETIME", 49.99))).toBeNull();
  });

  it("computes the saving against twelve months of the monthly plan", () => {
    // 29.99 vs 59.88 → 49.9% → 50%.
    const packages = [pkg("ANNUAL", 29.99), pkg("MONTHLY", 4.99)];
    expect(annualSavingsPercent(packages)).toBe(50);
  });

  it("claims no saving when there is none to claim", () => {
    // A store misconfiguration where annual costs more than 12 monthlies must
    // not render as "Save -4%", and an annual plan alone has nothing to beat.
    expect(annualSavingsPercent([pkg("ANNUAL", 62), pkg("MONTHLY", 4.99)])).toBeNull();
    expect(annualSavingsPercent([pkg("ANNUAL", 29.99)])).toBeNull();
    expect(annualSavingsPercent([])).toBeNull();
  });

  it("survives a price the store failed to populate", () => {
    expect(annualSavingsPercent([pkg("ANNUAL", 0), pkg("MONTHLY", 4.99)])).toBeNull();
    expect(monthlyEquivalent(pkg("ANNUAL", 0))).toBeNull();
  });
});

describe("money formatting", () => {
  it("falls back to nothing rather than an unlabelled number", () => {
    expect(formatMoney(2.5, "NOT_A_CURRENCY")).toBeNull();
    expect(formatMoney(2.5, "")).toBeNull();
    expect(formatMoney(Number.NaN, "USD")).toBeNull();
  });
});
