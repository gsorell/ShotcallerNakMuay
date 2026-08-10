import React, { useCallback, useEffect, useState } from "react";

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
    // In dev, allow re-showing on refresh. In production this stays once-only.
    const isDev = import.meta.env.DEV;
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
