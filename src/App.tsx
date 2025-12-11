import React, { useEffect, useRef } from "react";

// Types

// Storage
import { VOICE_STORAGE_KEY } from "@/constants/storage";

// Components
import { WorkoutCompleted, WorkoutLogs } from "@/features/logs";
import {
  AppLayout,
  OnboardingModal,
  PWAInstallPrompt,
  useNavigationGestures,
  useSystemServices,
  useTTSContext,
  useUIContext,
  useUserEngagement,
} from "@/features/shared";

import { TechniqueEditor } from "@/features/technique-editor";
import {
  ActiveSessionUI,
  WorkoutSetup,
  useWorkoutContext,
} from "@/features/workout";

// Utilities
import { initializeGA4, trackEvent } from "@/utils/analytics";
import { displayInAppBrowserWarning } from "@/utils/inAppBrowserDetector";
import { fmtTime } from "@/utils/timeUtils";
import { ttsService } from "@/utils/ttsService";

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
    // Clean up voice prefs on load
    try {
      const stored = localStorage.getItem(VOICE_STORAGE_KEY);
      if (stored) {
        const voiceData = JSON.parse(stored);
        if (!voiceData.lang?.toLowerCase().startsWith("en")) {
          localStorage.removeItem(VOICE_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(VOICE_STORAGE_KEY);
    }
  }, []);

  // --- 2. Contexts ---
  const { pwa } = useSystemServices();
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
  const isEditorRef = useRef(false);

  useEffect(() => {
    isEditorRef.current = page === "editor";
  }, [page]);

  const { userEngagement, setUserEngagement } = useUserEngagement(isEditorRef);

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

  useEffect(() => {
    if (isEditorRef.current) return;
    if (!pwa.isInstalled) {
      const dismissed = localStorage.getItem("pwa_install_dismissed");
      if (!dismissed) {
        const t = setTimeout(() => {
          if (!pwa.isInstalled && !isEditorRef.current) setShowPWAPrompt(true);
        }, 30000);
        return () => clearTimeout(t);
      }
    }
    return;
  }, [pwa.isInstalled]);

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

  function getStatus():
    | "ready"
    | "running"
    | "paused"
    | "stopped"
    | "resting"
    | "pre-round" {
    if (timer.isPreRound) return "pre-round";
    if (!timer.running) return "ready";
    if (timer.paused) return "paused";
    if (timer.isResting) return "resting";
    return "running";
  }

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
            onRestart={() => {
              stopSession();
              // Restore settings
              const emphasisKeys = lastWorkout.emphases
                .map((label: string) => {
                  const found = emphasisList.find((e) => e.label === label);
                  return found ? found.key : null;
                })
                .filter(Boolean);
              const restoredEmphases: any = {};
              emphasisKeys.forEach((key: string) => {
                restoredEmphases[key] = true;
              });
              settings.setSelectedEmphases(restoredEmphases);
              setPage("timer");
              setTimeout(() => {
                startSession();
              }, 150);
            }}
            onReset={() => setPage("timer")}
            onViewLog={() => setPage("logs")}
          />
        );

      default: // "timer"
        return (
          <>
            <div
              style={{
                minHeight: isActive ? "220px" : "0",
                transition: "min-height 0.3s ease-in-out",
              }}
            >
              <div
                style={{
                  minHeight: isActive ? "220px" : "0",
                  transition: "min-height 0.3s ease-in-out",
                }}
              >
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
                  getStatus={getStatus}
                  currentCallout={calloutEngine.currentCallout}
                  onPause={pauseSession}
                  onStop={stopSession}
                  selectedEmphases={settings.selectedEmphases}
                  emphasisList={emphasisList}
                />
              </div>
            </div>

            {!isActive && (
              <WorkoutSetup
                stats={homePageStats}
                favoriteConfig={favoriteConfig}
                emphasisList={emphasisList}
                selectedEmphases={settings.selectedEmphases}
                toggleEmphasis={settings.toggleEmphasis}
                techniques={techniques}
                showAllEmphases={showAllEmphases}
                setShowAllEmphases={setShowAllEmphases}
                setPage={setPage}
                roundsCount={settings.roundsCount}
                setRoundsCount={settings.setRoundsCount}
                roundMin={settings.roundMin}
                setRoundMin={settings.setRoundMin}
                restMinutes={settings.restMinutes}
                setRestMinutes={settings.setRestMinutes}
                showAdvanced={showAdvanced}
                setShowAdvanced={setShowAdvanced}
                southpawMode={settings.southpawMode}
                setSouthpawMode={settings.setSouthpawMode}
                addCalisthenics={settings.addCalisthenics}
                setAddCalisthenics={settings.setAddCalisthenics}
                readInOrder={settings.readInOrder}
                setReadInOrder={settings.setReadInOrder}
                currentVoice={currentVoice}
                voices={unifiedVoices}
                setCurrentVoice={setCurrentVoice}
                saveVoicePreference={saveVoicePreference}
                ttsService={ttsService}
                voiceSpeed={settings.voiceSpeed}
                setVoiceSpeed={settings.setVoiceSpeed}
                ttsAvailable={ttsAvailable}
                testVoice={() => {
                  stopTTS();
                  setTimeout(() => ttsTestVoice(), 50);
                }}
                voiceCompatibilityWarning={voiceCompatibilityWarning}
                trackEvent={trackEvent}
                onStart={startSession}
                difficulty={settings.difficulty}
                setDifficulty={settings.setDifficulty}
                clearAllEmphases={settings.clearAllEmphases}
              />
            )}
          </>
        );
    }
  };

  // --- 9. Render ---
  return (
    <>
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

      <PWAInstallPrompt
        isVisible={showPWAPrompt && !pwa.isInstalled}
        onInstall={async () => {
          const success = await pwa.promptInstall();
          setShowPWAPrompt(false);
          return success;
        }}
        onDismiss={() => setShowPWAPrompt(false)}
        onDismissPermanently={() => {
          localStorage.setItem("pwa_install_dismissed", "true");
          setShowPWAPrompt(false);
        }}
      />
    </>
  );
}
