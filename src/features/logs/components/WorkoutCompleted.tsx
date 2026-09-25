import html2canvas from "html2canvas";
import React, { useEffect, useRef, useState } from "react";
import {
  captureAndDownloadElement,
  formatRoundLength,
  generateWorkoutFilename,
  getDifficultyLabel,
  shareWorkoutImage,
  type WorkoutStats,
} from "@/utils/imageUtils";
import { useEntitlement } from "@/features/entitlement";
import { useOnboardingState } from "@/features/onboarding";
import { shouldPromptAfterWorkout, usePaywall } from "@/features/paywall";
import { useHomeStats } from "../hooks/useHomeStats";
import { claimNewMilestone } from "../utils/milestones";
import { claimNewCharms, readWorkoutHistory } from "../utils/charms";
import type { CharmVisual } from "../constants/charms";
import CharmCelebrationModal from "./CharmCelebrationModal";
import "./WorkoutCompleted.css";

interface Celebration {
  charm: CharmVisual;
  subtitle?: string;
}

interface WorkoutCompletedProps {
  stats: WorkoutStats;
  onRestart: () => void;
  onReset: () => void;
  onViewLog: () => void;
  /**
   * Rendered above the icon row. The guided path puts its "next level" button
   * here; passed in as a slot so this component stays unaware of the roadmap —
   * importing it directly would make logs and roadmap a circular import.
   */
  primaryAction?: React.ReactNode;
}

/** Width of the exported card, in CSS pixels before the capture's 2x scale. */
const EXPORT_WIDTH = 500;

/**
 * The palette the rest of the brand already writes in.
 *
 * Lifted from `scripts/social-cards.mjs`, which in turn took it from
 * `generate_blog.mjs` so that the generated cards "look like they came off the
 * same page as the blog and the app". A card a user posts lands in the same
 * feed as the cards the account posts, so it answers to the same palette.
 *
 * What it replaces was #f9a8d4 — Tailwind's pink-300, which appears in neither
 * the palette above nor the wordmark, and was never a brand colour.
 */
const BRAND = {
  bg: "#0c0710",
  heading: "#f4eef6",
  accent: "#ff5fb0",
  muted: "#9d8fa9",
  border: "#2e2240",
  /**
   * The card surface, straight from `social-cards.mjs`. The lift toward plum
   * at the centre is what keeps a near-black panel from reading as a hole in
   * the screen — it gives the trophy something to sit on.
   */
  surface:
    "radial-gradient(ellipse 70% 45% at 50% 40%, #2a1030 0%, #0c0710 70%)",
  /**
   * The wordmark's own ramp, stop for stop from `build_logo_banner.py`. The
   * magenta-to-cyan run is the logo's signature, and the flat opening 12% is
   * deliberate there — it holds magenta long enough to read as magenta before
   * the crossover, so it is kept here rather than smoothed out.
   */
  ramp:
    "linear-gradient(90deg, #f838f8 0%, #f838f8 12%, #d660f8 30%, " +
    "#8898f8 50%, #4accf8 70%, #18f8f8 88%, #18f8f8 100%)",
};

/**
 * Total time trained, as a clock rather than a phrase.
 *
 * `formatRoundLength` answers "how long is one round", and says "3 min" for
 * whole numbers because that is how a setup is spoken. This answers "how long
 * was the session", where mm:ss reads as the timer the number came off — the
 * receipt for a round timer should look like the thing that produced it.
 */
const formatTotalTime = (minutes: number): string => {
  const total = Math.round(minutes * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * The card as a stranger meets it.
 *
 * Not the completion screen with a challenge appended — a different artifact
 * for a different reader. The completion screen is a receipt: a trophy, a
 * headline, a date, the reassurance that something is finished. All of that is
 * addressed to the person who just did the work, and every bit of it works
 * against a challenge, because a reader who has already been told "training
 * complete" has been handed the ending before the invitation.
 *
 * So the hierarchy inverts. The setup is the hero, because the setup is the
 * only part anyone is being asked to do. Shots called is demoted to a footnote:
 * it is the outcome, it is not repeatable, and it is not a score (the app never
 * saw the work). The challenge closes in reversed colour — dark type on the
 * brand ramp, the one thing on the card that is not light type on near-black.
 * Contrast is what was missing from the earlier attempts, not size.
 */
function ChallengeCard({ stats }: { stats: WorkoutStats }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ padding: "40px 28px 32px" }}>
        <div
          style={{
            fontSize: "0.8rem",
            color: BRAND.muted,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            marginBottom: 28,
          }}
        >
          {stats.emphases.join(" · ")}
        </div>

        <div
          style={{
            fontSize: "3.25rem",
            fontWeight: 800,
            lineHeight: 1,
            color: BRAND.heading,
            marginBottom: 12,
          }}
        >
          {stats.roundsCompleted} × {formatRoundLength(stats.roundLengthMin)}
        </div>

        <div
          style={{
            fontSize: "1.3rem",
            fontWeight: 700,
            color: BRAND.accent,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 28,
          }}
        >
          {getDifficultyLabel(stats.difficulty)}
        </div>

        <div style={{ fontSize: "0.9rem", color: BRAND.muted }}>
          {stats.shotsCalledOut} shots called
        </div>
      </div>

      {/* Full bleed, because the export node has no corner radius to fight. */}
      <div
        style={{
          background: BRAND.ramp,
          color: BRAND.bg,
          padding: "20px 16px",
        }}
      >
        <div
          style={{
            fontSize: "1.65rem",
            fontWeight: 800,
            letterSpacing: "0.04em",
            lineHeight: 1.1,
          }}
        >
          Your move.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "16px 0 20px",
        }}
      >
        <img
          src="/assets/logo_mark.webp"
          alt=""
          style={{ width: 28, height: 28 }}
        />
        <span
          style={{ fontSize: "0.75rem", color: BRAND.muted, fontWeight: 500 }}
        >
          SHOT CALLER
        </span>
      </div>
    </div>
  );
}

export default function WorkoutCompleted({
  stats,
  onRestart,
  onReset,
  onViewLog,
  primaryAction,
}: WorkoutCompletedProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const stats_home = useHomeStats(0);
  const { isPro, ready } = useEntitlement();
  const { openPaywall } = usePaywall();
  const { isShowing: onboardingShowing, finishedThisSession } =
    useOnboardingState();
  const [celebrationQueue, setCelebrationQueue] = useState<Celebration[]>([]);
  const claimedRef = useRef(false);
  const promptedRef = useRef(false);

  useEffect(() => {
    if (claimedRef.current) return;
    if (!stats_home) return;
    // Charms/streak celebrations are a Pro feature. Free users don't claim or
    // celebrate; any accrued charms surface when they upgrade.
    if (!isPro) return;
    claimedRef.current = true;

    const queue: Celebration[] = [];

    // Streak milestone first (if a new one was just crossed)
    if (stats_home.current > 0) {
      const milestone = claimNewMilestone(stats_home.current);
      if (milestone) {
        queue.push({
          charm: milestone,
          subtitle: `${stats_home.current}-Day Streak 🔥`,
        });
      }
    }

    // Then any newly-earned achievement charms
    claimNewCharms(readWorkoutHistory()).forEach((charm) =>
      queue.push({ charm })
    );

    if (queue.length > 0) setCelebrationQueue(queue);
  }, [stats_home, isPro]);

  /**
   * The upsell, at the one moment the product has just proved itself. Pro
   * users are excluded, and so is anyone who met onboarding this session —
   * two asks in one sitting is how a first impression gets spent.
   *
   * The effect runs on mount only; `shouldPromptAfterWorkout` owns the "has
   * this already fired" question and persists its own answer, so re-entering
   * this screen cannot re-ask.
   */
  useEffect(() => {
    if (promptedRef.current) return;
    // Wait for entitlement to resolve. `isPro` is false while the status is
    // still `unknown`, so acting before `ready` would show a paywall to a
    // grandfathered owner whose lookup simply hadn't come back yet.
    if (!ready) return;
    if (isPro) return;
    if (onboardingShowing || finishedThisSession) return;
    promptedRef.current = true;
    // The just-finished workout is already in the log by the time this screen
    // renders, so the history length is the total including it.
    if (shouldPromptAfterWorkout(readWorkoutHistory().length)) {
      openPaywall("workout_complete");
    }
  }, [ready, isPro, onboardingShowing, finishedThisSession, openPaywall]);

  const handleDownload = async () => {
    if (!exportRef.current) return;
    setIsCapturing(true);
    try {
      const filename = generateWorkoutFilename(stats);
      await captureAndDownloadElement(exportRef.current, filename);
    } catch (error) {
      // Download failed
      alert("Failed to download workout image. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleShare = async () => {
    if (!exportRef.current) return;
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(exportRef.current, {
        // html2canvas fills with #ffffff unless told otherwise, which is
        // what put white in the corners of every shared card. The export node
        // is square-cornered and paints its own background to every edge.
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      canvas.toBlob(async (blob: Blob | null) => {
        if (blob) {
          await shareWorkoutImage(blob, stats);
        }
      });
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "2rem auto" }}>
      {celebrationQueue.length > 0 && (
        <CharmCelebrationModal
          charm={celebrationQueue[0]!.charm}
          subtitle={celebrationQueue[0]!.subtitle}
          onClose={() => setCelebrationQueue((q) => q.slice(1))}
        />
      )}
      {/* Workout Summary - This will be captured for download/sharing */}
      <div
        style={{
          // Same palette as the card that leaves the app. The two are read by
          // different people for different reasons, so they are not the same
          // layout — but they should look like the same product.
          background: BRAND.surface,
          borderRadius: 20,
          padding: "2rem",
          color: BRAND.heading,
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          marginBottom: "1.5rem",
        }}
      >
        {/* Header: what this was, in the order it is asked.

            The belt and the headline say "finished"; the line under them says
            "which session". Style, level and time are three answers to that
            one question, so they sit together at one size rather than being
            spread down the card at three — the date in particular had been
            occupying the third-most prominent slot on a screen read four
            seconds after the last bell. */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img
            src="/assets/icon_belt_logo.webp"
            alt=""
            style={{
              // The asset is trimmed to the artwork, so this is the belt's real
              // width rather than a box it sits somewhere inside. Landscape,
              // which is why it takes twice the width of the trophy it replaced
              // and still costs the card less height.
              //
              // Wider than the 140 the reordered card started at: the medallion
              // now carries the gloves-and-bolt mark rather than a generic
              // bolt, and the mark has to be legible to be worth putting there.
              // The medallion is about a third of the belt's width, so the mark
              // lands near the size the footer drew it at.
              width: 168,
              height: "auto",
              marginBottom: 10,
            }}
          />

          <h1
            style={{
              margin: 0,
              // Clamped rather than fixed, and held to one line. At a flat 2rem
              // this broke across two lines inside the card's padding on a
              // phone, and a headline that wraps mid-phrase reads as a bug
              // rather than a beat.
              fontSize: "clamp(1.35rem, 6.5vw, 1.75rem)",
              whiteSpace: "nowrap",
              fontWeight: 800,
              backgroundImage: BRAND.ramp,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Training Complete
          </h1>

          {/* This wraps, and has to: "Amateur" is longer than "Pro" and two or
              three selected styles are longer again, so there is no width at
              which one line is guaranteed. Given that, it is set to wrap
              well — balanced lines rather than one orphaned word, and leading
              loose enough that two lines read as a block instead of a break. */}
          <div
            style={{
              marginTop: 10,
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              lineHeight: 1.6,
              textWrap: "balance",
              color: BRAND.muted,
            }}
          >
            <span style={{ color: BRAND.accent, fontWeight: 700 }}>
              {stats.emphases.join(" · ")}
            </span>
            {" · "}
            {getDifficultyLabel(stats.difficulty)}
            {" · "}
            {new Date(stats.timestamp).toLocaleString("en-US", {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        </div>

        {/* The one number worth being large.

            Rounds and length are the reproducible setup, but the time is what
            was actually spent, and it is the only figure here that grows with
            the work. Four stats at competing sizes gave the card no subject;
            this gives it one. */}
        <div
          style={{
            textAlign: "center",
            padding: "20px 0",
            borderTop: `1px solid ${BRAND.border}`,
            borderBottom: `1px solid ${BRAND.border}`,
          }}
        >
          <div
            style={{
              fontSize: "3rem",
              fontWeight: 800,
              lineHeight: 1,
              color: BRAND.heading,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatTotalTime(stats.roundsCompleted * stats.roundLengthMin)}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: "0.8rem",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: BRAND.muted,
            }}
          >
            {stats.roundsCompleted}{" "}
            {stats.roundsCompleted === 1 ? "round" : "rounds"} ×{" "}
            {formatRoundLength(stats.roundLengthMin)}
            {/* Only when they stopped early. Saying "of 6" after six rounds
                turns a finished session into a quota met. */}
            {stats.roundsCompleted < stats.roundsPlanned &&
              ` · of ${stats.roundsPlanned}`}
          </div>
        </div>

        {/* The outcome, deliberately left as a sentence. It is not a score —
            the app never saw the work — so it is not given a number's
            typography. Previously it had a divider and a full-width row of its
            own while being set smaller than the stats above it, which is the
            layout and the type arguing about what it is. */}
        <div
          style={{
            textAlign: "center",
            marginTop: 16,
            fontSize: "0.9rem",
            color: BRAND.muted,
          }}
        >
          <strong style={{ color: BRAND.heading, fontWeight: 700 }}>
            {stats.shotsCalledOut}
          </strong>{" "}
          shots called
        </div>
      </div>

      {/* The export card, always mounted and parked offscreen.

          Rendering it in place of the receipt meant the user watched their own
          completion screen turn into a challenge poster for one frame before
          the share sheet covered it, which read as a glitch. Offscreen, the
          node html2canvas reads is already laid out and the visible screen
          never changes at all.

          Left offset rather than `display: none` or `visibility: hidden`:
          a hidden node has no layout for html2canvas to measure, and both
          properties survive into its clone, so the capture comes back blank. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: -10000,
          width: EXPORT_WIDTH,
          pointerEvents: "none",
        }}
      >
        <div
          ref={exportRef}
          style={{
            width: EXPORT_WIDTH,
            background: BRAND.bg,
            color: BRAND.heading,
          }}
        >
          <ChallengeCard stats={stats} />
        </div>
      </div>

      {primaryAction}

      {/* Actions — outside the capture area. See WorkoutCompleted.css for why
          this is a hierarchy rather than a row of five equals. */}
      <div className="completed-actions">
        <button
          type="button"
          className="completed-share"
          onClick={handleShare}
          disabled={isCapturing}
        >
          {isCapturing ? "Preparing…" : "Share your round"}
        </button>

        <button type="button" className="completed-again" onClick={onRestart}>
          Train again
        </button>

        <div className="completed-quiet">
          <button
            type="button"
            className="completed-quiet-link"
            onClick={onReset}
          >
            Home
          </button>
          <button
            type="button"
            className="completed-quiet-link"
            onClick={onViewLog}
          >
            View log
          </button>
          <button
            type="button"
            className="completed-quiet-link"
            onClick={handleDownload}
            disabled={isCapturing}
          >
            Save image
          </button>
        </div>
      </div>
    </div>
  );
}
