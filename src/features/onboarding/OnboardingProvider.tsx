import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useEntitlement } from "@/features/entitlement";
import { usePaywall } from "@/features/paywall";
import { OnboardingFlow } from "./OnboardingFlow";
import { hasOnboarded, markOnboarded } from "./storage";

interface OnboardingState {
  /** Onboarding is on screen right now. */
  isShowing: boolean;
  /** Onboarding was finished or skipped during this page load. */
  finishedThisSession: boolean;
}

const OnboardingContext = createContext<OnboardingState>({
  isShowing: false,
  finishedThisSession: false,
});

/**
 * Whether onboarding is up, or was just dismissed.
 *
 * Anything else that wants to interrupt the user has to check this: two modals
 * stacked on a first-time visitor is the worst possible first minute, and one
 * arriving the moment the other closes is barely better.
 */
export const useOnboardingState = () => useContext(OnboardingContext);

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

  const [finishedThisSession, setFinishedThisSession] = useState(false);

  const finish = useCallback(
    (openPaywallAfter: boolean) => {
      markOnboarded();
      setShow(false);
      setFinishedThisSession(true);
      if (openPaywallAfter) openPaywall("onboarding");
    },
    [openPaywall]
  );

  return (
    <OnboardingContext.Provider
      value={{ isShowing: show, finishedThisSession }}
    >
      {children}
      {show && (
        <OnboardingFlow
          onSkip={() => finish(false)}
          onUnlock={() => finish(true)}
        />
      )}
    </OnboardingContext.Provider>
  );
}
