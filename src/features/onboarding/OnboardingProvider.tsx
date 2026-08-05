import React, { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

import { useEntitlement } from "@/features/entitlement";
import { usePaywall } from "@/features/paywall";
import { OnboardingFlow } from "./OnboardingFlow";
import { hasOnboarded, markOnboarded } from "./storage";

// Renders the first-launch onboarding when appropriate. Must sit inside both
// EntitlementProvider and PaywallProvider.
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { isPro, ready } = useEntitlement();
  const { openPaywall } = usePaywall();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Wait until entitlement resolves so a grandfathered/subscribed owner is
    // never shown a paywall-forward onboarding for something they already have.
    if (!ready) return;
    // Native only — the web/PWA has no purchase path, so a paywall-forward
    // flow would dead-end.
    if (!Capacitor.isNativePlatform()) return;
    if (isPro) return;
    if (hasOnboarded()) return;
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
