import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App";
import { EntitlementProvider } from "@/features/entitlement";
import { PaywallProvider } from "@/features/paywall";
import { TTSProvider, UIProvider } from "@/features/shared";
import { WorkoutProvider } from "@/features/workout";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <EntitlementProvider>
      <PaywallProvider>
        <TTSProvider>
          <UIProvider>
            <WorkoutProvider>
              <App />
            </WorkoutProvider>
          </UIProvider>
        </TTSProvider>
      </PaywallProvider>
    </EntitlementProvider>
  </React.StrictMode>
);
