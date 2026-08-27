import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App";
import { EntitlementProvider } from "@/features/entitlement";
import { OnboardingProvider } from "@/features/onboarding";
import { PaywallProvider } from "@/features/paywall";
import { TTSProvider, UIProvider } from "@/features/shared";
import { WorkoutProvider } from "@/features/workout";
import "@/styles/backLink.css";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <EntitlementProvider>
      <PaywallProvider>
        {/* Onboarding sits INSIDE UIProvider, not outside it: its last read of
            the app — "here is where the numbers are explained" — has to be able
            to navigate, and navigation is UI state. Nothing above it consumes
            onboarding state, so the swap costs nothing. */}
        <TTSProvider>
          <UIProvider>
            <OnboardingProvider>
              <WorkoutProvider>
                <App />
              </WorkoutProvider>
            </OnboardingProvider>
          </UIProvider>
        </TTSProvider>
      </PaywallProvider>
    </EntitlementProvider>
  </React.StrictMode>
);
