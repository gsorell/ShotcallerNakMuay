import React from "react";
import { type Difficulty, type EmphasisKey } from "@/types";

interface StickyStartControlsProps {
  onStart: () => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  selectedEmphases: Record<EmphasisKey, boolean>;
  onClearEmphases: () => void;
}

export const StickyStartControls: React.FC<StickyStartControlsProps> = ({
  onStart,
  difficulty,
  setDifficulty,
  selectedEmphases,
  onClearEmphases,
}) => {
  return (
    <>
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          top: `calc(70vh - 120px)`,
          bottom: 0,
          zIndex: 998,
          pointerEvents: "none",
          background: `linear-gradient(180deg, rgba(24,24,36,0) 0%, rgba(24,24,36,0.7) 100%)`,
          opacity: 1,
          transition: "opacity 0.3s",
        }}
        aria-hidden="true"
      />

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
          padding: "1rem 1rem 2.5rem 1rem",
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.98) 100%)",
          backdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.3), 0 -2px 8px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.875rem",
        }}
      >
        {!selectedEmphases.timer_only && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.625rem",
              width: "280px",
              maxWidth: "calc(100vw - 32px)",
              margin: "0 auto",
              padding: "0.75rem 0.625rem",
              borderRadius: "1rem",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <label
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.9)",
                  margin: 0,
                  letterSpacing: "0.025em",
                  textTransform: "uppercase",
                }}
              >
                Difficulty
              </label>
              <button
                onClick={onClearEmphases}
                title="Clear all selections"
                style={{
                  position: "absolute",
                  right: 0,
                  width: "20px",
                  height: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "50%",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "12px",
                  fontWeight: 400,
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["easy", "medium", "hard"] as Difficulty[]).map((level) => (
                <button
                  key={level}
                  className={`difficulty-btn ${
                    difficulty === level ? "active" : ""
                  }`}
                  aria-pressed={difficulty === level}
                  onClick={() => setDifficulty(level)}
                  style={{
                    flex: 1,
                    fontSize: "0.7rem",
                    padding: "0.375rem 0.5rem",
                    borderRadius: "1rem",
                    opacity: difficulty === level ? 1 : 0.7,
                    fontWeight: difficulty === level ? 600 : 500,
                  }}
                >
                  {level === "easy"
                    ? "Novice"
                    : level === "medium"
                    ? "Amateur"
                    : "Pro"}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedEmphases.timer_only && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              width: "280px",
              maxWidth: "calc(100vw - 32px)",
              margin: "0 auto",
              paddingRight: "0.625rem",
            }}
          >
            <button
              onClick={onClearEmphases}
              style={{
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "50%",
                color: "rgba(255,255,255,0.7)",
                fontSize: "12px",
                cursor: "pointer",
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        )}

        <button
          onClick={onStart}
          className="sticky-start-button"
          style={{
            all: "unset",
            width: "280px",
            fontSize: "1.375rem",
            fontWeight: 700,
            color: "white",
            background:
              "linear-gradient(135deg, #4ade80 0%, #22d3ee 50%, #3b82f6 100%)",
            borderRadius: "1rem",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 12px 24px rgba(34,197,94,0.25)",
            padding: "0.875rem 2rem",
            cursor: "pointer",
            maxWidth: "calc(100vw - 32px)",
            boxSizing: "border-box",
            textAlign: "center",
          }}
        >
          Let's Go!
        </button>
      </div>
    </>
  );
};
