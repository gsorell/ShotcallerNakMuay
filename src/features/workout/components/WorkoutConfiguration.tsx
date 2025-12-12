import React, { useEffect, useState } from "react";
import { useWorkoutContext } from "../contexts/WorkoutProvider";
import "./WorkoutConfiguration.css";

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


  return (
    <section className="workout-config-section">
      {/* Number of Rounds */}
      <div className="workout-config-container">
        <h3 className="workout-config-title">
          Number of Rounds
        </h3>
        <div className="workout-config-group">
          <button
            type="button"
            onClick={() => setRoundsCount(Math.max(1, roundsCount - 1))}
            className="workout-config-chip-btn"
          >
            −
          </button>
          <div className="workout-config-value-container">
            <div className="workout-config-value">
              {roundsCount}
            </div>
            <div className="workout-config-label">
              rounds
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRoundsCount(Math.min(20, roundsCount + 1))}
            className="workout-config-chip-btn"
          >
            +
          </button>
        </div>
      </div>

      {/* Round Length */}
      <div className="workout-config-container">
        <h3 className="workout-config-title">
          Round Length
        </h3>
        <div className="workout-config-group">
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
            className="workout-config-input"
          />
          <div className="workout-config-label">
            minutes
          </div>
        </div>
      </div>

      {/* Rest Time */}
      <div className="workout-config-container">
        <h3 className="workout-config-title">
          Rest Time
        </h3>
        <div className="workout-config-group">
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
            className="workout-config-input"
          />
          <div className="workout-config-label">
            minutes
          </div>
        </div>
      </div>
    </section>
  );
};
