import { Capacitor } from "@capacitor/core";
import { AppReview } from "@capawesome/capacitor-app-review";

import { APP_STORE_ID } from "@/constants/storeLinks";

/** The stores' review APIs exist only in the native apps. */
export function isStoreReviewSupported(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Ask the OS to show its rating sheet. It may decline — both stores throttle
 * it and neither says so — which is why this is never wired to a button.
 */
export async function requestStoreReview(): Promise<void> {
  try {
    await AppReview.requestReview();
  } catch {
    /* a rating sheet that fails to appear is not something to tell the user */
  }
}

/** Open the store listing on its review form. Always does something visible. */
export async function openStoreReviewPage(): Promise<void> {
  try {
    await AppReview.openAppStore({ appId: APP_STORE_ID });
  } catch {
    /* ignore */
  }
}
