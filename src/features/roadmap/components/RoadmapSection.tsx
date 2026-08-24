import { useCallback, useEffect, useMemo, useState } from "react";

import { useEntitlement } from "@/features/entitlement";
// The data module, not the Learn barrel: LearnSection hosts this component, and
// going through the barrel would make the two features a circular import.
import { getEntryForCallout } from "@/features/learn/data/techniqueIndex";
// Direct path rather than the Learn barrel, for the same reason as above.
import { TechniqueSprite } from "@/features/learn/components/TechniqueSprite";
import { usePaywall } from "@/features/paywall";
import { ImageWithFallback, useUIContext } from "@/features/shared";
import { useWorkoutContext } from "@/features/workout";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { scrollContentToTop } from "@/utils/scroll";

import {
  FOUNDATIONS,
  coreLevels,
  cumulativeSingles,
  totalTechniqueCount,
  type RoadmapLevel,
} from "../data/paths";
import { artworkForLevel } from "../artwork";
import {
  formatRest,
  poolForRound,
  poolPreview,
  roundDescription,
  roundKind,
  roundTitle,
} from "../session";
import {
  isBannerDismissed,
  isLevelCleared,
  isLevelUnlocked,
  pathSummary,
  restoreBanner,
  type PathSummary,
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
  const { statsRefreshTrigger, roadmapFocusLevel, setRoadmapFocusLevel } =
    useUIContext();
  const { startRoadmapLevel } = useWorkoutContext();

  // Opening straight to a level rather than the ladder — quitting a guided
  // round sends you back to the level you were on, not to the top of the path.
  // Read once, on mount, and cleared immediately so returning to the ladder
  // later does not bounce you into the level again.
  const [view, setView] = useState<View>(() =>
    roadmapFocusLevel
      ? { mode: "level", levelId: roadmapFocusLevel }
      : { mode: "ladder" }
  );

  useEffect(() => {
    if (roadmapFocusLevel !== null) setRoadmapFocusLevel(null);
  }, [roadmapFocusLevel, setRoadmapFocusLevel]);

  const path = FOUNDATIONS;

  // Progress is re-read whenever a workout completes, which is what the stats
  // trigger already signals — the ladder must repaint after clearing a level.
  const summary = useMemo(
    () => pathSummary(path),
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
          summary={summary}
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

// ------------------------------------------------------------------ ladder --

function Ladder({
  isPro,
  summary,
  stateFor,
  onOpenLevel,
  onUnlock,
}: {
  isPro: boolean;
  summary: PathSummary;
  stateFor: (level: RoadmapLevel) => LevelState;
  onOpenLevel: (level: RoadmapLevel) => void;
  onUnlock: () => void;
}) {
  const path = FOUNDATIONS;
  const { known: taught, total, graduated, nextLevelId: next } = summary;
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
            style={{ width: `${summary.percent}%` }}
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
                  <ImageWithFallback
                    srcPath={artworkForLevel(level).iconPath}
                    alt=""
                    emoji={artworkForLevel(level).icon}
                    className="roadmap-rung-art"
                  />
                  {state === "cleared" && (
                    <span className="roadmap-rung-state roadmap-rung-state--done">
                      ✓
                    </span>
                  )}
                  {(state === "locked" || state === "pro") && (
                    <span className="roadmap-rung-state roadmap-rung-state--locked">
                      🔒
                    </span>
                  )}
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
  const known = cumulativeSingles(path, level.id).length;

  // Which cards are open. A Set rather than a single id because the cards are
  // independent — comparing two techniques on one level means having both
  // open at once, which the native <details> this replaced also allowed.
  const [openCards, setOpenCards] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const toggleCard = useCallback((key: string) => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);
  const rounds = Array.from(
    { length: level.session.roundsCount },
    (_, i) => i + 1
  );

  // Every introduced callout resolves to a written lesson — roadmapCoverage
  // fails the build otherwise — so these cards need no content of their own.
  //
  // Grouped by lesson, because several callouts share one. "Left Teep" and
  // "Right Teep" are both the teep, and all four body punches are one lesson —
  // listing them per callout printed the same card twice on most levels and
  // four times on level 9. The callouts are named on the card instead, which is
  // the part that actually differs.
  const lessons = useMemo(() => {
    const byLesson = new Map<
      string,
      { entry: ReturnType<typeof getEntryForCallout>; callouts: string[] }
    >();
    for (const technique of level.introduces) {
      const entry = getEntryForCallout(technique);
      const key = entry?.slug ?? technique;
      const existing = byLesson.get(key);
      if (existing) existing.callouts.push(technique);
      else byLesson.set(key, { entry, callouts: [technique] });
    }
    return [...byLesson.values()];
  }, [level]);

  return (
    <article className="roadmap-detail">
      <div className="roadmap-detail-head">
        <ImageWithFallback
          srcPath={artworkForLevel(level).iconPath}
          alt=""
          emoji={artworkForLevel(level).icon}
          className="roadmap-detail-art"
        />
        <div className="roadmap-detail-headtext">
          <p className="roadmap-detail-eyebrow">
            {level.bonus
              ? "Bonus level"
              : `Level ${level.id} of ${coreLevels(path).length}`}
            {cleared && <span className="roadmap-detail-cleared">Cleared</span>}
          </p>
          <h1 className="roadmap-title roadmap-title--inline">
            {level.title.replace(/^Bonus: /, "")}
          </h1>
        </div>
      </div>
      <p className="roadmap-subtitle">{level.blurb}</p>

      <section className="roadmap-panel">
        <h2 className="roadmap-panel-title">New this level</h2>
        <div className="roadmap-cards">
          {/* The silhouette rides in the closed row, so the list shows what
              every technique looks like without being opened — that is the
              whole point of having shot them. The written lesson stays behind
              the disclosure: it is reference material, read once while
              learning the movement, and an essay per technique would bury the
              list of what is new under it.

              Not <details> any more. The figure has to be visible while the
              card is shut, and <details> hides everything that is not the
              <summary>. A button with aria-expanded says the same thing to a
              screen reader; the whole row stays the target because the click
              handler sits on the card, and the copy stops the event so
              selecting text does not collapse what you are reading. */}
          {lessons.map(({ callouts, entry }) => {
            const key = callouts[0];
            const open = openCards.has(key);
            const bodyId = `roadmap-card-${level.id}-${key.replace(/\s+/g, "-").toLowerCase()}`;

            return (
              <div
                className={`roadmap-card${open ? " roadmap-card--open" : ""}${
                  entry ? "" : " roadmap-card--bare"
                }`}
                key={key}
                onClick={entry ? () => toggleCard(key) : undefined}
              >
                <button
                  type="button"
                  className="roadmap-card-head"
                  aria-expanded={open}
                  aria-controls={entry ? bodyId : undefined}
                  disabled={!entry}
                >
                  <span className="roadmap-card-name">
                    {entry?.name ?? callouts[0]}
                  </span>
                  {entry?.numbering && (
                    <span className="roadmap-card-number">
                      {entry.numbering}
                    </span>
                  )}
                  {entry?.thai && (
                    <span className="roadmap-card-thai">{entry.thai}</span>
                  )}
                </button>

                {/* Nothing renders for a lesson with no sheet, and the row
                    simply has no figure in it. Click-through, so the figure is
                    part of the same target as the name behind it. */}
                {entry && <TechniqueSprite slug={entry.slug} name={entry.name} />}

                {entry && (
                  <div
                    className="roadmap-card-copy"
                    id={bodyId}
                    hidden={!open}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {callouts.length > 1 && (
                      <p className="roadmap-card-callouts">
                        Called as {callouts.join(" · ")}
                      </p>
                    )}
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {level.languageNote && (
        <section className="roadmap-panel roadmap-panel--note">
          <h2 className="roadmap-panel-title">Speaking the language</h2>
          <p className="roadmap-note">{level.languageNote}</p>
        </section>
      )}

      <section className="roadmap-panel">
        <details className="roadmap-more roadmap-more--session">
          <summary>
            <span className="roadmap-panel-title">The session</span>
            <span className="roadmap-session-meta">
              {level.session.roundsCount} rounds · {level.session.roundMin} min
              each · {formatRest(level.session.restMinutes)}
            </span>
          </summary>
          <ol className="roadmap-rounds">
            {rounds.map((round) => (
              <li className="roadmap-round" key={round}>
                <span className="roadmap-round-n">Round {round}</span>
                <span className="roadmap-round-title">{roundTitle(round)}</span>
                <span className="roadmap-round-desc">
                  {roundDescription(path, level, round)}
                </span>
                {roundKind(round) === "integrate" && (
                  <span className="roadmap-round-meta">
                    {known} technique{known === 1 ? "" : "s"} in the mix
                  </span>
                )}
                {roundKind(round) === "combos" && (
                  <span className="roadmap-round-meta">
                    {poolPreview(
                      poolForRound(path, level, round).map((t) => t.text)
                    ).join(" · ")}
                  </span>
                )}
              </li>
            ))}
          </ol>
          <p className="roadmap-session-meta">
            Every round starts at novice pace and builds towards amateur by the
            bell.
          </p>
        </details>
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
