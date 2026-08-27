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
import { useSouthpaw } from "@/features/workout/contexts/WorkoutProvider";
import { useWorkoutContext } from "@/features/workout";
import { trackEvent } from "@/utils/analytics";
import {
  rememberScroll,
  restoreScroll,
  scrollContentToTop,
} from "@/utils/scroll";
import type { EmphasisKey } from "@/types";

import type { GalleryTile } from "../data/galleryTiles";
import {
  getEntry,
  getStylesForEntry,
  isCalisthenicsOnly,
} from "../data/techniqueIndex";
import { lessonCard } from "../data/techniqueLibrary";
import { displayName, spritesFor } from "../data/techniqueSprites";
import { TechniqueViewer } from "./TechniqueViewer";
import { TechniqueGallery } from "./TechniqueGallery";
import "./LearnSection.css";

/**
 * Where the shelf was left. One key, because there is one shelf — the filter
 * narrows it in place rather than pushing a screen, so there is no per-category
 * position to keep.
 */
const SHELF_SCROLL = "learn:shelf";

type View =
  | { mode: "categories" }
  /**
   * One page per FIGURE, not per lesson — a tile and a card, one to one.
   *
   * A lesson shot from both sides used to open a single page with the two
   * silhouettes side by side, at two-thirds size, under one heading: the shelf
   * offered the lead knee and the rear knee as separate things to tap and then
   * landed both on the same words. They are separate techniques — thrown
   * differently, costing differently, chosen for different reasons — so each
   * has its own card, with its own copy, and no control on it for switching to
   * the other. The shelf is where you choose which one you want.
   */
  | { mode: "detail"; slug: string; variantIndex: number }
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
  const openTile = useCallback(
    (tile: GalleryTile) => {
      if (!isPro) {
        openPaywall("learn_lesson");
        return;
      }
      trackEvent("learn_lesson_open", {
        slug: tile.entry.slug,
        // Which side was tapped, where the lesson has more than one. Without
        // it the two pages of a paired lesson are indistinguishable in the
        // funnel, which is exactly the thing splitting them was meant to fix.
        ...(tile.side ? { side: tile.side } : null),
      });
      rememberScroll(SHELF_SCROLL);
      setView({
        mode: "detail",
        slug: tile.entry.slug,
        variantIndex: tile.variantIndex,
      });
      scrollContentToTop("auto");
    },
    [isPro, openPaywall]
  );

  /**
   * Opening a combination, on exactly the terms a lesson opens on: the shelf
   * is browsable free so the depth of what Pro buys is visible, and playing
   * something is where Pro starts.
   */
  const openCombo = useCallback(
    (combo: string) => {
      if (!isPro) {
        openPaywall("learn_combo");
        return false;
      }
      trackEvent("learn_combo_play", { combo });
      return true;
    },
    [isPro, openPaywall]
  );

  // Navigation is derived from the current view rather than computed inside a
  // setState updater — updaters must stay pure (StrictMode runs them twice,
  // which would fire onBack() twice and skip a level).
  const goBack = useCallback(() => {
    if (view.mode === "detail" || view.mode === "path") {
      // Back onto the shelf, at the tile you opened rather than the top of a
      // grid you would then have to hunt through again.
      setView({ mode: "categories" });
      restoreScroll(SHELF_SCROLL);
      return;
    }
    onBack();
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
            restoreScroll(SHELF_SCROLL);
          }}
        />
      </div>
    );
  }

  return (
    <div className="learn">
      <div className="learn-header">
        <button className="back-link" onClick={goBack}>
          <span className="back-link-arrow" aria-hidden="true">
            ←
          </span>
          Back
        </button>
        {!isPro && <span className="learn-pro-chip">Pro</span>}
      </div>

      {view.mode === "categories" && (
        <CategoryList
          isPro={isPro}
          onOpenTile={openTile}
          onOpenCombo={openCombo}
          onOpenPath={() => {
            rememberScroll(SHELF_SCROLL);
            setView({ mode: "path" });
            scrollContentToTop("auto");
          }}
          onUnlock={() => openPaywall("learn_header")}
        />
      )}

      {view.mode === "detail" && (
        <LessonDetail
          slug={view.slug}
          variantIndex={view.variantIndex}
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
  onOpenTile,
  onOpenCombo,
  onOpenPath,
  onUnlock,
}: {
  isPro: boolean;
  onOpenTile: (tile: GalleryTile) => void;
  onOpenCombo: (combo: string) => boolean;
  onOpenPath: () => void;
  onUnlock: () => void;
}) {
  return (
    <>
      <h1 className="learn-title">Learn</h1>
      <p className="learn-subtitle">
        A guided path if you are starting out, and the technique library if you
        just need to look something up.
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

      <TechniqueGallery onOpenTile={onOpenTile} onOpenCombo={onOpenCombo} />
    </>
  );
}

// --------------------------------------------------------------- detail --

function LessonDetail({
  slug,
  variantIndex,
  onDrill,
  onOpenPath,
}: {
  slug: string;
  /** Which sheet this page is — see the `detail` view for why it has one. */
  variantIndex: number;
  onDrill: (styleKey: string, slug: string) => void;
  onOpenPath: () => void;
}) {
  const entry = getEntry(slug);
  const southpaw = useSouthpaw();
  const styles = useMemo(() => getStylesForEntry(slug), [slug]);
  const level = useMemo(() => levelTeaching(FOUNDATIONS, slug), [slug]);
  const sheets = useMemo(() => spritesFor(slug), [slug]);

  if (!entry) return <p className="learn-subtitle">Lesson not found.</p>;

  // Which sheet this page is, named only where the lesson has another one to
  // tell it apart from — the same rule the shelf tiles print by.
  const sheetLabel = sheets.length > 1 ? sheets[variantIndex]?.label : undefined;
  const card = lessonCard(entry, sheetLabel);
  // The NAME goes through the mirror and the prose never does: a side is named
  // "Slip Left", which is the other way round for a southpaw, while the copy is
  // written in lead and rear so that it reads true from either stance.
  const name = displayName(card.name, southpaw);

  return (
    <article className="learn-detail">
      <div className="learn-detail-head">
        <h1 className="learn-title learn-title--inline">{name}</h1>
        {/* The number is the name in the other language the app speaks, so it
            belongs beside the name rather than under it. */}
        {entry.numbering && (
          <span className="learn-detail-badge">{entry.numbering}</span>
        )}
      </div>
      {entry.thai && (
        <p className="learn-detail-meta">
          <span className="learn-detail-thai">{entry.thai}</span>
        </p>
      )}

      {/* Figure first. It is the fastest way to know whether this is the
          technique you came looking for, and the copy underneath is what you
          read once you know it is. Nothing renders for a lesson with no
          sheet. */}
      <div className="learn-detail-intro">
        <TechniqueViewer
          slug={entry.slug}
          name={name}
          variantIndex={variantIndex}
          summary={card.summary}
        />
        <p className="learn-detail-summary">{card.summary}</p>
      </div>

      <section className="learn-panel">
        <h2 className="learn-panel-title">Key points</h2>
        <ul className="learn-panel-list">
          {card.keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <section className="learn-panel learn-panel--mistakes">
        <h2 className="learn-panel-title">Common mistakes</h2>
        <ul className="learn-panel-list">
          {card.mistakes.map((mistake) => (
            <li key={mistake}>{mistake}</li>
          ))}
        </ul>
      </section>

      {/* Sits with "Drill it" rather than under the summary: both answer the
          same question — now that you have read it, where do you go? Above the
          key points it interrupted the lesson to advertise a different one. */}
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
