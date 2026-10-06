import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

import { isFreeEmphasis, useEntitlement } from "@/features/entitlement";
import { usePaywall } from "@/features/paywall";
import type { EmphasisKey, TechniquesShape } from "@/types";
import { trackEvent } from "@/utils/analytics";
import { ImageWithFallback } from "../../shared";
import { useEmphasisList } from "../hooks/useEmphasisList";
import {
  moveStyleKey,
  saveStyleDisplayOrder,
  useStyleDisplayOrder,
} from "../utils/styleDisplayOrder";
import { TechniqueQuickEdit } from "./TechniqueQuickEdit";

interface EmphasisSelectorProps {
  emphasisList: any[];
  selectedEmphases: Record<EmphasisKey, boolean>;
  toggleEmphasis: (k: EmphasisKey, source?: string) => void;
  techniques: TechniquesShape;
  setTechniques: (t: TechniquesShape) => void;
  showAllEmphases: boolean;
  setShowAllEmphases: React.Dispatch<React.SetStateAction<boolean>>;
  onManageTechniques: (groupKey?: string) => void;
  /**
   * Rendered full-width directly above the tiles, inside the grid's own
   * column. Used for the "Start Here" card, which belongs in the same space as
   * the styles — it is the answer to "which of these do I pick?" — while
   * keeping its own look so it doesn't read as a selectable style.
   */
  leadSlot?: React.ReactNode;
}

// Modes rather than styles: a bare timer and a freestyle round call no
// techniques. They are offered as a pair of small switches above the grid
// instead of as tiles in it — as tiles they read as two more fighting styles,
// and for free users they took two of the first three places.
const MODE_KEYS = ["timer_only", "freestyle"];
const TILES_WITHOUT_TECHNIQUES = new Set(MODE_KEYS);
// Asks for the shipped order, whatever has been saved.
const NO_ORDER: readonly string[] = [];

export const EmphasisSelector: React.FC<EmphasisSelectorProps> = ({
  emphasisList,
  selectedEmphases,
  toggleEmphasis,
  techniques,
  setTechniques,
  showAllEmphases,
  setShowAllEmphases,
  onManageTechniques,
  leadSlot,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const { isEmphasisUnlocked, isPro, hydrated } = useEntitlement();
  const { openPaywall } = usePaywall();

  // Opening the grid must leave the page where it is, so the new styles appear
  // below and are scrolled down to. Left alone, the browser's scroll anchoring
  // does the opposite whenever the tiles are mostly off the top of the screen:
  // it holds the More button still and pushes the new tiles up out of view.
  // So the position is noted on the tap and put back before paint. Closing is
  // left to the browser — there, holding the button still is what you want.
  const pinnedScrollTop = useRef<number | null>(null);
  useLayoutEffect(() => {
    const top = pinnedScrollTop.current;
    if (top === null) return;
    pinnedScrollTop.current = null;
    const el = document.querySelector<HTMLElement>(".app-scroll");
    if (!el) return;
    el.scrollTop = top;
    // Once more after layout settles, in case the adjustment lands late.
    requestAnimationFrame(() => {
      el.scrollTop = top;
    });
  }, [showAllEmphases]);

  const toggleShowAll = () => {
    if (!showAllEmphases) {
      pinnedScrollTop.current =
        document.querySelector<HTMLElement>(".app-scroll")?.scrollTop ?? null;
    }
    setShowAllEmphases((v) => !v);
  };

  const toggleExpanded = (key: string) =>
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));

  // For free users, float the unlocked styles to the top so the first thing
  // they see is usable — Nak Muay Newb leads — instead of a wall of locked
  // tiles. Pro users have everything unlocked, so they keep the original
  // archetype-led order.
  const orderedList = useMemo(() => {
    const styles = emphasisList.filter(
      (s) => !TILES_WITHOUT_TECHNIQUES.has(s.key)
    );
    if (isPro) return styles;
    const free = styles.filter((s) => isFreeEmphasis(s.key as EmphasisKey));
    const locked = styles.filter(
      (s) => !isFreeEmphasis(s.key as EmphasisKey)
    );
    return [...free, ...locked];
  }, [emphasisList, isPro]);

  // --- Reordering ---
  // Done here, on the grid it changes, rather than on the Technique Manager:
  // moving a tile where you can see it land needs no explaining, where arrows
  // on another screen needed a caption to say what they were for.
  //
  // A mode, because it is done once and then left alone. While it is on, a
  // tile is something to move, not to select or open, and every style is
  // shown so that none is out of reach behind "More".
  const [reordering, setReordering] = useState(false);
  const savedOrder = useStyleDisplayOrder();
  const shippedList = useEmphasisList(techniques, NO_ORDER);
  const orderKeys = orderedList.map((s) => s.key as string);

  const toggleReorder = () => {
    if (!reordering) {
      if (!isPro) {
        openPaywall("style_reorder");
        return;
      }
      if (!showAllEmphases) toggleShowAll();
    }
    setReordering((on) => !on);
  };

  const moveStyle = (key: string, direction: "up" | "down") => {
    const next = moveStyleKey(orderKeys, key, direction);
    // Arriving back at the shipped order saves nothing, so styles added to
    // the app later fall into their intended places.
    const shipped = shippedList
      .map((s) => s.key)
      .filter((k) => !TILES_WITHOUT_TECHNIQUES.has(k));
    saveStyleDisplayOrder(next.join("\n") === shipped.join("\n") ? [] : next);
    try {
      trackEvent("style_order_move", { style: key, direction });
    } catch { /* analytics must never break the move it measures */ }
  };

  const modes = MODE_KEYS.map((key) =>
    emphasisList.find((s) => s.key === key)
  ).filter(Boolean);
  const activeMode = modes.find(
    (mode) => selectedEmphases[mode.key as EmphasisKey]
  );

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* The first row of the page: the two ways to train without picking a
          style, at the leading edge, level with the app menu at the trailing
          one. Above the heading rather than under it, because they are an
          alternative to everything the heading introduces, not a part of it. */}
      {modes.length > 0 && (
        <div className="mode-switches">
          <div className="mode-switches-row">
            {modes.map((mode) => {
              const isOn = Boolean(selectedEmphases[mode.key as EmphasisKey]);
              return (
                <button
                  key={mode.key}
                  type="button"
                  className={`mode-switch ${isOn ? "is-on" : ""}`}
                  aria-pressed={isOn}
                  title={mode.desc}
                  onClick={() =>
                    toggleEmphasis(mode.key as EmphasisKey, "mode_switch")
                  }
                >
                  <ImageWithFallback
                    srcPath={mode.iconPath}
                    alt=""
                    emoji={mode.emoji}
                    className="mode-switch-icon"
                  />
                  {mode.label}
                </button>
              );
            })}
          </div>
          {/* Says what the mode does once it is on — the tile used to carry
              this line all the time, which is most of why it was so big. */}
          {activeMode?.desc && (
            <p className="mode-switches-desc" aria-live="polite">
              {activeMode.desc}
            </p>
          )}
        </div>
      )}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "60rem",
          margin: "0 auto",
        }}
      >
        {leadSlot}

        {/* The heading sits directly over the tiles it introduces, under the
            Start Here card rather than above it. It does the job a separate
            "Styles" label was doing one row further down, so that label is
            gone. */}
        <div className="style-grid-heading">
          <h2>Choose Your Fighting Style</h2>
          <p>Select one or more styles to get started.</p>
        </div>

        {/* Reordering is started from under the tiles; while it is on, this
            bar says so and offers the way back. */}
        {reordering && (
          <div className="style-reorder-bar">
            <span>Arrange your styles.</span>
            {savedOrder.length > 0 && (
              <button
                type="button"
                className="style-reorder-reset"
                onClick={() => saveStyleDisplayOrder([])}
              >
                Reset
              </button>
            )}
            <button
              type="button"
              className="style-reorder-done"
              onClick={toggleReorder}
            >
              Done
            </button>
          </div>
        )}

        <div
          className="emphasis-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
            maxWidth: "60rem",
            margin: "0 auto",
            alignItems: "start",
          }}
        >
          {/* Until entitlement is known, render placeholders rather than a
              guess. Rendering "locked" first means a Pro user watches lock
              badges appear and the grid reorder under them on every launch.
              `hydrated` is seeded from the last resolution, so this only ever
              shows on a genuine first launch. */}
          {!hydrated &&
            Array.from({ length: 9 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="emphasis-tile emphasis-tile--skeleton"
                aria-hidden="true"
              />
            ))}

          {hydrated &&
            (showAllEmphases || reordering
              ? orderedList
              : orderedList.slice(0, 9)
            ).map((style, index) => {
              const isSelected = selectedEmphases[style.key as EmphasisKey];
              const isExpanded = !!expandedKeys[style.key];
              const locked = !isEmphasisUnlocked(style.key as EmphasisKey);
              // Inline editing is a Pro feature; free users view via the full
              // editor (read-only) instead.
              const canEdit =
                !TILES_WITHOUT_TECHNIQUES.has(style.key) &&
                isPro &&
                !reordering;
              const activate = () => {
                // A tile is something to move while reordering, not to pick.
                if (reordering) return;
                if (locked) {
                  openPaywall("style_tile");
                } else {
                  toggleEmphasis(style.key as EmphasisKey);
                }
              };
              return (
                <div
                  key={style.key}
                  className="emphasis-tile"
                  role="button"
                  tabIndex={0}
                  aria-pressed={locked ? undefined : isSelected}
                  aria-label={
                    locked ? `Unlock ${style.label} with Pro` : undefined
                  }
                  onClick={activate}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activate();
                    }
                  }}
                  style={{
                    position: "relative",
                    padding: "0.875rem 1rem",
                    borderRadius: "1rem",
                    border: isSelected
                      ? "2px solid #60a5fa"
                      : "2px solid rgba(255,255,255,0.2)",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "border 0.2s, background 0.2s, box-shadow 0.2s",
                    backgroundColor: isSelected
                      ? "#2563eb"
                      : "rgba(255,255,255,0.1)",
                    color: "white",
                    boxShadow: isSelected
                      ? "0 10px 25px rgba(37,99,235,0.25)"
                      : "none",
                  }}
                >
                  {locked && (
                    <span
                      aria-hidden="true"
                      title="Pro feature"
                      style={{
                        position: "absolute",
                        top: "0.5rem",
                        right: "0.5rem",
                        fontSize: "0.9rem",
                        lineHeight: 1,
                        opacity: 0.85,
                      }}
                    >
                      🔒
                    </span>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(style.key);
                      }}
                      title={
                        isExpanded
                          ? "Hide techniques"
                          : "View & edit techniques"
                      }
                      aria-label={
                        isExpanded
                          ? `Hide techniques for ${style.label}`
                          : `View & edit techniques for ${style.label}`
                      }
                      aria-expanded={isExpanded}
                      style={{
                        position: "absolute",
                        top: "0.5rem",
                        right: "0.5rem",
                        width: "1.75rem",
                        height: "1.75rem",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "transparent",
                        border: "none",
                        color: "rgba(255,255,255,0.7)",
                        fontSize: "1rem",
                        lineHeight: 1,
                        cursor: "pointer",
                        padding: 0,
                        transition: "transform 0.2s",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                      }}
                    >
                      ▾
                    </button>
                  )}

                  {reordering && (
                    <div className="style-reorder-arrows">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveStyle(style.key, "up");
                        }}
                        disabled={index === 0}
                        aria-label={`Move ${style.label} up`}
                        title="Move earlier"
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M8 13V3.5M4 7.5l4-4 4 4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveStyle(style.key, "down");
                        }}
                        disabled={index === orderedList.length - 1}
                        aria-label={`Move ${style.label} down`}
                        title="Move later"
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M8 3v9.5M4 8.5l4 4 4-4" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.625rem",
                      paddingRight: reordering
                        ? "var(--reorder-pad, 5.75rem)"
                        : canEdit || locked
                        ? "2rem"
                        : 0,
                    }}
                  >
                    <ImageWithFallback
                      srcPath={style.iconPath}
                      alt={style.label}
                      emoji={style.emoji}
                      style={{
                        // The tile is a fixed 6.25rem tall and its text rarely
                        // fills that, so the art can be this big for free — no
                        // tile grows, and the line-work in the style icons is
                        // actually readable rather than a smudge.
                        width: 56,
                        height: 56,
                        borderRadius: 10,
                        objectFit: "cover",
                        display: "inline-block",
                        flexShrink: 0,
                        // Only ever seen if the art 404s, but the box is big
                        // enough now that the default emoji size looks lost.
                        fontSize: 34,
                        lineHeight: "56px",
                        textAlign: "center",
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3
                        className="emphasis-tile-title"
                        title={techniques[style.key]?.title?.trim() || style.label}
                        style={{
                          fontSize: "1rem",
                          fontWeight: 700,
                          margin: 0,
                          lineHeight: 1.2,
                        }}
                      >
                        {techniques[style.key]?.title?.trim() || style.label}
                      </h3>
                      {style.desc && (
                        <p
                          className="emphasis-tile-desc"
                          title={style.desc}
                          style={{
                            color: "#f9a8d4",
                            margin: "0.125rem 0 0 0",
                            fontSize: "0.75rem",
                            lineHeight: 1.3,
                          }}
                        >
                          {style.desc}
                        </p>
                      )}
                    </div>
                  </div>

                  {canEdit && isExpanded && (
                    <TechniqueQuickEdit
                      groupKey={style.key}
                      techniques={techniques as any}
                      setTechniques={setTechniques as any}
                      onOpenFullEditor={() => onManageTechniques(style.key)}
                    />
                  )}
                </div>
              );
            })}
        </div>

        {reordering ? (
          // The way out, where the eye is after the last tile moved: the list
          // is long, and the bar at the top is a scroll away by then.
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "1rem",
            }}
          >
            <button
              type="button"
              className="style-reorder-done style-reorder-done--foot"
              onClick={toggleReorder}
            >
              Done reordering
            </button>
          </div>
        ) : (
          // Under the tiles, one row: Reorder at the leading edge, "show
          // more" at the trailing one. A matched pair — same size, weight and
          // colour, each a label followed by its icon — so the row reads as
          // one thing rather than two controls that happen to share a line.
          <div className="style-grid-foot">
            <button
              type="button"
              className="style-grid-foot-link"
              onClick={toggleReorder}
            >
              Reorder
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5 13V3.5M2.5 6 5 3.5 7.5 6M11 3v9.5M8.5 10l2.5 2.5 2.5-2.5" />
              </svg>
            </button>
            {orderedList.length > 9 && (
              <button
                type="button"
                className="style-grid-foot-link"
                onClick={toggleShowAll}
                aria-expanded={showAllEmphases}
              >
                {showAllEmphases ? "Show fewer" : "Show more"}
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className={showAllEmphases ? "is-open" : ""}
                >
                  <path d="M3.5 6 8 10.5 12.5 6" />
                </svg>
              </button>
            )}
          </div>
        )}

      </div>
    </section>
  );
};
