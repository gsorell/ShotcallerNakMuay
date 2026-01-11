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

// GA4 Measurement ID and API Secret (for Measurement Protocol)
export const GA_MEASUREMENT_ID = "G-5GY5JTX5KZ";
// API Secret from GA4 Admin > Data Streams > Measurement Protocol API secrets
// This is safe to include in client code - it only allows sending data, not reading
const GA_API_SECRET = "GYagL3PhQGa2d8daPA6hJg";

// Check if running in Capacitor native app
const isCapacitorNative = () => {
  return (
    typeof window !== "undefined" &&
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
};

// Check if running on iOS native
const isIOSNative = () => {
  return (
    typeof window !== "undefined" &&
    (window as any).Capacitor?.getPlatform?.() === "ios"
  );
};

// Generate or retrieve a client ID for Measurement Protocol
const getClientId = (): string => {
  const storageKey = "ga_client_id";
  let clientId = localStorage.getItem(storageKey);
  if (!clientId) {
    // Generate a random client ID
    clientId = `${Date.now()}.${Math.random().toString(36).substring(2)}`;
    localStorage.setItem(storageKey, clientId);
  }
  return clientId;
};

// Get or create session ID
const getSessionId = (): string => {
  const storageKey = "ga_session_id";
  let sessionId = sessionStorage.getItem(storageKey);
  if (!sessionId) {
    sessionId = Date.now().toString();
    sessionStorage.setItem(storageKey, sessionId);
  }
  return sessionId;
};

// Send event via GA4 Measurement Protocol (for iOS native)
const sendMeasurementProtocolEvent = async (
  eventName: string,
  params?: Record<string, any>
) => {
  // Measurement Protocol requires an API secret
  if (!GA_API_SECRET) {
    console.log("[GA4-MP] API secret not configured, skipping:", eventName);
    return;
  }

  try {
    const clientId = getClientId();
    const sessionId = getSessionId();

    const payload = {
      client_id: clientId,
      user_id: clientId, // Optional but helps with user tracking
      timestamp_micros: Date.now() * 1000,
      non_personalized_ads: false,
      events: [
        {
          name: eventName,
          params: {
            engagement_time_msec: 100, // Must be a number, not string
            session_id: sessionId,
            ...params,
          },
        },
      ],
    };

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;

    console.log("[GA4-MP] Sending event:", eventName, "to:", url);
    console.log("[GA4-MP] Payload:", JSON.stringify(payload));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("[GA4-MP] Response status:", response.status);

    if (response.ok || response.status === 204) {
      console.log("[GA4-MP] Event sent successfully:", eventName);
    } else {
      const text = await response.text();
      console.warn("[GA4-MP] Failed to send event:", response.status, text);
    }
  } catch (error) {
    console.error("[GA4-MP] Error sending event:", error);
  }
};

// Track if we're using Measurement Protocol
let usingMeasurementProtocol = false;

// Initialize GA4
export const initializeGA4 = () => {
  // Skip if no window
  if (typeof window === "undefined") {
    return;
  }

  // Allow on native apps OR non-localhost web
  const isNative = isCapacitorNative();
  const isIOS = isIOSNative();
  const isLocalhost = window.location.hostname === "localhost";

  if (!isNative && isLocalhost) {
    // Skip analytics on localhost web development only
    return;
  }

  console.log("[GA4] Initializing analytics, isNative:", isNative, "isIOS:", isIOS);

  // For iOS native, use Measurement Protocol (fetch-based)
  // because WKWebView blocks external scripts
  if (isIOS) {
    console.log("[GA4] iOS detected - using Measurement Protocol");
    usingMeasurementProtocol = true;

    // Send session_start first (required for realtime to work)
    sendMeasurementProtocolEvent("session_start", {});

    // Send initial page view via Measurement Protocol
    sendMeasurementProtocolEvent("page_view", {
      page_title: "Nak Muay Shot Caller",
      page_location: "app://shotcallernakmuay",
    });
    return;
  }

  // For web and Android, use standard gtag.js
  // Initialize dataLayer and gtag BEFORE loading script
  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args: any[]) {
    window.dataLayer.push(arguments);
  };

  // Load the Google Analytics script
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

  script.onload = () => {
    console.log("[GA4] Script loaded successfully");
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_title: "Nak Muay Shot Caller",
      page_location: window.location.href,
    });
    console.log("[GA4] Config sent");
  };

  script.onerror = (error) => {
    console.error("[GA4] Failed to load script:", error);
    // Fallback to Measurement Protocol if script fails to load
    console.log("[GA4] Falling back to Measurement Protocol");
    usingMeasurementProtocol = true;
    sendMeasurementProtocolEvent("page_view", {
      page_title: "Nak Muay Shot Caller",
      page_location: window.location.href,
    });
  };

  document.head.appendChild(script);
};

// Track events
export const trackEvent = (
  eventName: string,
  parameters?: Record<string, any>
) => {
  if (typeof window === "undefined") return;

  // Use Measurement Protocol for iOS native
  if (usingMeasurementProtocol) {
    sendMeasurementProtocolEvent(eventName, {
      event_category: parameters?.["category"] || "engagement",
      event_label: parameters?.["label"] || "",
      value: parameters?.["value"] || 0,
      ...parameters,
    });
    return;
  }

  // Use gtag for web/Android
  if (window.gtag) {
    window.gtag("event", eventName, {
      event_category: "engagement",
      event_label: parameters?.["label"] || "",
      value: parameters?.["value"] || 0,
      ...parameters,
    });
  }
};
