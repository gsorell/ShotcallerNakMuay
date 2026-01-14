import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { CapacitorHttp } from '@capacitor/core';

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
  CustomGroupCreated: "custom_group_created",

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

// Enable debug mode to see events in GA4 DebugView
// Set to false for production - debug endpoint validates but doesn't send to GA4
const GA_DEBUG_MODE = false;

// Check if running in Capacitor native app
const isCapacitorNative = () => {
  return Capacitor.isNativePlatform();
};

// Check if running on iOS native
const isIOSNative = () => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
};

// Debug log storage for on-screen display (iOS only)
export const debugLogs: string[] = [];
const addDebugLog = (message: string) => {
  // Only collect debug logs on iOS native
  if (!isIOSNative()) return;
  const timestamp = new Date().toLocaleTimeString();
  debugLogs.push(`[${timestamp}] ${message}`);
  // Keep only last 20 logs
  if (debugLogs.length > 20) debugLogs.shift();
  console.log(`[GA4] ${message}`);
};

// Generate or retrieve a client ID for Measurement Protocol
const getClientId = async (): Promise<string> => {
  const storageKey = "ga_client_id";
  
  try {
    // Use Capacitor Preferences for native apps (more reliable on iOS)
    if (isCapacitorNative()) {
      const { value } = await Preferences.get({ key: storageKey });
      if (value) {
        return value;
      }
      // Generate new client ID
      const clientId = `${Date.now()}.${Math.random().toString(36).substring(2)}`;
      await Preferences.set({ key: storageKey, value: clientId });
      return clientId;
    }
    
    // Fallback to localStorage for web
    let clientId = localStorage.getItem(storageKey);
    if (!clientId) {
      clientId = `${Date.now()}.${Math.random().toString(36).substring(2)}`;
      localStorage.setItem(storageKey, clientId);
    }
    return clientId;
  } catch (error) {
    console.error("[GA4] Error managing client ID:", error);
    // Fallback to a temporary client ID
    return `${Date.now()}.${Math.random().toString(36).substring(2)}`;
  }
};

// Get or create session ID with timeout (30 minutes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const getSessionId = async (): Promise<string> => {
  const storageKey = "ga_session_id";
  const timestampKey = "ga_session_timestamp";
  
  try {
    // Use Capacitor Preferences for native apps
    if (isCapacitorNative()) {
      const { value: sessionId } = await Preferences.get({ key: storageKey });
      const { value: timestamp } = await Preferences.get({ key: timestampKey });
      
      const now = Date.now();
      
      // Check if session is still valid
      if (sessionId && timestamp) {
        const lastActivity = parseInt(timestamp, 10);
        if (now - lastActivity < SESSION_TIMEOUT_MS) {
          // Update timestamp
          await Preferences.set({ key: timestampKey, value: now.toString() });
          return sessionId;
        }
      }
      
      // Create new session
      const newSessionId = now.toString();
      await Preferences.set({ key: storageKey, value: newSessionId });
      await Preferences.set({ key: timestampKey, value: now.toString() });
      return newSessionId;
    }
    
    // Fallback to sessionStorage for web
    let sessionId = sessionStorage.getItem(storageKey);
    if (!sessionId) {
      sessionId = Date.now().toString();
      sessionStorage.setItem(storageKey, sessionId);
    }
    return sessionId;
  } catch (error) {
    console.error("[GA4] Error managing session ID:", error);
    return Date.now().toString();
  }
};

// Send event via GA4 Measurement Protocol (for iOS native)
const sendMeasurementProtocolEvent = async (
  eventName: string,
  params?: Record<string, any>
) => {
  addDebugLog(`Preparing to send: ${eventName}`);

  // Measurement Protocol requires an API secret
  if (!GA_API_SECRET) {
    addDebugLog("ERROR: No API secret");
    return;
  }

  try {
    // Get IDs asynchronously
    const clientId = await getClientId();
    const sessionId = await getSessionId();
    addDebugLog(`clientId: ${clientId.substring(0, 10)}...`);

    const payload = {
      client_id: clientId,
      user_id: clientId,
      timestamp_micros: Date.now() * 1000,
      non_personalized_ads: false,
      events: [
        {
          name: eventName,
          params: {
            engagement_time_msec: 100,
            session_id: sessionId,
            platform: Capacitor.getPlatform(),
            app_version: "1.4.23",
            debug_mode: GA_DEBUG_MODE ? 1 : 0,
            ...params,
          },
        },
      ],
    };

    // Use debug endpoint if debug mode is enabled
    const endpoint = GA_DEBUG_MODE
      ? "https://www.google-analytics.com/debug/mp/collect"
      : "https://www.google-analytics.com/mp/collect";
    const url = `${endpoint}?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;

    addDebugLog(`Sending via CapacitorHttp: ${eventName}...`);

    // Use CapacitorHttp for native iOS to bypass WKWebView CORS restrictions
    if (isIOSNative()) {
      const response = await CapacitorHttp.post({
        url,
        headers: {
          "Content-Type": "application/json",
        },
        data: payload,
      });

      addDebugLog(`Response status: ${response.status}`);

      // Debug endpoint returns validation info as JSON
      if (GA_DEBUG_MODE && response.data) {
        const debugStr = typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data);
        addDebugLog(`Debug resp: ${debugStr.substring(0, 100)}`);
      }
    } else {
      // Fallback to fetch for web
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      addDebugLog(`Response status: ${response.status}`);

      if (GA_DEBUG_MODE) {
        const debugResponse = await response.text();
        addDebugLog(`Debug resp: ${debugResponse.substring(0, 100)}`);
      } else if (!response.ok && response.status !== 204) {
        addDebugLog(`ERROR: ${response.status}`);
      }
    }
  } catch (error) {
    addDebugLog(`HTTP ERROR: ${error}`);
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
    return;
  }

  addDebugLog(`Platform: isNative=${isNative}, isIOS=${isIOS}, platform=${Capacitor.getPlatform()}`);

  // For iOS native, use Measurement Protocol (fetch-based)
  // because WKWebView blocks external scripts and has ITP restrictions
  if (isIOS) {
    addDebugLog("Using Measurement Protocol for iOS");
    usingMeasurementProtocol = true;

    // Send initial events (page_view required for realtime to work)
    // Note: session_start is reserved by GA4, so we just send page_view
    // Use setTimeout to ensure storage is initialized
    setTimeout(async () => {
      try {
        addDebugLog("Sending initial events...");
        await sendMeasurementProtocolEvent("page_view", {
          page_title: "Nak Muay Shot Caller",
          page_location: "app://shotcallernakmuay/home",
          engagement_time_msec: 100,
        });
        addDebugLog("Initial events sent!");
      } catch (error) {
        console.error("[GA4] Initialization error:", error);
      }
    }, 100);
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
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_title: "Nak Muay Shot Caller",
      page_location: window.location.href,
    });
  };

  script.onerror = () => {
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
