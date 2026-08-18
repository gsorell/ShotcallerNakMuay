import { useCallback } from "react";

import { useEntitlement } from "@/features/entitlement";
import { usePaywall } from "@/features/paywall";
import { useUIContext } from "@/features/shared";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { scrollContentToTop } from "@/utils/scroll";

import { artworkForLevel } from "../artwork";
import { getLevel, getPath } from "../data/paths";
import { ImageWithFallback } from "@/features/shared";
import "./RoadmapSection.css";

interface NextLevelPromptProps {
  /** The guided level that was just finished. */
  completed: { pathId: string; levelId: number };
}

/**
 * The way onward after finishing a level.
 *
 * Without this the path dead-ends on the completion screen: you have just
 * cleared level 3 and the only way to level 4 is back to the home screen, into
 * Learn, into the ladder. Someone in the middle of a session has momentum, and
 * this is the one moment they are most likely to do another — so the next level
 * should be a button, not a scavenger hunt.
 */
export function NextLevelPrompt({ completed }: NextLevelPromptProps) {
  const { isPro } = useEntitlement();
  const { openPaywall } = usePaywall();
  const { setPage, setRoadmapFocusLevel } = useUIContext();

  const path = getPath(completed.pathId);
  const next = getLevel(completed.pathId, completed.levelId + 1);
  const locked = Boolean(next && !isPro && !next.free);

  // Opens the next level's start screen — it does NOT begin the session. Every
  // level introduces techniques you have not thrown yet, and its start screen is
  // where they are named and explained; dropping someone straight into a timer
  // calling "Long Guard" at them is the one thing the guided path exists to
  // avoid. Starting is then the same deliberate tap it is everywhere else.
  const go = useCallback(() => {
    if (!path || !next) return;
    if (locked) {
      openPaywall("roadmap_next_level");
      return;
    }
    trackEvent(AnalyticsEvents.RoadmapOpen, { source: "next_level_prompt" });
    setRoadmapFocusLevel(next.id);
    setPage("roadmap");
    scrollContentToTop();
  }, [path, next, locked, openPaywall, setRoadmapFocusLevel, setPage]);

  const openLadder = useCallback(() => {
    trackEvent(AnalyticsEvents.RoadmapOpen, { source: "workout_complete" });
    setPage("roadmap");
    scrollContentToTop();
  }, [setPage]);

  // Past the last level there is nowhere onward — offer the ladder instead, so
  // replaying or picking up the bonus level is still one tap.
  if (!path || !next) {
    return (
      <button type="button" className="nextlevel nextlevel--done" onClick={openLadder}>
        <span className="nextlevel-text">
          <span className="nextlevel-eyebrow">Path complete</span>
          <span className="nextlevel-title">Back to the ladder</span>
          <span className="nextlevel-sub">Replay any level, any time.</span>
        </span>
        <span className="nextlevel-go" aria-hidden="true">→</span>
      </button>
    );
  }

  const art = artworkForLevel(next);

  return (
    <div className="nextlevel-wrap">
      <button type="button" className="nextlevel" onClick={go}>
        <ImageWithFallback
          srcPath={art.iconPath}
          alt=""
          emoji={art.icon}
          className="nextlevel-art"
        />
        <span className="nextlevel-text">
          <span className="nextlevel-eyebrow">
            {locked ? "Next up · Pro" : "Next up"}
          </span>
          <span className="nextlevel-title">
            {next.bonus ? "Bonus" : `Level ${next.id}`} ·{" "}
            {next.title.replace(/^Bonus: /, "")}
          </span>
          <span className="nextlevel-sub">
            {next.introduces.join(" · ")}
          </span>
        </span>
        <span className="nextlevel-go" aria-hidden="true">
          {locked ? "🔒" : "→"}
        </span>
      </button>
      <button type="button" className="nextlevel-secondary" onClick={openLadder}>
        See the whole path
      </button>
    </div>
  );
}

export default NextLevelPrompt;
