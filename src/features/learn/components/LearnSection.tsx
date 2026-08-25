import { useCallback, useMemo, useState } from "react";

import { useEntitlement } from "@/features/entitlement";
import { usePaywall } from "@/features/paywall";
// Direct component imports rather than the roadmap barrel: the barrel pulls in
// modules that import this feature back.
import { RoadmapSection } from "@/features/roadmap/components/RoadmapSection";
import { StartHereBanner } from "@/features/roadmap/components/StartHereBanner";
import { FOUNDATIONS } from "@/features/roadmap/data/paths";
import { levelTeaching } from "@/features/roadmap/vocabulary";
import { useUIContext } from "@/features/shared";
import { useWorkoutContext } from "@/features/workout";
import { trackEvent } from "@/utils/analytics";
import { scrollContentToTop } from "@/utils/scroll";
import type { EmphasisKey } from "@/types";

import {
  getEntry,
  getStylesForEntry,
  isCalisthenicsOnly,
} from "../data/techniqueIndex";
import type { LearnEntry } from "../data/techniqueLibrary";
import { TechniqueSprite } from "./TechniqueSprite";
import { TechniqueGallery } from "./TechniqueGallery";
import "./LearnSection.css";

type View =
  | { mode: "categories" }
  | { mode: "detail"; slug: string }
  /** The guided path, hosted here rather than on its own page — see below. */
  | { mode: "path" };

interface LearnSectionProps {
  /** Leave the Learn section entirely (back to the timer). */
  onBack: () => void;
}

export function LearnSection({ onBack }: LearnSectionProps) {
  const { isPro } = useEntitlement();
  const { openPaywall } = usePaywall();
  const { setPage } = useUIContext();
  const { settings } = useWorkoutContext();

  const [view, setView] = useState<View>({ mode: "categories" });

  // Free users can browse the shelf — categories and technique names — so the
  // depth of what Pro buys is visible. Opening a lesson is where Pro starts.
  const openLesson = useCallback(
    (entry: LearnEntry) => {
      if (!isPro) {
        openPaywall("learn_lesson");
        return;
      }
      trackEvent("learn_lesson_open", { slug: entry.slug });
      setView({ mode: "detail", slug: entry.slug });
      scrollContentToTop("auto");
    },
    [isPro, openPaywall]
  );

  // Navigation is derived from the current view rather than computed inside a
  // setState updater — updaters must stay pure (StrictMode runs them twice,
  // which would fire onBack() twice and skip a level).
  const goBack = useCallback(() => {
    if (view.mode === "detail") {
      setView({ mode: "categories" });
    } else {
      onBack();
      return;
    }
    scrollContentToTop("auto");
  }, [view, onBack]);

  /**
   * Send the user to the timer with a style that drills this technique already
   * selected. Styles are cleared first so the round is focused on exactly the
   * thing they were just reading about.
   */
  const drillStyle = useCallback(
    (styleKey: string, slug: string) => {
      trackEvent("learn_drill_start", { slug, emphasis: styleKey });
      settings.clearAllEmphases();
      settings.toggleEmphasis(styleKey as EmphasisKey, "learn_drill");
      setPage("timer");
      scrollContentToTop("auto");
    },
    [settings, setPage]
  );

  // The guided path renders its own header and back button, so this page steps
  // out of the way entirely rather than stacking two of each.
  if (view.mode === "path") {
    return (
      <div className="learn">
        <RoadmapSection
          onBack={() => {
            setView({ mode: "categories" });
            scrollContentToTop("auto");
          }}
        />
      </div>
    );
  }

  return (
    <div className="learn">
      <div className="learn-header">
        <button className="learn-back" onClick={goBack}>
          ← Back
        </button>
        {!isPro && <span className="learn-pro-chip">Pro</span>}
      </div>

      {view.mode === "categories" && (
        <CategoryList
          isPro={isPro}
          onOpenLesson={openLesson}
          onOpenPath={() => {
            setView({ mode: "path" });
            scrollContentToTop("auto");
          }}
          onUnlock={() => openPaywall("learn_header")}
        />
      )}

      {view.mode === "detail" && (
        <LessonDetail
          slug={view.slug}
          onDrill={drillStyle}
          onOpenPath={() => {
            setView({ mode: "path" });
            scrollContentToTop("auto");
          }}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------- categories --

function CategoryList({
  isPro,
  onOpenLesson,
  onOpenPath,
  onUnlock,
}: {
  isPro: boolean;
  onOpenLesson: (entry: LearnEntry) => void;
  onOpenPath: () => void;
  onUnlock: () => void;
}) {
  return (
    <>
      <h1 className="learn-title">Learn</h1>
      <p className="learn-subtitle">
        A guided path if you are starting out, and every technique the app calls
        out if you just need to look something up.
      </p>

      {/* The path leads, because someone who does not know where to begin is
          the person least able to pick a category. It stays a card rather than
          the full ladder so the library underneath is still one scroll away —
          looking a technique up is a different errand from working through a
          curriculum, and it has to stay fast. */}
      <StartHereBanner
        onOpen={onOpenPath}
        dismissible={false}
        hideWhenGraduated={false}
        source="learn"
      />

      {!isPro && (
        <button className="learn-unlock-banner" onClick={onUnlock}>
          <span className="learn-unlock-banner-title">
            🔒 Full lessons are part of Pro
          </span>
          <span className="learn-unlock-banner-body">
            Browse the whole shelf below. Unlock Pro to open any lesson and
            drill it straight from here.
          </span>
        </button>
      )}

      <TechniqueGallery onOpenLesson={onOpenLesson} />
    </>
  );
}

// --------------------------------------------------------------- detail --

function LessonDetail({
  slug,
  onDrill,
  onOpenPath,
}: {
  slug: string;
  onDrill: (styleKey: string, slug: string) => void;
  onOpenPath: () => void;
}) {
  const entry = getEntry(slug);
  const styles = useMemo(() => getStylesForEntry(slug), [slug]);
  const level = useMemo(() => levelTeaching(FOUNDATIONS, slug), [slug]);

  if (!entry) return <p className="learn-subtitle">Lesson not found.</p>;

  return (
    <article className="learn-detail">
      <h1 className="learn-title">{entry.name}</h1>
      <p className="learn-detail-meta">
        {entry.numbering && (
          <span className="learn-detail-badge">{entry.numbering}</span>
        )}
        {entry.thai && <span className="learn-detail-thai">{entry.thai}</span>}
      </p>

      <div className="learn-detail-intro">
        <p className="learn-detail-summary">{entry.summary}</p>
        {/* Nothing renders for a lesson with no sheet. */}
        <TechniqueSprite slug={entry.slug} name={entry.name} />
      </div>

      {level && (
        <button className="learn-path-link" onClick={onOpenPath}>
          <span className="learn-path-link-label">
            Taught at {level.bonus ? "the bonus level" : `level ${level.id}`} of
            Start Here
          </span>
          <span className="learn-path-link-title">
            {level.title.replace(/^Bonus: /, "")} ›
          </span>
        </button>
      )}

      <section className="learn-panel">
        <h2 className="learn-panel-title">Key points</h2>
        <ul className="learn-panel-list">
          {entry.keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <section className="learn-panel learn-panel--mistakes">
        <h2 className="learn-panel-title">Common mistakes</h2>
        <ul className="learn-panel-list">
          {entry.mistakes.map((mistake) => (
            <li key={mistake}>{mistake}</li>
          ))}
        </ul>
      </section>

      {styles.length > 0 && (
        <section className="learn-panel learn-panel--drill">
          <h2 className="learn-panel-title">Drill it</h2>
          <p className="learn-drill-hint">
            {styles.length === 1
              ? "This style calls it out — tap to load it and start a round."
              : "These styles call it out — tap one to load it and start a round."}
          </p>
          <div className="learn-drill-styles">
            {styles.map((style) => (
              <button
                key={style.key}
                className="learn-drill-btn"
                onClick={() => onDrill(style.key, entry.slug)}
              >
                {style.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {styles.length === 0 && isCalisthenicsOnly(entry.slug) && (
        <section className="learn-panel learn-panel--drill">
          <h2 className="learn-panel-title">Drill it</h2>
          <p className="learn-drill-hint">
            This one is mixed into rounds rather than picked as a style. Turn on
            <strong> Add Calisthenics</strong> in Advanced Settings on the timer
            screen and it will start showing up between techniques.
          </p>
        </section>
      )}
    </article>
  );
}

export default LearnSection;
