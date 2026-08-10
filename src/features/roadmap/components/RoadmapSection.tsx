import { useCallback, useMemo, useState } from "react";

import { useEntitlement } from "@/features/entitlement";
import { getEntryForCallout } from "@/features/learn";
import { usePaywall } from "@/features/paywall";
import { useUIContext } from "@/features/shared";
import { useWorkoutContext } from "@/features/workout";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { scrollContentToTop } from "@/utils/scroll";

import {
  FOUNDATIONS,
  combosForLevel,
  coreLevels,
  cumulativeSingles,
  totalTechniqueCount,
  type RoadmapLevel,
} from "../data/paths";
import {
  roundDescription,
  roundKind,
  roundTitle,
} from "../session";
import {
  clearedCount,
  hasGraduated,
  isBannerDismissed,
  isLevelCleared,
  isLevelUnlocked,
  nextLevelId,
  readPathProgress,
  restoreBanner,
} from "../storage";
import "./RoadmapSection.css";

type View = { mode: "ladder" } | { mode: "level"; levelId: number };

interface RoadmapSectionProps {
  /** Leave the roadmap entirely (back to the timer). */
  onBack: () => void;
}

type LevelState = "cleared" | "current" | "locked" | "pro";

export function RoadmapSection({ onBack }: RoadmapSectionProps) {
  const { isPro } = useEntitlement();
  const { openPaywall } = usePaywall();
  const { statsRefreshTrigger } = useUIContext();
  const { startRoadmapLevel } = useWorkoutContext();

  const [view, setView] = useState<View>({ mode: "ladder" });

  const path = FOUNDATIONS;

  // Progress is re-read whenever a workout completes, which is what the stats
  // trigger already signals — the ladder must repaint after clearing a level.
  const progress = useMemo(
    () => ({
      pathProgress: readPathProgress(path.id),
      next: nextLevelId(path),
      cleared: clearedCount(path.id),
      graduated: hasGraduated(path),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, statsRefreshTrigger, view]
  );

  const stateFor = useCallback(
    (level: RoadmapLevel): LevelState => {
      if (isLevelCleared(path.id, level.id)) return "cleared";
      if (!isLevelUnlocked(path.id, level.id)) return "locked";
      if (!isPro && !level.free) return "pro";
      return "current";
    },
    [path.id, isPro]
  );

  const openLevel = useCallback(
    (level: RoadmapLevel) => {
      const state = stateFor(level);
      if (state === "pro") {
        openPaywall("roadmap_level");
        return;
      }
      if (state === "locked") return;
      setView({ mode: "level", levelId: level.id });
      scrollContentToTop("auto");
    },
    [stateFor, openPaywall]
  );

  const goBack = useCallback(() => {
    if (view.mode === "level") {
      setView({ mode: "ladder" });
      scrollContentToTop("auto");
      return;
    }
    onBack();
  }, [view, onBack]);

  const beginLevel = useCallback(
    (level: RoadmapLevel) => {
      startRoadmapLevel(path, level);
    },
    [startRoadmapLevel, path]
  );

  const level =
    view.mode === "level"
      ? path.levels.find((l) => l.id === view.levelId)
      : undefined;

  return (
    <div className="roadmap">
      <div className="roadmap-header">
        <button className="roadmap-back" onClick={goBack}>
          ← Back
        </button>
        {!isPro && <span className="roadmap-pro-chip">Pro</span>}
      </div>

      {view.mode === "ladder" && (
        <Ladder
          isPro={isPro}
          taught={taughtCount(progress.pathProgress.highestCleared)}
          nextLevelId={progress.next}
          graduated={progress.graduated}
          stateFor={stateFor}
          onOpenLevel={openLevel}
          onUnlock={() => openPaywall("roadmap_header")}
        />
      )}

      {view.mode === "level" && level && (
        <LevelDetail
          level={level}
          cleared={isLevelCleared(path.id, level.id)}
          onStart={() => beginLevel(level)}
        />
      )}
    </div>
  );
}

/**
 * Techniques known after clearing everything up to and including `levelId`.
 * Capped at the last core level: the bonus elbows are not part of the Nak Muay
 * Newb vocabulary the progress bar measures, so clearing them must not push the
 * count past its own total.
 */
function taughtCount(levelId: number): number {
  const core = coreLevels(FOUNDATIONS);
  const lastCore = core[core.length - 1]?.id ?? 0;
  const capped = Math.min(levelId, lastCore);
  if (capped < 1) return 0;
  return cumulativeSingles(FOUNDATIONS, capped).length;
}

// ------------------------------------------------------------------ ladder --

function Ladder({
  isPro,
  taught,
  nextLevelId: next,
  graduated,
  stateFor,
  onOpenLevel,
  onUnlock,
}: {
  isPro: boolean;
  taught: number;
  nextLevelId: number;
  graduated: boolean;
  stateFor: (level: RoadmapLevel) => LevelState;
  onOpenLevel: (level: RoadmapLevel) => void;
  onUnlock: () => void;
}) {
  const path = FOUNDATIONS;
  const total = totalTechniqueCount(path);
  const core = coreLevels(path);

  return (
    <>
      <h1 className="roadmap-title">Start Here</h1>
      <p className="roadmap-subtitle">{path.subtitle}</p>

      <div className="roadmap-progress" role="status">
        <div className="roadmap-progress-row">
          <span className="roadmap-progress-label">
            {graduated
              ? "You answer to every callout in Nak Muay Newb."
              : `You answer to ${taught} of ${total} callouts.`}
          </span>
          <span className="roadmap-progress-count">
            {taught}/{total}
          </span>
        </div>
        <div className="roadmap-progress-track">
          <span
            className="roadmap-progress-fill"
            style={{ width: `${Math.round((taught / total) * 100)}%` }}
          />
        </div>
      </div>

      {!isPro && (
        <button className="roadmap-unlock-banner" onClick={onUnlock}>
          <span className="roadmap-unlock-title">
            🔒 Level 1 is free — the rest of the path is Pro
          </span>
          <span className="roadmap-unlock-body">
            Train the first level as many times as you like. Unlock Pro to carry
            on through all {core.length} levels and the bonus round.
          </span>
        </button>
      )}

      <ol className="roadmap-ladder">
        {path.levels.map((level, index) => {
          const state = stateFor(level);
          const isNext = level.id === next && state !== "cleared";
          const showGraduation = level.bonus && !path.levels[index - 1]?.bonus;

          return (
            <li key={level.id}>
              {showGraduation && (
                <p className="roadmap-graduation">
                  <span>Graduation</span> — everything past here is a bonus.
                </p>
              )}
              <button
                className={`roadmap-rung roadmap-rung--${state}${
                  isNext ? " roadmap-rung--next" : ""
                }`}
                onClick={() => onOpenLevel(level)}
                disabled={state === "locked"}
                aria-label={
                  state === "pro"
                    ? `Unlock level ${level.id}, ${level.title}, with Pro`
                    : `Level ${level.id}: ${level.title}`
                }
              >
                <span className="roadmap-rung-badge" aria-hidden="true">
                  {state === "cleared"
                    ? "✓"
                    : state === "locked"
                    ? "🔒"
                    : state === "pro"
                    ? "🔒"
                    : level.id}
                </span>
                <span className="roadmap-rung-text">
                  <span className="roadmap-rung-title">
                    {level.bonus ? "Bonus: " : `Level ${level.id} · `}
                    {level.bonus ? level.title.replace(/^Bonus: /, "") : level.title}
                    {isNext && <span className="roadmap-rung-next">Next</span>}
                  </span>
                  <span className="roadmap-rung-teaches">
                    {level.introduces.join(" · ")}
                  </span>
                </span>
                <span className="roadmap-rung-chevron" aria-hidden="true">
                  {state === "locked" ? "" : state === "pro" ? "🔒" : "›"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <RestoreCardToggle />
    </>
  );
}

/**
 * Hiding the home-screen card is permanent, so this is the way back. Only
 * shown when it is actually hidden — otherwise it is a control for a state
 * you are already in.
 */
function RestoreCardToggle() {
  const [hidden, setHidden] = useState(() => isBannerDismissed());
  const [justRestored, setJustRestored] = useState(false);

  // Stay mounted after restoring so the confirmation is actually seen —
  // otherwise the control vanishes the instant it succeeds.
  if (!hidden && !justRestored) return null;

  return (
    <button
      type="button"
      className="roadmap-restore"
      disabled={justRestored}
      onClick={() => {
        restoreBanner();
        setHidden(false);
        setJustRestored(true);
      }}
    >
      {justRestored ? (
        <span className="roadmap-restore-done">✓ Back on your home screen</span>
      ) : (
        <span>↩ Show Start Here on my home screen again</span>
      )}
    </button>
  );
}

// ------------------------------------------------------------------ detail --

function LevelDetail({
  level,
  cleared,
  onStart,
}: {
  level: RoadmapLevel;
  cleared: boolean;
  onStart: () => void;
}) {
  const path = FOUNDATIONS;
  const combos = combosForLevel(path, level);
  const known = cumulativeSingles(path, level.id).length;

  // Every introduced callout resolves to a written lesson — roadmapCoverage
  // fails the build otherwise — so these cards need no content of their own.
  const lessons = level.introduces.map((technique) => ({
    technique,
    entry: getEntryForCallout(technique),
  }));

  return (
    <article className="roadmap-detail">
      <p className="roadmap-detail-eyebrow">
        {level.bonus
          ? "Bonus level"
          : `Level ${level.id} of ${coreLevels(path).length}`}
        {cleared && <span className="roadmap-detail-cleared">Cleared</span>}
      </p>
      <h1 className="roadmap-title">
        {level.title.replace(/^Bonus: /, "")}
      </h1>
      <p className="roadmap-subtitle">{level.blurb}</p>

      <section className="roadmap-panel">
        <h2 className="roadmap-panel-title">New this level</h2>
        <div className="roadmap-cards">
          {lessons.map(({ technique, entry }) => (
            <div className="roadmap-card" key={technique}>
              <div className="roadmap-card-head">
                <span className="roadmap-card-name">
                  {entry?.name ?? technique}
                </span>
                {entry?.numbering && (
                  <span className="roadmap-card-number">{entry.numbering}</span>
                )}
                {entry?.thai && (
                  <span className="roadmap-card-thai">{entry.thai}</span>
                )}
              </div>
              {entry && (
                <>
                  <p className="roadmap-card-summary">{entry.summary}</p>
                  <ul className="roadmap-card-list">
                    {entry.keyPoints.slice(0, 3).map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  {entry.mistakes[0] && (
                    <p className="roadmap-card-mistake">
                      <strong>Watch out:</strong> {entry.mistakes[0]}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {level.languageNote && (
        <section className="roadmap-panel roadmap-panel--note">
          <h2 className="roadmap-panel-title">Speaking the language</h2>
          <p className="roadmap-note">{level.languageNote}</p>
        </section>
      )}

      <section className="roadmap-panel">
        <h2 className="roadmap-panel-title">The session</h2>
        <ol className="roadmap-rounds">
          {Array.from({ length: level.session.roundsCount }, (_, i) => i + 1).map(
            (round) => (
              <li className="roadmap-round" key={round}>
                <span className="roadmap-round-n">Round {round}</span>
                <span className="roadmap-round-title">{roundTitle(round)}</span>
                <span className="roadmap-round-desc">
                  {roundDescription(round)}
                </span>
                {roundKind(round) === "integrate" && (
                  <span className="roadmap-round-meta">
                    {known} technique{known === 1 ? "" : "s"} in the mix
                  </span>
                )}
                {roundKind(round) === "combos" && (
                  <span className="roadmap-round-meta">
                    {combos.slice(0, 3).join(" · ")}
                  </span>
                )}
              </li>
            )
          )}
        </ol>
        <p className="roadmap-session-meta">
          {level.session.roundsCount} rounds ·{" "}
          {level.session.roundMin} min each · {level.session.restMinutes} min
          rest
        </p>
      </section>

      <button className="roadmap-start" onClick={onStart}>
        {cleared ? "Train it again" : "Start the level"}
      </button>
      <p className="roadmap-start-hint">
        Hands up and eyes off the screen — the app calls every technique out
        loud.
      </p>
    </article>
  );
}

export default RoadmapSection;
