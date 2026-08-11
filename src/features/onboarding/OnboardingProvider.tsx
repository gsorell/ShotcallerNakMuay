import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useEntitlement } from "@/features/entitlement";
import { usePaywall } from "@/features/paywall";
import { OnboardingFlow } from "./OnboardingFlow";
import { hasOnboarded, markOnboarded } from "./storage";

interface OnboardingState {
  /** Onboarding is on screen right now. */
  isShowing: boolean;
  /**
   * The *first-run* onboarding was finished or skipped during this page load.
   * Only the automatic showing counts — someone re-reading it from Help has
   * not just been introduced to the app.
   */
  finishedThisSession: boolean;
  /** Show it again on demand. This is what Help does. */
  openOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingState>({
  isShowing: false,
  finishedThisSession: false,
  openOnboarding: () => {},
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
  const [finishedThisSession, setFinishedThisSession] = useState(false);
  // Whether the current showing is the automatic first-run one, as opposed to
  // someone re-reading it from Help.
  const autoShownRef = useRef(false);

  useEffect(() => {
    // Wait until entitlement resolves so a grandfathered/subscribed owner is
    // never shown a paywall-forward onboarding for something they already have.
    if (!ready) return;
    // In dev, allow re-showing on refresh. In production this stays once-only.
    const isDev = import.meta.env.DEV;
    if (isPro) return;
    if (!isDev && hasOnboarded()) return;
    autoShownRef.current = true;
    setShow(true);
  }, [ready, isPro]);

  /** Re-open on demand. Help uses this — there was previously no way back in. */
  const openOnboarding = useCallback(() => {
    autoShownRef.current = false;
    setShow(true);
  }, []);

  const finish = useCallback(
    (openPaywallAfter: boolean) => {
      markOnboarded();
      setShow(false);
      // Only a genuine first run should suppress the install prompt for the
      // rest of the session; re-reading Help should not.
      if (autoShownRef.current) setFinishedThisSession(true);
      autoShownRef.current = false;
      if (openPaywallAfter) openPaywall("onboarding");
    },
    [openPaywall]
  );

  return (
    <OnboardingContext.Provider
      value={{ isShowing: show, finishedThisSession, openOnboarding }}
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
