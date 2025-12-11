import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App";
import { TTSProvider, UIProvider } from "@/features/shared";
import { WorkoutProvider } from "@/features/workout";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TTSProvider>
      <UIProvider>
        <WorkoutProvider>
          <App />
        </WorkoutProvider>
      </UIProvider>
    </TTSProvider>
  </React.StrictMode>
);
