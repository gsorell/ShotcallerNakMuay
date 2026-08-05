import React, { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

import { useEntitlement } from "@/features/entitlement";
import { usePaywall } from "@/features/paywall";
import { OnboardingFlow } from "./OnboardingFlow";
import { hasOnboarded, markOnboarded } from "./storage";

// Renders the first-launch onboarding when appropriate. Must sit inside
// EntitlementProvider and PaywallProvider.
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { isPro, ready } = useEntitlement();
  const { openPaywall } = usePaywall();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Wait until entitlement resolves so a grandfathered/subscribed owner is
    // never shown a paywall-forward onboarding for something they already have.
    if (!ready) return;
    // In dev, allow previewing in the browser and re-showing on refresh.
    // In production this stays native-only + once-only.
    const isDev = import.meta.env.DEV;
    // Native only — the web/PWA has no purchase path, so a paywall-forward
    // flow would dead-end.
    if (!Capacitor.isNativePlatform() && !isDev) return;
    if (isPro) return;
    if (!isDev && hasOnboarded()) return;
    setShow(true);
  }, [ready, isPro]);

  const finish = useCallback(
    (openPaywallAfter: boolean) => {
      markOnboarded();
      setShow(false);
      if (openPaywallAfter) openPaywall("onboarding");
    },
    [openPaywall]
  );

  return (
    <>
      {children}
      {show && (
        <OnboardingFlow
          onSkip={() => finish(false)}
          onUnlock={() => finish(true)}
        />
      )}
    </>
  );
}
