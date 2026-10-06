import React, { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

// Types

// Storage

// Components
import { WorkoutCompleted, WorkoutLogs, seedAwardedCharmsOnce } from "@/features/logs";
import {
  AppLayout,
  AppMenu,
  GlossaryModal,
  PWAInstallPrompt,
  useNavigationGestures,
  usePWA,
  useSystemServices,
  useTTSContext,
  useUIContext,
  useUserEngagement,
} from "@/features/shared";

import { useEntitlement } from "@/features/entitlement";
import { LearnSection } from "@/features/learn";
import { hasOnboarded, useOnboardingState } from "@/features/onboarding";
import { usePaywall } from "@/features/paywall";
import { NextLevelPrompt, RoadmapSection } from "@/features/roadmap";
import { roundDescription, roundTitle } from "@/features/roadmap/session";
import {
  describeRound,
  finisherSeconds,
  planVaries,
} from "@/features/workout/utils/roundPlan";
import {
  ImportStyleModal,
  ShareStyleFlow,
  recordImport,
  useIncomingShare,
} from "@/features/style-share";
import { TechniqueEditor } from "@/features/technique-editor";
import {
  ActiveSessionUI,
  SessionTransitionWrapper,
  StickyStartControls,
  WorkoutSetup,
  useWorkoutContext,
} from "@/features/workout";

// Utilities
import { initializeGA4, trackEvent } from "@/utils/analytics";
import { displayInAppBrowserWarning } from "@/utils/inAppBrowserDetector";
import {
  pageScrollKey,
  restoreOnNextPage,
  scrollContentToTop,
} from "@/utils/scroll";
import {
  importKeyFor,
  toTechniqueGroup,
  type SharedStyle,
} from "@/utils/styleShare";
import { humanizeKey, prependGroup } from "@/utils/techniqueUtils";
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
    sessionPlan,
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

  // The same card for a normal session whose rounds differ from one another.
  // A session where every round is alike has nothing to announce, so it gets
  // no card and looks exactly as it always has.
  const variedPlan =
    !activeRoadmap && sessionPlan && planVaries(sessionPlan)
      ? sessionPlan
      : null;
  const styleLabel = (key: string) => {
    const found = emphasisList.find((e) => e.key === key);
    return found ? found.label : humanizeKey(key);
  };
  const planUpNext =
    variedPlan && timer.isResting
      ? (() => {
          const next = timer.currentRound + 1;
          const planned = variedPlan[next - 1];
          if (!planned) return null;
          const { title, notes } = describeRound(planned, styleLabel);
          return { round: next, title, description: notes.join(" · ") };
        })()
      : null;

  // What the round in progress is drawing on. Read off the plan rather than
  // the selection, which still lists every style in the session.
  const plannedNow =
    !activeRoadmap && sessionPlan && timer.running && !timer.isResting
      ? sessionPlan[Math.min(timer.currentRound, sessionPlan.length) - 1]
      : undefined;
  const inFinisher =
    plannedNow?.calisthenics === "finisher" &&
    timer.timeLeft > 0 &&
    timer.timeLeft <= finisherSeconds(settings.roundMin);
  const roundNote = !plannedNow
    ? null
    : inFinisher
    ? "Calisthenics Finisher"
    : plannedNow.calisthenics === "only"
    ? "Calisthenics Round"
    : plannedNow.content === "singles"
    ? "Warm-up · Single Techniques"
    : null;
  const activeStyleKeys =
    plannedNow && (variedPlan || inFinisher)
      ? inFinisher
        ? []
        : plannedNow.styles
      : null;

  // --- 3. UI State ---
  const {
    page,
    setPage,
    lastWorkout,
    showAllEmphases,
    setShowAllEmphases,
    showGlossary,
    setShowGlossary,
    showPWAPrompt,
    setShowPWAPrompt,
    setEditorFocusKey,
  } = useUIContext();

  // --- 3b. Shared styles arriving from outside the app ---
  //
  // A link tapped in a text message lands here: on native the app opens
  // straight to the confirmation below, and nothing is written until the
  // recipient says yes.
  const { incoming: incomingShare, dismiss: dismissIncomingShare } =
    useIncomingShare();
  const { isPro } = useEntitlement();

  const handleImportSharedStyle = useCallback(
    (style: SharedStyle) => {
      // `importKeyFor` guarantees this cannot land on a core style, which the
      // editor refuses to delete — an overwrite there would be unrecoverable.
      const key = importKeyFor(style.title, techniques);
      // Prepended so an imported style lands at the top of the editor next to
      // anything else the user made, rather than below every shipped style.
      persistTechniques(
        prependGroup(
          techniques as Record<string, unknown>,
          key,
          toTechniqueGroup(style)
        ) as typeof techniques
      );

      if (!isPro) recordImport();
      trackEvent("style_import_confirmed", {
        platform: Capacitor.getPlatform(),
        singles: style.singles.length,
        combos: style.combos.length,
        is_pro: isPro,
      });

      dismissIncomingShare();
      // Drop them on the new style rather than leaving them to hunt for it.
      setEditorFocusKey(key);
      setPage("editor");
      scrollContentToTop();
    },
    [
      techniques,
      persistTechniques,
      isPro,
      dismissIncomingShare,
      setEditorFocusKey,
      setPage,
    ]
  );

  // --- 3a. PWA / App Install Prompt ---
  const { shouldShowPrompt, dismissPrompt } = usePWA();
  const onboarding = useOnboardingState();

  // Whether the completion screen was opened from a row in the Workout Logs
  // rather than by finishing a session. From the logs it is a detail view,
  // and needs a way back to the list it came from.
  const [completionFromLogs, setCompletionFromLogs] = useState(false);
  useEffect(() => {
    if (page !== "completed") setCompletionFromLogs(false);
  }, [page]);

  // --- 4. UI Refs ---
  const isEditorRef = useRef(false);

  useEffect(() => {
    isEditorRef.current = page === "editor";
  }, [page]);

  const { userEngagement, setUserEngagement, recordCompletedWorkout } =
    useUserEngagement(isEditorRef);

  // A session that has already been asked to buy has had its one interruption.
  // On web the post-workout paywall carries the store buttons itself, so
  // following it with an install modal is the same ask twice in a row.
  // `openPaywall` is also what the shared-style sheet falls back to once a free
  // user has spent their imports.
  const { isOpen: paywallIsOpen, openPaywall } = usePaywall();
  const paywallShownThisSession = useRef(false);
  useEffect(() => {
    if (paywallIsOpen) paywallShownThisSession.current = true;
  }, [paywallIsOpen]);

  // Track if user has dismissed the prompt this session
  const hasUserDismissedPrompt = useRef(false);

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

  // Count a finished workout. The completion screen is the one place that can
  // only mean a round actually ended; the ref stops re-renders of that screen
  // from counting the same workout more than once.
  const countedCompletionRef = useRef(false);
  useEffect(() => {
    if (page !== "completed") {
      countedCompletionRef.current = false;
      return;
    }
    if (countedCompletionRef.current) return;
    countedCompletionRef.current = true;
    recordCompletedWorkout();
  }, [page, recordCompletedWorkout]);

  // Show app install prompt based on user engagement (only for web visitors)
  useEffect(() => {
    // Don't show if already running as native app
    if (Capacitor.isNativePlatform()) return;

    // Never over a live round. `timeOnSite >= 120` is satisfied part-way
    // through a first workout, so without this the modal lands on top of the
    // callouts the visitor came to hear.
    if (isActive) return;

    // Not on the completion screen either. That moment already belongs to the
    // post-workout paywall, which on web is a store hand-off in its own right.
    if (page === "completed") return;
    if (paywallShownThisSession.current) return;

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
  }, [
    userEngagement,
    shouldShowPrompt,
    showPWAPrompt,
    setShowPWAPrompt,
    onboarding,
    isActive,
    page,
  ]);

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

  // Every page's back button lands on the timer, and should land on the part
  // of it the user left — the style grid is long enough that arriving at the
  // top means hunting for your place again.
  const backToTimer = useCallback(() => {
    restoreOnNextPage(pageScrollKey("timer"));
    setPage("timer");
  }, [setPage]);

  const renderPageContent = () => {
    switch (page) {
      case "logs":
        return (
          <WorkoutLogs
            onBack={backToTimer}
            emphasisList={emphasisList}
            onResume={resumeWorkout}
            onViewCompletion={(log) => {
              setCompletionFromLogs(true);
              viewCompletionScreen(log);
            }}
          />
        );

      case "editor":
        return (
          <TechniqueEditorAny
            techniques={techniques}
            setTechniques={persistTechniques}
            onBack={backToTimer}
          />
        );

      case "learn":
        return <LearnSection onBack={backToTimer} />;

      case "roadmap":
        return <RoadmapSection onBack={backToTimer} />;

      case "completed":
        if (!lastWorkout) return null;
        return (
          <WorkoutCompleted
            stats={lastWorkout}
            onRestart={() => restartSession(lastWorkout)}
            onReset={() => setPage("timer")}
            onViewLog={() => setPage("logs")}
            onBack={completionFromLogs ? () => setPage("logs") : undefined}
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
                upNext={upNext ?? planUpNext}
                activeStyleKeys={activeStyleKeys}
                roundNote={roundNote}
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

      {/* Outgoing shares: one Pro gate and one name prompt for every button
          that can share, wherever it lives. */}
      <ShareStyleFlow />

      <ImportStyleModal
        incoming={incomingShare}
        isPro={isPro}
        onImport={handleImportSharedStyle}
        onUnlockPro={() => {
          dismissIncomingShare();
          openPaywall("shared_style_import");
        }}
        onDismiss={dismissIncomingShare}
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
        // Not during a live session: leaving mid-round should take a
        // deliberate Stop, not a stray tap on the way to the pause button.
        menu={
          isActive ? null : (
            <AppMenu
              page={page}
              onNavigate={(next) => {
                setPage(next);
                scrollContentToTop();
              }}
              onHelp={onboarding.openOnboarding}
              streak={homePageStats?.current ?? 0}
            />
          )
        }
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
