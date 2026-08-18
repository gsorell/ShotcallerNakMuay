import { useCallback, useMemo, useState } from "react";

import { useEntitlement } from "@/features/entitlement";
import { usePaywall } from "@/features/paywall";
// Direct component imports rather than the roadmap barrel: the barrel pulls in
// modules that import this feature back.
import { RoadmapSection } from "@/features/roadmap/components/RoadmapSection";
import { StartHereBanner } from "@/features/roadmap/components/StartHereBanner";
import { FOUNDATIONS } from "@/features/roadmap/data/paths";
import { levelTeaching } from "@/features/roadmap/vocabulary";
import { ImageWithFallback, useUIContext } from "@/features/shared";
import { useWorkoutContext } from "@/features/workout";
import { trackEvent } from "@/utils/analytics";
import { scrollContentToTop } from "@/utils/scroll";
import type { EmphasisKey } from "@/types";

import {
  ENTRIES_BY_CATEGORY,
  TOTAL_LESSON_COUNT,
  getEntry,
  getStylesForEntry,
  isCalisthenicsOnly,
} from "../data/techniqueIndex";
import {
  CATEGORY_META,
  type LearnEntry,
  type TechniqueCategory,
} from "../data/techniqueLibrary";
import "./LearnSection.css";

type View =
  | { mode: "categories" }
  | { mode: "list"; category: TechniqueCategory }
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

  const openCategory = useCallback((category: TechniqueCategory) => {
    setView({ mode: "list", category });
    scrollContentToTop("auto");
  }, []);

  // Navigation is derived from the current view rather than computed inside a
  // setState updater — updaters must stay pure (StrictMode runs them twice,
  // which would fire onBack() twice and skip a level).
  const goBack = useCallback(() => {
    if (view.mode === "detail") {
      const entry = getEntry(view.slug);
      setView(
        entry ? { mode: "list", category: entry.category } : { mode: "categories" }
      );
    } else if (view.mode === "list") {
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
          onOpenCategory={openCategory}
          onOpenPath={() => {
            setView({ mode: "path" });
            scrollContentToTop("auto");
          }}
          onUnlock={() => openPaywall("learn_header")}
        />
      )}

      {view.mode === "list" && (
        <TechniqueList
          category={view.category}
          isPro={isPro}
          onOpenLesson={openLesson}
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
  onOpenCategory,
  onOpenPath,
  onUnlock,
}: {
  isPro: boolean;
  onOpenCategory: (c: TechniqueCategory) => void;
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

      <h2 className="learn-section-heading">Browse every technique</h2>
      <p className="learn-subtitle">
        {TOTAL_LESSON_COUNT} techniques the app calls out — what each one is,
        how to throw it, and what people get wrong.
      </p>

      {!isPro && (
        <button className="learn-unlock-banner" onClick={onUnlock}>
          <span className="learn-unlock-banner-title">
            🔒 Full lessons are part of Pro
          </span>
          <span className="learn-unlock-banner-body">
            Browse the whole list below. Unlock Pro to open any lesson and drill
            it straight from here.
          </span>
        </button>
      )}

      <div className="learn-category-grid">
        {CATEGORY_META.map((meta) => {
          const count = ENTRIES_BY_CATEGORY[meta.key].length;
          return (
            <button
              key={meta.key}
              className="learn-category-card"
              onClick={() => onOpenCategory(meta.key)}
            >
              <ImageWithFallback
                srcPath={meta.iconPath}
                alt=""
                emoji={meta.icon}
                className="learn-category-icon"
              />
              <span className="learn-category-text">
                <span className="learn-category-label">{meta.label}</span>
                <span className="learn-category-blurb">{meta.blurb}</span>
              </span>
              <span className="learn-category-count">{count}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------- technique list --

function TechniqueList({
  category,
  isPro,
  onOpenLesson,
}: {
  category: TechniqueCategory;
  isPro: boolean;
  onOpenLesson: (entry: LearnEntry) => void;
}) {
  const meta = CATEGORY_META.find((m) => m.key === category);
  const entries = ENTRIES_BY_CATEGORY[category];

  return (
    <>
      <div className="learn-list-header">
        {meta && (
          <ImageWithFallback
            srcPath={meta.iconPath}
            alt=""
            emoji={meta.icon}
            className="learn-list-header-icon"
          />
        )}
        <h1 className="learn-title learn-title--inline">{meta?.label}</h1>
      </div>
      <p className="learn-subtitle">{meta?.blurb}</p>

      <div className="learn-list">
        {entries.map((entry) => (
          <button
            key={entry.slug}
            className="learn-list-item"
            onClick={() => onOpenLesson(entry)}
            aria-label={
              isPro ? entry.name : `Unlock ${entry.name} lesson with Pro`
            }
          >
            <span className="learn-list-text">
              <span className="learn-list-name">
                {entry.name}
                {entry.numbering && (
                  <span className="learn-list-number">{entry.numbering}</span>
                )}
              </span>
              {entry.thai && (
                <span className="learn-list-thai">{entry.thai}</span>
              )}
            </span>
            <span className="learn-list-chevron" aria-hidden="true">
              {isPro ? "›" : "🔒"}
            </span>
          </button>
        ))}
      </div>
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

      <p className="learn-detail-summary">{entry.summary}</p>

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
