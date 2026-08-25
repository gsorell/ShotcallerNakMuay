import { useCallback, useMemo, useState } from "react";

import { ImageWithFallback, useUIContext } from "@/features/shared";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { scrollContentToTop } from "@/utils/scroll";

import { artworkForLevel } from "../artwork";
import { FOUNDATIONS } from "../data/paths";
import { dismissBanner, isBannerDismissed, pathSummary } from "../storage";
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
interface StartHereBannerProps {
  /**
   * Where tapping it goes. Defaults to the roadmap page; the Learn section
   * passes its own handler so the ladder opens as a view inside that page and
   * Back returns there rather than dropping the user on the timer.
   */
  onOpen?: () => void;
  /**
   * Where "browse the library" goes. Omitted inside Learn, which IS the
   * library — the link only exists to make the relationship reciprocal from
   * the home screen, since Learn has always linked back to the path.
   */
  onBrowse?: () => void;
  /** Offer the ✕. The home screen does; inside Learn there is nothing to hide from. */
  dismissible?: boolean;
  /**
   * Disappear once the path is finished. True on the home screen, where a
   * graduate has no more use for it — but false inside Learn, where replaying
   * a level is a normal thing to come looking for.
   */
  hideWhenGraduated?: boolean;
  source?: string;
}

export function StartHereBanner({
  onOpen,
  onBrowse,
  dismissible = true,
  hideWhenGraduated = true,
  source = "setup_banner",
}: StartHereBannerProps = {}) {
  const { setPage, statsRefreshTrigger } = useUIContext();
  const [dismissed, setDismissed] = useState(() => isBannerDismissed());

  // Recomputed whenever a workout completes — that is what the stats trigger
  // signals — so the card is showing the level you are actually on.
  const summary = useMemo(
    () => pathSummary(FOUNDATIONS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statsRefreshTrigger]
  );

  const open = useCallback(() => {
    trackEvent(AnalyticsEvents.RoadmapOpen, { source });
    if (onOpen) {
      onOpen();
      return;
    }
    setPage("roadmap");
    scrollContentToTop();
  }, [setPage, onOpen, source]);

  const hide = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dismissBanner();
    setDismissed(true);
  }, []);

  if (dismissible && dismissed) return null;
  if (hideWhenGraduated && summary.graduated) return null;

  const level = FOUNDATIONS.levels.find((l) => l.id === summary.nextLevelId);
  if (!level) return null;

  return (
    <section className="starthere" aria-label="Start Here guided path">
      {dismissible && (
        <button
          type="button"
          className="starthere-dismiss"
          onClick={hide}
          aria-label="Hide Start Here from the home screen"
          title="Hide from home screen"
        >
          ✕
        </button>
      )}

      <button type="button" className="starthere-body" onClick={open}>
        <ImageWithFallback
          srcPath={artworkForLevel(level).iconPath}
          alt=""
          emoji={artworkForLevel(level).icon}
          className="starthere-art"
        />
        <span className="starthere-text">
          <span className="starthere-eyebrow">
            {summary.graduated
              ? "Start Here · complete"
              : summary.started
              ? `Start Here · level ${level.id} of ${summary.totalLevels}`
              : "New to Muay Thai?"}
          </span>

          <span className="starthere-headline">
            {summary.graduated
              ? "You finished the path"
              : summary.started
              ? `${level.bonus ? "Bonus" : "Level " + level.id} · ${level.title.replace(/^Bonus: /, "")}`
              : "Start Here — a guided path"}
          </span>

          <span className="starthere-sub">
            {summary.started
              ? `${summary.known} of ${summary.total} callouts learned`
              : "Ten levels that teach the strikes a few at a time. First level free."}
          </span>

          {summary.started && (
            <span className="starthere-track" aria-hidden="true">
              <span
                className="starthere-fill"
                style={{ width: `${summary.percent}%` }}
              />
            </span>
          )}

          <span className="starthere-action">
            {summary.graduated
              ? "Replay any level"
              : summary.started
              ? "Continue"
              : "Begin level 1"}
            <span aria-hidden="true"> →</span>
          </span>
        </span>
      </button>

      {/* Outside the body button, because a link inside a button is not a
          thing. The path and the library are two ways into the same material,
          and until now only one direction was navigable. */}
      {onBrowse && (
        <button type="button" className="starthere-browse" onClick={onBrowse}>
          Or browse the technique library
          <span aria-hidden="true"> →</span>
        </button>
      )}
    </section>
  );
}

export default StartHereBanner;
