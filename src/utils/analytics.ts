// Analytics event names
export const AnalyticsEvents = {
  // Timer events
  WorkoutStart: "workout_start",
  WorkoutComplete: "workout_complete",
  WorkoutPause: "workout_pause",
  WorkoutResume: "workout_resume",
  WorkoutStop: "workout_stop",

  // Settings events
  SettingToggle: "setting_toggle",
  EmphasisSelect: "emphasis_select",
  EmphasisDeselect: "emphasis_deselect",
  EmphasisListToggle: "emphasis_list_toggle",
  DifficultyChange: "difficulty_change",

  // Navigation events
  PageChange: "page_change",
  TechniqueEditorOpen: "technique_editor_open",
  WorkoutLogsOpen: "workout_logs_open",

  // PWA events
  PWAInstallPrompt: "pwa_install_prompt",
  PWAInstallAccept: "pwa_install_accept",
  PWAInstallDecline: "pwa_install_decline",
} as const;

// Google Analytics 4 (GA4) implementation
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Your GA4 Measurement ID - replace 'G-XXXXXXXXXX' with your actual measurement ID
export const GA_MEASUREMENT_ID = "G-5GY5JTX5KZ";

// Check if running in Capacitor native app
const isCapacitorNative = () => {
  return (
    typeof window !== "undefined" &&
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
};

// Initialize GA4
export const initializeGA4 = () => {
  // Skip if no window
  if (typeof window === "undefined") {
    return;
  }

  // Allow on native apps OR non-localhost web
  const isNative = isCapacitorNative();
  const isLocalhost = window.location.hostname === "localhost";

  if (!isNative && isLocalhost) {
    // Skip analytics on localhost web development only
    return;
  }

  // Load the Google Analytics script
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize dataLayer and gtag
  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args: any[]) {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    page_title: "Nak Muay Shot Caller",
    page_location: window.location.href,
  });
};

// Track events
export const trackEvent = (
  eventName: string,
  parameters?: Record<string, any>
) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, {
      event_category: "engagement",
      event_label: parameters?.["label"] || "",
      value: parameters?.["value"] || 0,
      ...parameters,
    });
  }
};
