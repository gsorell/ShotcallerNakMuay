import React from "react";
import { type EmphasisKey } from "@/types";
import { ImageWithFallback } from "../../shared";
import StatusTimer from "./StatusTimer";
import "./ActiveSessionUI.css";


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
    <div className="active-session-container">
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
          className="active-session-callout"
        >
          {currentCallout}
        </div>
      )}

      <section className="active-session-controls">
        <div className="active-session-controls-inner">
          <button
            onClick={onPause}
            className={`active-session-control-btn ${paused ? 'btn-pause' : 'btn-pause'}`}
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
            <span>
              {paused ? "Resume" : "Pause"}
            </span>
          </button>
          <button
            onClick={onStop}
            className="active-session-control-btn btn-stop"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z" />
            </svg>
            <span>Stop</span>
          </button>
        </div>
      </section>

      {emphasisList.some((e) => selectedEmphases[e.key as EmphasisKey]) && (
        <section
          aria-label="Selected styles"
          className="active-session-styles"
        >
          <div className="active-session-styles-title">
            Selected Styles
          </div>
          <div className="active-session-styles-grid">
            {emphasisList
              .filter((e) => selectedEmphases[e.key as EmphasisKey])
              .map((e) => (
                <div
                  key={e.key}
                  className="active-session-style-chip"
                  title={e.desc}
                >
                  <ImageWithFallback
                    srcPath={e.iconPath}
                    alt={e.label}
                    emoji={e.emoji}
                  />
                  <span>{e.label}</span>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
