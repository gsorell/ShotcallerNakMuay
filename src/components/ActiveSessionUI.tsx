import React from "react";
import { type EmphasisKey } from "../types";
import { ImageWithFallback } from "./ImageWithFallback";
import StatusTimer from "./StatusTimer";

// Helper styles moved here
const controlButtonStyle = (bg: string, border = bg): React.CSSProperties => ({
  all: "unset",
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.65rem 0.9rem",
  borderRadius: "0.75rem",
  cursor: "pointer",
  fontWeight: 700,
  color: "white",
  background: `linear-gradient(180deg, ${bg} 0%, ${border} 100%)`,
  border: `1px solid ${border}`,
  boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
});

interface ActiveSessionUIProps {
  running: boolean;
  isPreRound: boolean;
  paused: boolean;
  isResting: boolean;
  timeLeft: number;
  currentRound: number;
  roundsCount: number;
  restTimeLeft: number;
  preRoundTimeLeft: number;
  fmtTime: (s: number) => string;
  getStatus: () => any;
  currentCallout: string;
  onPause: () => void;
  onStop: () => void;
  selectedEmphases: Record<EmphasisKey, boolean>;
  emphasisList: any[];
}

export default function ActiveSessionUI({
  running,
  isPreRound,
  paused,
  isResting,
  timeLeft,
  currentRound,
  roundsCount,
  restTimeLeft,
  preRoundTimeLeft,
  fmtTime,
  getStatus,
  currentCallout,
  onPause,
  onStop,
  selectedEmphases,
  emphasisList,
}: ActiveSessionUIProps) {
  if (!running && !isPreRound) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        rowGap: "clamp(16px, 3.2vh, 28px)",
      }}
    >
      <StatusTimer
        time={fmtTime(timeLeft)}
        round={currentRound}
        totalRounds={roundsCount}
        status={getStatus()}
        isResting={isResting}
        restTimeLeft={restTimeLeft}
        isPreRound={isPreRound}
        preRoundTimeLeft={preRoundTimeLeft}
        fmtTime={fmtTime}
      />

      {running && !paused && !isResting && currentCallout && (
        <div
          aria-live="polite"
          style={{
            maxWidth: "46rem",
            textAlign: "center",
            fontSize: "2rem",
            fontWeight: 800,
            letterSpacing: "0.5px",
            color: "white",
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: "0.85rem",
            padding: "0.6rem 1rem",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          {currentCallout}
        </div>
      )}

      <section
        style={{ maxWidth: "32rem", margin: "0 auto", minHeight: "4rem" }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
          <button
            onClick={onPause}
            style={controlButtonStyle("#f59e0b", "#f97316")}
          >
            {paused ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
            <span style={{ fontSize: "0.875rem", lineHeight: 1 }}>
              {paused ? "Resume" : "Pause"}
            </span>
          </button>
          <button
            onClick={onStop}
            style={controlButtonStyle("#ef4444", "#ec4899")}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z" />
            </svg>
            <span style={{ fontSize: "0.875rem", lineHeight: 1 }}>Stop</span>
          </button>
        </div>
      </section>

      {emphasisList.some((e) => selectedEmphases[e.key as EmphasisKey]) && (
        <section
          aria-label="Selected styles"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            marginTop: "0.25rem",
            padding: "0 0.75rem",
            width: "100%",
          }}
        >
          <div
            style={{ fontSize: "0.875rem", color: "#f9a8d4", fontWeight: 700 }}
          >
            Selected Styles
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0.5rem",
              maxWidth: "56rem",
            }}
          >
            {emphasisList
              .filter((e) => selectedEmphases[e.key as EmphasisKey])
              .map((e) => (
                <div
                  key={e.key}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.4rem 0.6rem",
                    borderRadius: "9999px",
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    color: "white",
                  }}
                  title={e.desc}
                >
                  <ImageWithFallback
                    srcPath={e.iconPath}
                    alt={e.label}
                    emoji={e.emoji}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      objectFit: "cover",
                    }}
                  />
                  <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                    {e.label}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
