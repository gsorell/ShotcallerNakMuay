import { describe, expect, it } from "vitest";

import { isUserCancellation } from "@/features/entitlement/purchaseErrors";

describe("purchase cancellation detection", () => {
  it("treats RevenueCat's cancellation code as a cancellation", () => {
    // What actually arrives across the Capacitor bridge: both native plugins
    // reject with call.reject(message, code, ...), so this shape - and only
    // this shape - is what production sees.
    expect(
      isUserCancellation({ code: "1", message: "Purchase was cancelled" })
    ).toBe(true);
  });

  it("accepts the code as a number, since the bridge has stringified it before", () => {
    expect(isUserCancellation({ code: 1 })).toBe(true);
  });

  it("still honours the deprecated userCancelled flag if it ever reappears", () => {
    expect(isUserCancellation({ userCancelled: true })).toBe(true);
  });

  it("does not swallow a real store failure as a cancellation", () => {
    // The regression this guards: these must stay in the error branch, or
    // paywall_purchase_error stops meaning anything.
    expect(
      isUserCancellation({ code: "2", message: "Store problem" })
    ).toBe(false);
    expect(isUserCancellation({ code: "23", message: "Invalid receipt" })).toBe(
      false
    );
    expect(isUserCancellation({ message: "Purchases are not available." })).toBe(
      false
    );
  });

  it("survives a null or undefined rejection without throwing", () => {
    expect(isUserCancellation(null)).toBe(false);
    expect(isUserCancellation(undefined)).toBe(false);
  });

  it("does not classify on the message text, which is not stable", () => {
    // A message that reads like a cancellation but carries a failure code is
    // a failure. Matching on prose would have looked like it worked and
    // broken in any other locale.
    expect(
      isUserCancellation({ code: "2", message: "Purchase was cancelled" })
    ).toBe(false);
  });
});
