import React, { createContext, useCallback, useContext, useState } from "react";
import type { Page } from "@/types";

// Context for UI state (navigation, modals, etc.)
interface UIContextValue {
  // Navigation
  page: Page;
  setPage: (page: Page) => void;

  // Modals
  showOnboardingMsg: boolean;
  setShowOnboardingMsg: (show: boolean) => void;
  showPWAPrompt: boolean;
  setShowPWAPrompt: (show: boolean) => void;
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
  showAllEmphases: boolean;
  setShowAllEmphases: React.Dispatch<React.SetStateAction<boolean>>;

  // Last workout
  lastWorkout: any;
  setLastWorkout: (workout: any) => void;

  // Stats refresh
  statsRefreshTrigger: number;
  triggerStatsRefresh: () => void;

  // Deep-link target for the technique editor (group key to expand & scroll to)
  editorFocusKey: string | null;
  setEditorFocusKey: (key: string | null) => void;

  /**
   * Deep-link target for the roadmap (level id to open straight to). Set when
   * something outside the roadmap needs to drop the user on a specific level —
   * quitting a guided round, for instance. Cleared by the roadmap once used.
   */
  roadmapFocusLevel: number | null;
  setRoadmapFocusLevel: (levelId: number | null) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export const useUIContext = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUIContext must be used within UIProvider");
  }
  return context;
};

interface UIProviderProps {
  children: React.ReactNode;
}

export const UIProvider: React.FC<UIProviderProps> = ({ children }) => {
  // Navigation
  const [page, setPage] = useState<Page>("timer");

  // Modals
  const [showOnboardingMsg, setShowOnboardingMsg] = useState(false);
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAllEmphases, setShowAllEmphases] = useState(false);

  // Last workout
  const [lastWorkout, setLastWorkout] = useState<any>(null);

  // Stats refresh
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const triggerStatsRefresh = useCallback(() => {
    setStatsRefreshTrigger((prev) => prev + 1);
  }, []);

  // Deep-link target for the technique editor
  const [editorFocusKey, setEditorFocusKey] = useState<string | null>(null);

  // Deep-link target for the roadmap
  const [roadmapFocusLevel, setRoadmapFocusLevel] = useState<number | null>(
    null
  );

  const value: UIContextValue = {
    page,
    setPage,
    showOnboardingMsg,
    setShowOnboardingMsg,
    showPWAPrompt,
    setShowPWAPrompt,
    showAdvanced,
    setShowAdvanced,
    showAllEmphases,
    setShowAllEmphases,
    lastWorkout,
    setLastWorkout,
    statsRefreshTrigger,
    triggerStatsRefresh,
    editorFocusKey,
    setEditorFocusKey,
    roadmapFocusLevel,
    setRoadmapFocusLevel,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};
