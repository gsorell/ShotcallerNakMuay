import { useCallback, useMemo, useState } from "react";

import { useUIContext } from "@/features/shared";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { scrollContentToTop } from "@/utils/scroll";

import { FOUNDATIONS, coreLevels } from "../data/paths";
import {
  dismissBanner,
  hasGraduated,
  isBannerDismissed,
  nextLevelId,
  readPathProgress,
} from "../storage";
import "./RoadmapSection.css";

/**
 * The "Start Here" prompt on the setup screen. It is the on-ramp for someone
 * who opened the app and met nineteen style tiles with no idea which to pick.
 *
 * It hides itself once the path is finished, and can be dismissed permanently —
 * a fighter who already knows the difference between a teep and a switch kick
 * should not be nagged by a beginner path forever. The action-row card below
 * the style grid remains the permanent way in.
 */
export function StartHereBanner() {
  const { setPage, statsRefreshTrigger } = useUIContext();
  const [dismissed, setDismissed] = useState(() => isBannerDismissed());

  const state = useMemo(
    () => {
      const progress = readPathProgress(FOUNDATIONS.id);
      return {
        started: progress.highestCleared > 0,
        next: nextLevelId(FOUNDATIONS),
        graduated: hasGraduated(FOUNDATIONS),
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statsRefreshTrigger]
  );

  const open = useCallback(() => {
    trackEvent(AnalyticsEvents.RoadmapOpen, { source: "setup_banner" });
    setPage("roadmap");
    scrollContentToTop();
  }, [setPage]);

  const hide = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dismissBanner();
    setDismissed(true);
  }, []);

  if (dismissed || state.graduated) return null;

  const level = FOUNDATIONS.levels.find((l) => l.id === state.next);
  if (!level) return null;

  const total = coreLevels(FOUNDATIONS).length;

  return (
    <div className="starthere-banner">
      <button
        type="button"
        className="starthere-main"
        onClick={open}
        aria-label={
          state.started
            ? `Continue Start Here at level ${level.id}, ${level.title}`
            : "Open the Start Here guided path"
        }
      >
        <span className="starthere-text">
          <span className="starthere-title">
            {state.started ? "Pick up where you left off" : "New to this? Start here."}
          </span>
          <span className="starthere-desc">
            {state.started
              ? `Level ${level.id} of ${total} · ${level.title}`
              : "A guided path that teaches the strikes a few at a time — first level free."}
          </span>
        </span>
        <span className="starthere-cta" aria-hidden="true">
          {state.started ? "Continue" : "Begin"}
        </span>
      </button>
      <button
        type="button"
        className="starthere-dismiss"
        onClick={hide}
        aria-label="Hide the Start Here prompt"
      >
        ✕
      </button>
    </div>
  );
}

export default StartHereBanner;
