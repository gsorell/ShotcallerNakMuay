import { Capacitor } from "@capacitor/core";

import {
  ANDROID_FREE_TRANSITION_DATE,
  LEGACY_CLAIM_WINDOW_DAYS,
} from "./releaseConfig";

// The manual "I bought this before it went free" path.
//
// With no backend there is no way to actually verify a prior purchase, so this
// is deliberately friction rather than verification — and it is honest about
// that in the UI. Its job is to stop a free user from casually tapping one
// button for permanent Pro, while still letting a real owner through.
//
// It is the LAST resort, not the main path. Genuine owners are grandfathered
// automatically by the legacy stamp, by Android Auto Backup restoring it, by
// the Android first-install-time check, or by iOS original-version. Anyone
// reaching this sheet has fallen through all four.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the manual claim should still be offered.
 *
 * Always available before the Android flip (the app still costs money, so
 * there is nothing to steal). Afterwards it closes once the window lapses —
 * real owners surface within days of the change, usually on their first
 * launch after it, while an unverifiable unlock left in the paywall forever
 * is just a free-access button for everyone who arrives later.
 */
export function isLegacyClaimAvailable(now: number = Date.now()): boolean {
  if (ANDROID_FREE_TRANSITION_DATE == null) return true;
  return now < ANDROID_FREE_TRANSITION_DATE + LEGACY_CLAIM_WINDOW_DAYS * DAY_MS;
}

/** Days left in the claim window, or null when it never closes / already has. */
export function legacyClaimDaysRemaining(now: number = Date.now()): number | null {
  if (ANDROID_FREE_TRANSITION_DATE == null) return null;
  const endsAt = ANDROID_FREE_TRANSITION_DATE + LEGACY_CLAIM_WINDOW_DAYS * DAY_MS;
  if (now >= endsAt) return null;
  return Math.ceil((endsAt - now) / DAY_MS);
}

// Google Play order IDs look like: GPA.1234-5678-9012-34567
// (the trailing group is 5 digits; the rest are 4).
const GOOGLE_ORDER_ID = /^GPA\.\d{4}-\d{4}-\d{4}-\d{5}$/i;

// Apple order/transaction references vary far more by era and receipt type, so
// they get a deliberately loose sanity check rather than a false-precision one
// that would reject legitimate owners. iOS grandfathers automatically via
// originalApplicationVersion anyway, so this path is rare there.
const APPLE_ORDER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{5,}$/;

export interface OrderIdCheck {
  valid: boolean;
  /** Why it was rejected — shown under the field. Null when valid. */
  error: string | null;
}

export function validateOrderId(
  raw: string,
  platform: string = Capacitor.getPlatform()
): OrderIdCheck {
  const value = raw.trim();

  if (!value) {
    return { valid: false, error: "Enter your order number to continue." };
  }

  if (platform === "android") {
    if (!GOOGLE_ORDER_ID.test(value)) {
      return {
        valid: false,
        error: "That doesn't look like a Play order number (GPA.####-####-####-#####).",
      };
    }
    return { valid: true, error: null };
  }

  if (!APPLE_ORDER_ID.test(value)) {
    return {
      valid: false,
      error: "That doesn't look like an order number from your receipt.",
    };
  }
  return { valid: true, error: null };
}

/** Where the user can find the number, phrased per store. */
export function orderIdHint(
  platform: string = Capacitor.getPlatform()
): string {
  if (platform === "android") {
    return "Find it in your Google Play purchase email, or at play.google.com/store/account under Order history.";
  }
  return "Find it in your Apple receipt email, or at reportaproblem.apple.com.";
}

/** Example shown as the field placeholder. */
export function orderIdPlaceholder(
  platform: string = Capacitor.getPlatform()
): string {
  return platform === "android" ? "GPA.1234-5678-9012-34567" : "Order number";
}
