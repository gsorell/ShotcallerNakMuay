import html2canvas from "html2canvas";
import { useRef, useState } from "react";
import {
  captureAndDownloadElement,
  generateWorkoutFilename,
  shareWorkoutImage,
  type WorkoutStats,
} from "@/utils/imageUtils";

interface WorkoutCompletedProps {
  stats: WorkoutStats;
  onRestart: () => void;
  onReset: () => void;
  onViewLog: () => void;
}

export default function WorkoutCompleted({
  stats,
  onRestart,
  onReset,
  onViewLog,
}: WorkoutCompletedProps) {
  const workoutSummaryRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

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
