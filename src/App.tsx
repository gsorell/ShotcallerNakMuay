import React, { useEffect, useRef } from "react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

// Types

// Storage

// Components
import { WorkoutCompleted, WorkoutLogs, seedAwardedCharmsOnce } from "@/features/logs";
import {
  AppLayout,
  GlossaryModal,
  PWAInstallPrompt,
  useNavigationGestures,
  usePWA,
  useSystemServices,
  useTTSContext,
  useUIContext,
  useUserEngagement,
} from "@/features/shared";

import { LearnSection } from "@/features/learn";
import { hasOnboarded, useOnboardingState } from "@/features/onboarding";
import { NextLevelPrompt, RoadmapSection } from "@/features/roadmap";
import { roundDescription, roundTitle } from "@/features/roadmap/session";
import { TechniqueEditor } from "@/features/technique-editor";
import {
  ActiveSessionUI,
  SessionTransitionWrapper,
  StickyStartControls,
  WorkoutSetup,
  useWorkoutContext,
} from "@/features/workout";

// Utilities
import { initializeGA4 } from "@/utils/analytics";
import { displayInAppBrowserWarning } from "@/utils/inAppBrowserDetector";
import { scrollContentToTop } from "@/utils/scroll";
import { fmtTime } from "@/utils/timeUtils";

// CSS
import "@/App.css";
import "@/styles/difficulty.css";
import "@/styles/setupActions.css";

export default function App() {
  // --- 1. Init & Global Config ---
  useEffect(() => {
    displayInAppBrowserWarning();
    initializeGA4();
    // Suppress a celebration backlog for users who already had history pre-charms.
    seedAwardedCharmsOnce();

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
    isInterruptedByCall,
    isFreestyle,
    activeRoadmap,
  } = useWorkoutContext();

  // During rest on a guided level, tell the student what the next round asks
  // for. `currentRound` is still the round that just ended — the timer only
  // increments it when rest runs out — so the next one is +1.
  const upNext =
    activeRoadmap && timer.isResting
      ? (() => {
          const next = timer.currentRound + 1;
          if (next > settings.roundsCount) return null;
          return {
            round: next,
            title: roundTitle(next),
            description: roundDescription(
              activeRoadmap.path,
              activeRoadmap.level,
              next
            ),
          };
        })()
      : null;

  // --- 3. UI State ---
  const {
    page,
    setPage,
    lastWorkout,
    showAdvanced,
    setShowAdvanced,
    showAllEmphases,
    setShowAllEmphases,
    showGlossary,
    setShowGlossary,
    showPWAPrompt,
    setShowPWAPrompt,
  } = useUIContext();

  // --- 3a. PWA / App Install Prompt ---
  const { shouldShowPrompt, dismissPrompt } = usePWA();
  const onboarding = useOnboardingState();

  // --- 4. UI Refs ---
  const isEditorRef = useRef(false);

  useEffect(() => {
    isEditorRef.current = page === "editor";
  }, [page]);

  const { userEngagement, setUserEngagement } = useUserEngagement(isEditorRef);

  // Track if user has dismissed the prompt this session
  const hasUserDismissedPrompt = useRef(false);

  // Show app install prompt based on user engagement (only for web visitors)
  useEffect(() => {
    // Don't show if already running as native app
    if (Capacitor.isNativePlatform()) return;

    // Never stack this on the onboarding, and never chase it the moment the
    // onboarding closes. A first-time visitor should get one thing to read,
    // not two — the install ask now lives on the onboarding's own last step,
    // and this prompt is for people who come back.
    if (onboarding.isShowing || onboarding.finishedThisSession) return;
    if (!hasOnboarded()) return;

    // Don't show if user already dismissed this session
    if (hasUserDismissedPrompt.current) return;

    // Check if we should show the prompt based on engagement
    if (shouldShowPrompt(userEngagement) && !showPWAPrompt) {
      setShowPWAPrompt(true);
    }
  }, [userEngagement, shouldShowPrompt, showPWAPrompt, setShowPWAPrompt, onboarding]);

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
      if (showGlossary) setShowGlossary(false);
      else if (
        page === "editor" ||
        page === "logs" ||
        page === "completed" ||
        page === "learn" ||
        page === "roadmap"
      )
        setPage("timer");
    },
    enabled: page !== "timer" || showGlossary,
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

      case "learn":
        return <LearnSection onBack={() => setPage("timer")} />;

      case "roadmap":
        return <RoadmapSection onBack={() => setPage("timer")} />;

      case "completed":
        if (!lastWorkout) return null;
        return (
          <WorkoutCompleted
            stats={lastWorkout}
            onRestart={() => restartSession(lastWorkout)}
            onReset={() => setPage("timer")}
            onViewLog={() => setPage("logs")}
            primaryAction={
              lastWorkout.roadmap ? (
                <NextLevelPrompt completed={lastWorkout.roadmap} />
              ) : null
            }
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
                isInterruptedByCall={isInterruptedByCall}
                upNext={upNext}
              />
            </SessionTransitionWrapper>

            {!isActive && <WorkoutSetup />}
          </>
        );
    }
  };

  const handleDismissPWAPrompt = () => {
    hasUserDismissedPrompt.current = true;
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

      <GlossaryModal
        open={showGlossary}
        onClose={() => setShowGlossary(false)}
        onOpenLearn={() => {
          setShowGlossary(false);
          setPage("learn");
        }}
      />

      <AppLayout
        isActive={isActive}
        page={page}
        onHelp={onboarding.openOnboarding}
        onLogoClick={() => {
          setPage("timer");
          scrollContentToTop();
        }}
        hasSelectedEmphasis={hasSelectedEmphasis}
        linkButtonStyle={linkButtonStyle}
        setPage={setPage}
        bottomBar={
          page === "timer" && !isActive && hasSelectedEmphasis ? (
            <StickyStartControls
              onStart={startSession}
              difficulty={settings.difficulty}
              setDifficulty={settings.setDifficulty}
              selectedEmphases={settings.selectedEmphases}
              onClearEmphases={settings.clearAllEmphases}
            />
          ) : null
        }
      >
        {renderPageContent()}
      </AppLayout>
    </>
  );
}
