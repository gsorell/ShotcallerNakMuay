import React, { useEffect, useRef } from "react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

// Types

// Storage

// Components
import { WorkoutCompleted, WorkoutLogs } from "@/features/logs";
import {
  AppLayout,
  OnboardingModal,
  PWAInstallPrompt,
  useNavigationGestures,
  usePWA,
  useSystemServices,
  useTTSContext,
  useUIContext,
  useUserEngagement,
} from "@/features/shared";

import { TechniqueEditor } from "@/features/technique-editor";
import {
  ActiveSessionUI,
  SessionTransitionWrapper,
  WorkoutSetup,
  useWorkoutContext,
} from "@/features/workout";

// Utilities
import { initializeGA4 } from "@/utils/analytics";
import { displayInAppBrowserWarning } from "@/utils/inAppBrowserDetector";
import { fmtTime } from "@/utils/timeUtils";

// CSS
import "@/App.css";
import "@/styles/difficulty.css";

// Global state to persist modal scroll position across re-renders
let modalScrollPosition = 0;

export default function App() {
  // --- 1. Init & Global Config ---
  useEffect(() => {
    displayInAppBrowserWarning();
    initializeGA4();

    // Configure status bar on native platforms
    if (Capacitor.isNativePlatform()) {
      // Dark style = white/light text for dark backgrounds
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      // Make status bar transparent so content extends behind it
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    }
  }, []);

  // --- 2. Contexts ---
  useSystemServices();
  const {
    techniques,
    emphasisList,
    settings,
    timer,
    calloutEngine,
    homePageStats,
    favoriteConfig,
    persistTechniques,
    hasSelectedEmphasis,
    startSession,
    pauseSession,
    stopSession,
    resumeWorkout,
    viewCompletionScreen,
    status,
    restartSession,
  } = useWorkoutContext();

  // --- 3. UI State ---
  const {
    page,
    setPage,
    lastWorkout,
    showAdvanced,
    setShowAdvanced,
    showAllEmphases,
    setShowAllEmphases,
    showOnboardingMsg,
    setShowOnboardingMsg,
    showPWAPrompt,
    setShowPWAPrompt,
  } = useUIContext();

  // --- 3a. PWA / App Install Prompt ---
  const { shouldShowPrompt, dismissPrompt } = usePWA();

  // --- 4. UI Refs ---
  const isEditorRef = useRef(false);

  useEffect(() => {
    isEditorRef.current = page === "editor";
  }, [page]);

  const { userEngagement, setUserEngagement } = useUserEngagement(isEditorRef);

  // Show app install prompt based on user engagement (only for web visitors)
  useEffect(() => {
    // Don't show if already running as native app
    if (Capacitor.isNativePlatform()) return;

    // Check if we should show the prompt based on engagement
    if (shouldShowPrompt(userEngagement) && !showPWAPrompt) {
      setShowPWAPrompt(true);
    }
  }, [userEngagement, shouldShowPrompt, showPWAPrompt, setShowPWAPrompt]);

  const {
    voices: unifiedVoices,
    currentVoice,
    setCurrentVoice,
    stop: stopTTS,
    isAvailable: ttsAvailable,
    voiceCompatibilityWarning,
    testVoice: ttsTestVoice,
    saveVoicePreference,
  } = useTTSContext();

  // --- 5. Navigation / PWA ---

  // --- 7. Navigation / PWA ---
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useNavigationGestures({
    onBack: () => {
      if (showOnboardingMsg) setShowOnboardingMsg(false);
      else if (page === "editor" || page === "logs" || page === "completed")
        setPage("timer");
    },
    enabled: page !== "timer" || showOnboardingMsg,
    debugLog: false,
  });

  const isActive = timer.running || timer.isPreRound;

  const TechniqueEditorAny =
    TechniqueEditor as unknown as React.ComponentType<any>;

  const linkButtonStyle: React.CSSProperties = {
    all: "unset",
    cursor: "pointer",
    color: "#f9a8d4",
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid transparent",
    fontWeight: 700,
    background: "transparent",
    textAlign: "center",
  };

  const renderPageContent = () => {
    switch (page) {
      case "logs":
        return (
          <WorkoutLogs
            onBack={() => setPage("timer")}
            emphasisList={emphasisList}
            onResume={resumeWorkout}
            onViewCompletion={viewCompletionScreen}
          />
        );

      case "editor":
        return (
          <TechniqueEditorAny
            techniques={techniques}
            setTechniques={persistTechniques}
            onBack={() => setPage("timer")}
          />
        );

      case "completed":
        if (!lastWorkout) return null;
        return (
          <WorkoutCompleted
            stats={lastWorkout}
            onRestart={() => restartSession(lastWorkout)}
            onReset={() => setPage("timer")}
            onViewLog={() => setPage("logs")}
          />
        );

      default: // "timer"
        return (
          <>
            <SessionTransitionWrapper isActive={isActive}>
              <ActiveSessionUI
                running={timer.running}
                isPreRound={timer.isPreRound}
                paused={timer.paused}
                isResting={timer.isResting}
                timeLeft={timer.timeLeft}
                currentRound={timer.currentRound}
                roundsCount={settings.roundsCount}
                restTimeLeft={timer.restTimeLeft}
                preRoundTimeLeft={timer.preRoundTimeLeft}
                fmtTime={fmtTime}
                getStatus={() => status}
                currentCallout={calloutEngine.currentCallout}
                onPause={pauseSession}
                onStop={stopSession}
                selectedEmphases={settings.selectedEmphases}
                emphasisList={emphasisList}
              />
            </SessionTransitionWrapper>

            {!isActive && <WorkoutSetup />}
          </>
        );
    }
  };

  const handleDismissPWAPrompt = () => {
    setShowPWAPrompt(false);
  };

  const handleDismissPWAPromptPermanently = () => {
    dismissPrompt();
    setShowPWAPrompt(false);
  };

  // --- 9. Render ---
  return (
    <>
      <PWAInstallPrompt
        isVisible={showPWAPrompt}
        onDismiss={handleDismissPWAPrompt}
        onDismissPermanently={handleDismissPWAPromptPermanently}
      />

      <OnboardingModal
        open={showOnboardingMsg}
        modalScrollPosition={modalScrollPosition}
        linkButtonStyle={linkButtonStyle}
        setPage={setPage}
        onClose={() => setShowOnboardingMsg(false)}
      />

      <AppLayout
        isActive={isActive}
        page={page}
        onHelp={() => setShowOnboardingMsg(true)}
        onLogoClick={() => {
          setPage("timer");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        hasSelectedEmphasis={hasSelectedEmphasis}
        linkButtonStyle={linkButtonStyle}
        setPage={setPage}
        setShowOnboardingMsg={setShowOnboardingMsg}
      >
        {renderPageContent()}
      </AppLayout>
    </>
  );
}
