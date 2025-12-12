import React, { useEffect, useState } from "react";
import { useWorkoutContext } from "../contexts/WorkoutProvider";

export const WorkoutConfiguration: React.FC = () => {
  const { settings } = useWorkoutContext();
  const {
    roundsCount,
    setRoundsCount,
    roundMin,
    setRoundMin,
    restMinutes,
    setRestMinutes,
  } = settings;
  // Local state for text inputs to allow typing "1." without it forcing "1" immediately
  const [roundMinInput, setRoundMinInput] = useState<string>(String(roundMin));
  const [restMinutesInput, setRestMinutesInput] = useState<string>(
    String(restMinutes)
  );

  // Sync local inputs when parent props change (e.g. loading a preset)
  useEffect(() => {
    setRoundMinInput(String(roundMin));
  }, [roundMin]);

  useEffect(() => {
    setRestMinutesInput(String(restMinutes));
  }, [restMinutes]);

  const chipButtonStyle: React.CSSProperties = {
    all: "unset",
    cursor: "pointer",
    width: "2.25rem",
    height: "2.25rem",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "0.5rem",
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.06)",
    color: "white",
    fontSize: "1.25rem",
    fontWeight: 700,
  };

  const inputStyle: React.CSSProperties = {
    width: "4rem",
    height: "3rem",
    textAlign: "center",
    fontSize: "2rem",
    fontWeight: 700,
    borderRadius: "0.5rem",
    border: "none",
    background: "rgba(255,255,255,0.15)",
    color: "white",
    boxShadow: "none",
  };

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
  };

  const controlGroupStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: "1rem 2rem",
    borderRadius: "1rem",
    border: "1px solid rgba(255,255,255,0.2)",
    minHeight: "70px",
  };

  return (
    <section
      style={{
        maxWidth: "48rem",
        margin: "0 auto",
        display: "flex",
        justifyContent: "center",
        gap: "2rem",
        flexWrap: "wrap",
      }}
    >
      {/* Number of Rounds */}
      <div style={containerStyle}>
        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: "bold",
            color: "white",
            margin: 0,
          }}
        >
          Number of Rounds
        </h3>
        <div style={controlGroupStyle}>
          <button
            type="button"
            onClick={() => setRoundsCount(Math.max(1, roundsCount - 1))}
            style={chipButtonStyle}
          >
            −
          </button>
          <div style={{ minWidth: "4rem", textAlign: "center" }}>
            <div
              style={{ fontSize: "2rem", fontWeight: "bold", color: "white" }}
            >
              {roundsCount}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "#f9a8d4",
                marginTop: "0.25rem",
              }}
            >
              rounds
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRoundsCount(Math.min(20, roundsCount + 1))}
            style={chipButtonStyle}
          >
            +
          </button>
        </div>
      </div>

      {/* Round Length */}
      <div style={containerStyle}>
        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: "bold",
            color: "white",
            margin: 0,
          }}
        >
          Round Length
        </h3>
        <div style={controlGroupStyle}>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            value={roundMinInput}
            onChange={(e) => {
              const raw = e.target.value.replace(",", ".");
              if (/^\d*\.?\d*$/.test(raw)) {
                setRoundMinInput(raw);
              }
            }}
            onBlur={() => {
              let v = parseFloat(roundMinInput || "");
              if (Number.isNaN(v)) v = roundMin;
              v = Math.min(30, Math.max(0.25, v));
              const stepped = Math.round(v / 0.25) * 0.25;
              setRoundMin(stepped);
              setRoundMinInput(String(stepped));
            }}
            style={inputStyle}
          />
          <div
            style={{
              fontSize: "0.75rem",
              color: "#f9a8d4",
              marginTop: "0.25rem",
            }}
          >
            minutes
          </div>
        </div>
      </div>

      {/* Rest Time */}
      <div style={containerStyle}>
        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: "bold",
            color: "white",
            margin: 0,
          }}
        >
          Rest Time
        </h3>
        <div style={controlGroupStyle}>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            value={restMinutesInput}
            onChange={(e) => {
              const raw = e.target.value.replace(",", ".");
              if (/^\d*\.?\d*$/.test(raw)) {
                setRestMinutesInput(raw);
              }
            }}
            onBlur={() => {
              let v = parseFloat(restMinutesInput || "");
              if (Number.isNaN(v)) v = restMinutes;
              v = Math.min(10, Math.max(0.25, v));
              const stepped = Math.round(v / 0.25) * 0.25;
              setRestMinutes(stepped);
              setRestMinutesInput(String(stepped));
            }}
            style={inputStyle}
          />
          <div
            style={{
              fontSize: "0.75rem",
              color: "#f9a8d4",
              marginTop: "0.25rem",
            }}
          >
            minutes
          </div>
        </div>
      </div>
    </section>
  );
};
