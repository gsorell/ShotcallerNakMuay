import html2canvas from "html2canvas";
import React, { useEffect, useRef, useState } from "react";
import {
  captureAndDownloadElement,
  generateWorkoutFilename,
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

export default function WorkoutCompleted({
  stats,
  onRestart,
  onReset,
  onViewLog,
  primaryAction,
}: WorkoutCompletedProps) {
  const workoutSummaryRef = useRef<HTMLDivElement>(null);
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

  // Map internal difficulty values to display labels
  const getDifficultyLabel = (difficulty: string): string => {
    switch (difficulty) {
      case "easy":
        return "Novice";
      case "medium":
        return "Amateur";
      case "hard":
        return "Pro";
      default:
        return difficulty;
    }
  };

  const handleDownload = async () => {
    if (!workoutSummaryRef.current) return;
    setIsCapturing(true);
    try {
      const filename = generateWorkoutFilename(stats);
      await captureAndDownloadElement(workoutSummaryRef.current, filename);
    } catch (error) {
      // Download failed
      alert("Failed to download workout image. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleShare = async () => {
    if (!workoutSummaryRef.current) return;
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(workoutSummaryRef.current);
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
        ref={workoutSummaryRef}
        style={{
          background:
            "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          borderRadius: 20,
          padding: "2rem",
          color: "white",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          marginBottom: "1.5rem",
        }}
      >
        {/* Header Section */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img
            src="/assets/icon_stacked.png"
            alt="Logo"
            style={{
              maxWidth: 180,
              height: "auto",
              marginBottom: 20,
            }}
          />

          <h1
            style={{
              margin: 0,
              color: "#f9a8d4",
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Workout Complete!
          </h1>
        </div>

        {/* Date & Time */}
        <div
          style={{
            fontSize: "0.9rem",
            color: "#94a3b8",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          {new Date(stats.timestamp).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}{" "}
          •{" "}
          {new Date(stats.timestamp).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>

        {/* Workout Type */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h2
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#f9a8d4",
              marginBottom: 24,
            }}
          >
            {stats.emphases.join(" • ")}
          </h2>

          {/* Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              marginBottom: 16,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Difficulty
              </div>
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "white",
                  textTransform: "capitalize",
                }}
              >
                {getDifficultyLabel(stats.difficulty)}
              </div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Shots Called
              </div>
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {stats.shotsCalledOut}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Rounds
              </div>
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {stats.roundsCompleted}/{stats.roundsPlanned}
              </div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Duration
              </div>
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {stats.roundLengthMin} min/round
              </div>
            </div>
          </div>
        </div>

        {/* Brand Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <img
            src="/assets/logo_icon.png"
            alt=""
            style={{
              width: 16,
              height: 16,
              opacity: 0.7,
            }}
          />
          <span
            style={{
              fontSize: "0.75rem",
              color: "#94a3b8",
              fontWeight: 500,
            }}
          >
            NAK MUAY SHOT CALLER
          </span>
        </div>
      </div>

      {primaryAction}

      {/* Action Buttons - Outside capture area */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          flexWrap: "nowrap",
        }}
      >
        <img
          src="/assets/icon_restart.png"
          alt="Restart"
          title="Restart"
          onClick={onRestart}
          style={{
            width: 48,
            height: 48,
            cursor: "pointer",
            transition: "all 0.2s",
            borderRadius: 12,
            padding: 4,
            boxSizing: "border-box",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.filter = "brightness(1.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.filter = "brightness(1)";
          }}
        />

        <img
          src="/assets/icon_home.png"
          alt="Home"
          title="Home"
          onClick={onReset}
          style={{
            width: 48,
            height: 48,
            cursor: "pointer",
            transition: "all 0.2s",
            borderRadius: 12,
            padding: 4,
            boxSizing: "border-box",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.filter = "brightness(1.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.filter = "brightness(1)";
          }}
        />

        <img
          src="/assets/icon_view_log.png"
          alt="View Log"
          title="View Log"
          onClick={onViewLog}
          style={{
            width: 48,
            height: 48,
            cursor: "pointer",
            transition: "all 0.2s",
            borderRadius: 12,
            padding: 4,
            boxSizing: "border-box",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.filter = "brightness(1.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.filter = "brightness(1)";
          }}
        />

        <img
          src="/assets/icon_download_updated.png"
          alt="Download"
          title="Download"
          onClick={isCapturing ? undefined : handleDownload}
          style={{
            width: 48,
            height: 48,
            cursor: isCapturing ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            borderRadius: 12,
            opacity: isCapturing ? 0.5 : 1,
            padding: 4,
            boxSizing: "border-box",
          }}
          onMouseEnter={(e) => {
            if (!isCapturing) {
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.filter = "brightness(1.2)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isCapturing) {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.filter = "brightness(1)";
            }
          }}
        />

        <img
          src="/assets/icon_share.png"
          alt="Share"
          title="Share"
          onClick={isCapturing ? undefined : handleShare}
          style={{
            width: 48,
            height: 48,
            cursor: isCapturing ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            borderRadius: 12,
            opacity: isCapturing ? 0.5 : 1,
            padding: 4,
            boxSizing: "border-box",
          }}
          onMouseEnter={(e) => {
            if (!isCapturing) {
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.filter = "brightness(1.2)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isCapturing) {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.filter = "brightness(1)";
            }
          }}
        />
      </div>
    </div>
  );
}
