import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App"; // Corrected: Removed .tsx extension
import { TTSProvider } from "./contexts/TTSProvider";
import { UIProvider } from "./contexts/UIProvider";
import { WorkoutProvider } from "./contexts/WorkoutProvider";
import "./index.css";

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
