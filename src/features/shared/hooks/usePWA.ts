import { useCallback, useEffect, useMemo, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  showInstallPrompt: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
}

export interface PWAHook extends PWAState {
  promptInstall: () => Promise<boolean>;
  dismissPrompt: () => void;
  shouldShowPrompt: (userStats: UserEngagementStats) => boolean;
}

export interface UserEngagementStats {
  visitCount: number;
  timeOnSite: number;
  completedWorkouts: number;
  lastVisit?: Date;
}

export function usePWA(): PWAHook {
  const [state, setState] = useState<PWAState>(() => {
    // Check localStorage for persistent install status
    const storedInstallStatus =
      localStorage.getItem("pwa_installed") === "true";
    return {
      isInstallable: false,
      isInstalled: storedInstallStatus,
      showInstallPrompt: false,
      installPrompt: null,
    };
  });

  // Check if app is already installed/running as PWA
  const checkInstallStatus = useCallback(() => {
    // Multiple detection methods for better compatibility
    const standaloneDisplay = window.matchMedia(
      "(display-mode: standalone)"
    ).matches;
    const iOSStandalone = (window.navigator as any).standalone === true;
    const androidApp = document.referrer.includes("android-app://");

    // Additional checks for common PWA environments
    const windowControlsOverlay = window.matchMedia(
      "(display-mode: window-controls-overlay)"
    ).matches;
    const minimalUI = window.matchMedia("(display-mode: minimal-ui)").matches;
    const fullscreen = window.matchMedia("(display-mode: fullscreen)").matches;

    // Check URL parameters that might indicate PWA launch
    const urlParams = new URLSearchParams(window.location.search);
    const launchedAsPWA = urlParams.has("pwa") || urlParams.has("standalone");

    // Check stored install status from localStorage
    const storedInstallStatus =
      localStorage.getItem("pwa_installed") === "true";

    const isInstalled =
      storedInstallStatus ||
      standaloneDisplay ||
      iOSStandalone ||
      androidApp ||
      windowControlsOverlay ||
      minimalUI ||
      fullscreen ||
      launchedAsPWA;

    // Debug logging removed

    // Also check if the app meets basic PWA criteria
    const hasManifest = document.querySelector('link[rel="manifest"]');
    const hasServiceWorker = "serviceWorker" in navigator;
    const isSecureContext =
      location.protocol === "https:" || location.hostname === "localhost";

    const isPWAReady = hasManifest && hasServiceWorker && isSecureContext;

    setState((prev) => ({
      ...prev,
      isInstalled,
      // If we meet PWA criteria but no beforeinstallprompt, still mark as installable
      isInstallable: Boolean(
        prev.isInstallable || (isPWAReady && !isInstalled)
      ),
    }));
  }, []);

  // Handle beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome from automatically showing the prompt
      e.preventDefault();

      const promptEvent = e as BeforeInstallPromptEvent;
      setState((prev) => ({
        ...prev,
        isInstallable: true,
        installPrompt: promptEvent,
      }));
    };

    const handleAppInstalled = () => {
      // Persist install status to localStorage
      localStorage.setItem("pwa_installed", "true");

      setState((prev) => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
        showInstallPrompt: false,
        installPrompt: null,
      }));

      // Track install event
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "pwa_install", {
          event_category: "engagement",
          event_label: "app_installed",
        });
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Check initial install status
    checkInstallStatus();

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [checkInstallStatus]);

  // Determine if we should show install prompt based on user engagement
  const shouldShowPrompt = useCallback(
    (userStats: UserEngagementStats): boolean => {
      if (state.isInstalled) return false;

      // Check if user has dismissed prompt recently
      const dismissedKey = "pwa_prompt_dismissed";
      const lastDismissed = localStorage.getItem(dismissedKey);
      if (lastDismissed) {
        const dismissedDate = new Date(lastDismissed);
        const daysSinceDismissal =
          (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissal < 7) return false; // Don't show again for a week
      }

      // Engagement-based criteria
      const criteria = {
        // Returning user (2+ visits)
        returningUser: userStats.visitCount >= 2,

        // Engaged user (spent 2+ minutes exploring)
        timeEngaged: userStats.timeOnSite >= 120,

        // Completed at least one workout
        completedWorkout: userStats.completedWorkouts > 0,

        // Been on site for at least 2 seconds this session
        currentSessionEngagement: userStats.timeOnSite >= 2,
      };

      // Show prompt if user meets any of the engagement criteria
      // CHANGED: Remove dependency on isInstallable - show instructions even without beforeinstallprompt
      return (
        criteria.returningUser ||
        criteria.timeEngaged ||
        criteria.completedWorkout ||
        criteria.currentSessionEngagement
      );
    },
    [state.isInstalled]
  );

  // Trigger install prompt
  const promptInstall = useCallback(async (): Promise<boolean> => {
    // If we have the native prompt, use it
    if (state.installPrompt) {
      try {
        await state.installPrompt.prompt();
        const choiceResult = await state.installPrompt.userChoice;

        // Track user choice
        if (typeof window !== "undefined" && (window as any).gtag) {
          (window as any).gtag("event", "pwa_prompt_response", {
            event_category: "engagement",
            event_label: choiceResult.outcome,
          });
        }

        if (choiceResult.outcome === "accepted") {
          setState((prev) => ({
            ...prev,
            showInstallPrompt: false,
            installPrompt: null,
          }));
          return true;
        } else {
          // User dismissed - remember this
          localStorage.setItem(
            "pwa_prompt_dismissed",
            new Date().toISOString()
          );
          setState((prev) => ({ ...prev, showInstallPrompt: false }));
          return false;
        }
      } catch (error) {
        return false;
      }
    }

    return false;
  }, [state.installPrompt]);

  // Manually dismiss prompt
  const dismissPrompt = useCallback(() => {
    localStorage.setItem("pwa_prompt_dismissed", new Date().toISOString());
    setState((prev) => ({ ...prev, showInstallPrompt: false }));

    // Track dismissal
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "pwa_prompt_dismissed", {
        event_category: "engagement",
        event_label: "manual_dismiss",
      });
    }
  }, []);

  return useMemo(
    () => ({
      ...state,
      promptInstall,
      dismissPrompt,
      shouldShowPrompt,
    }),
    [state, promptInstall, dismissPrompt, shouldShowPrompt]
  );
}
