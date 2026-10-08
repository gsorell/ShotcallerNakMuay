import { useEffect } from "react";

import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { markReviewAsked, shouldAskForReview } from "./reviewPrompt";
import { isStoreReviewSupported, requestStoreReview } from "./storeReview";

/**
 * Long enough for the completion screen to be read as a completion screen
 * before anything is laid over it.
 */
const ASK_DELAY_MS = 1500;

/**
 * Shows the store's rating sheet when the user is due one.
 *
 * `momentIsRight` is the caller's half of the decision — that this is a
 * finished session and nothing else is being asked of the user right now. The
 * budget is this hook's half. If the moment passes before the delay is up, the
 * ask is dropped unspent.
 */
export function useReviewPrompt(momentIsRight: boolean): void {
  useEffect(() => {
    if (!momentIsRight) return;
    if (!isStoreReviewSupported()) return;
    if (!shouldAskForReview()) return;

    const timer = setTimeout(() => {
      markReviewAsked();
      try {
        trackEvent(AnalyticsEvents.ReviewRequested);
      } catch { /* analytics must never break the ask it measures */ }
      void requestStoreReview();
    }, ASK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [momentIsRight]);
}
