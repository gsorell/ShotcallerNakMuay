import React from "react";
import { type Difficulty, type EmphasisKey } from "@/types";
import { useWorkoutContext } from "../contexts/WorkoutProvider";

interface StickyStartControlsProps {
  onStart: () => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  selectedEmphases: Record<EmphasisKey, boolean>;
  onClearEmphases: () => void;
}

const ROUND_MIN_STEP = 0.25;
const REST_MIN_STEP = 0.25;

const formatMinutes = (v: number): string => {
  // Show "3" for whole numbers, "0.25"/"1.5" otherwise
  return Number.isInteger(v) ? String(v) : String(v);
};

export const StickyStartControls: React.FC<StickyStartControlsProps> = ({
  onStart,
  difficulty,
  setDifficulty,
  selectedEmphases,
  onClearEmphases,
}) => {
  const { settings } = useWorkoutContext();
  const {
    roundsCount,
    setRoundsCount,
    roundMin,
    setRoundMin,
    restMinutes,
    setRestMinutes,
  } = settings;

  const stepRoundMin = (dir: 1 | -1) => {
    const next = Math.min(30, Math.max(0.25, roundMin + dir * ROUND_MIN_STEP));
    setRoundMin(Math.round(next / 0.25) * 0.25);
  };

  const stepRestMinutes = (dir: 1 | -1) => {
    const next = Math.min(10, Math.max(0.25, restMinutes + dir * REST_MIN_STEP));
    setRestMinutes(Math.round(next / 0.25) * 0.25);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        padding: "0.75rem 1rem 2.25rem 1rem",
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.98) 100%)",
        backdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.3), 0 -2px 8px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.625rem",
      }}
    >
      {/* Rounds / Length / Rest */}
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.375rem",
          width: "300px",
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        <button
          onClick={onClearEmphases}
          title="Clear all selections"
          aria-label="Clear all selections"
          style={{
            position: "absolute",
            top: "-0.125rem",
            right: "-0.125rem",
            width: "1.25rem",
            height: "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.5)",
            fontSize: "1rem",
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          ×
        </button>

        <Stepper
          label="Rounds"
          value={String(roundsCount)}
          onDec={() => setRoundsCount(Math.max(1, roundsCount - 1))}
          onInc={() => setRoundsCount(Math.min(20, roundsCount + 1))}
        />
        <Stepper
          label="Length"
          value={formatMinutes(roundMin)}
          onDec={() => stepRoundMin(-1)}
          onInc={() => stepRoundMin(1)}
        />
        <Stepper
          label="Rest"
          value={formatMinutes(restMinutes)}
          onDec={() => stepRestMinutes(-1)}
          onInc={() => stepRestMinutes(1)}
        />
      </div>

      {/* Difficulty pills */}
      {!selectedEmphases.timer_only && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            width: "300px",
            maxWidth: "calc(100vw - 32px)",
            paddingTop: "0.625rem",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
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
      )}

      <button
        onClick={onStart}
        className="sticky-start-button"
        style={{
          all: "unset",
          width: "300px",
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "white",
          background:
            "linear-gradient(135deg, #4ade80 0%, #22d3ee 50%, #3b82f6 100%)",
          borderRadius: "1rem",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 12px 24px rgba(34,197,94,0.25)",
          padding: "0.75rem 2rem",
          cursor: "pointer",
          maxWidth: "calc(100vw - 32px)",
          boxSizing: "border-box",
          textAlign: "center",
          marginTop: "0.25rem",
        }}
      >
        Let's Go!
      </button>
    </div>
  );
};

// --- Stepper sub-component (used for Rounds, Length, Rest) ---
interface StepperProps {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
}

const Stepper: React.FC<StepperProps> = ({ label, value, onDec, onInc }) => (
  <div style={cellStyle}>
    <div style={miniLabelStyle}>{label}</div>
    <div style={miniRowStyle}>
      <button
        type="button"
        onClick={onDec}
        style={miniBtnStyle}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        −
      </button>
      <span style={miniValueStyle}>{value}</span>
      <button
        type="button"
        onClick={onInc}
        style={miniBtnStyle}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        +
      </button>
    </div>
  </div>
);

// --- compact-control styles ---
const cellStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.25rem",
};

const miniLabelStyle: React.CSSProperties = {
  fontSize: "0.6rem",
  fontWeight: 500,
  color: "rgba(255,255,255,0.7)",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const miniRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
};

const miniBtnStyle: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  width: "1.25rem",
  height: "1.5rem",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.55)",
  fontSize: "1rem",
  fontWeight: 500,
  lineHeight: 1,
};

const miniValueStyle: React.CSSProperties = {
  minWidth: "1.75rem",
  textAlign: "center",
  color: "white",
  fontSize: "1.15rem",
  fontWeight: 700,
};
