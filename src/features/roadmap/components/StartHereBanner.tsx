import { useCallback, useMemo, useState } from "react";

import { useUIContext } from "@/features/shared";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { scrollContentToTop } from "@/utils/scroll";

import { FOUNDATIONS, coreLevels, cumulativeSingles, totalTechniqueCount } from "../data/paths";
import {
  dismissBanner,
  hasGraduated,
  isBannerDismissed,
  nextLevelId,
  readPathProgress,
} from "../storage";
import "./RoadmapSection.css";

/**
 * The "Start Here" card at the top of the setup screen.
 *
 * Deliberately a *continue* card, not a promotion: it is styled like the app's
 * own panels and leads with progress, because a card that shows where you are
 * reads as part of the app, while a saturated pink box with a call to action
 * reads as an advert for it. It sits above everything else on the page, which
 * is where this pattern lives in every app that bolts a beginner course onto a
 * free-form tool.
 *
 * It disappears on graduation, and can be hidden for good — a fighter who
 * already knows a teep from a switch kick should not be nagged forever. The
 * roadmap screen can bring it back, and the action-row card below the style
 * grid is always there regardless.
 */
export function StartHereBanner() {
  const { setPage, statsRefreshTrigger } = useUIContext();
  const [dismissed, setDismissed] = useState(() => isBannerDismissed());

  const state = useMemo(
    () => {
      const progress = readPathProgress(FOUNDATIONS.id);
      const lastCore = coreLevels(FOUNDATIONS).slice(-1)[0]?.id ?? 0;
      const cleared = Math.min(progress.highestCleared, lastCore);
      return {
        started: progress.highestCleared > 0,
        next: nextLevelId(FOUNDATIONS),
        graduated: hasGraduated(FOUNDATIONS),
        known: cleared > 0 ? cumulativeSingles(FOUNDATIONS, cleared).length : 0,
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

  const total = totalTechniqueCount(FOUNDATIONS);
  const totalLevels = coreLevels(FOUNDATIONS).length;
  const pct = Math.round((state.known / total) * 100);

  return (
    <section className="starthere" aria-label="Start Here guided path">
      <button
        type="button"
        className="starthere-dismiss"
        onClick={hide}
        aria-label="Hide Start Here from the home screen"
        title="Hide from home screen"
      >
        ✕
      </button>

      <button type="button" className="starthere-body" onClick={open}>
        <span className="starthere-eyebrow">
          {state.started ? "Start Here · in progress" : "New to Muay Thai?"}
        </span>

        <span className="starthere-headline">
          {state.started
            ? `Level ${level.id} · ${level.title}`
            : "Start Here — a guided path"}
        </span>

        <span className="starthere-sub">
          {state.started
            ? `${state.known} of ${total} callouts learned`
            : "Ten levels that teach the strikes a few at a time. First level free."}
        </span>

        {state.started && (
          <span className="starthere-track" aria-hidden="true">
            <span className="starthere-fill" style={{ width: `${pct}%` }} />
          </span>
        )}

        <span className="starthere-action">
          {state.started
            ? `Continue · level ${level.id} of ${totalLevels}`
            : "Begin level 1"}
          <span aria-hidden="true"> →</span>
        </span>
      </button>
    </section>
  );
}

export default StartHereBanner;
