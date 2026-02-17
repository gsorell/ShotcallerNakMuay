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
  isInterruptedByCall?: boolean;
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
  isInterruptedByCall = false,
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

      {paused && isInterruptedByCall && (
        <div className="active-session-call-interruption">
          <div className="call-interruption-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
          </div>
          <div className="call-interruption-text">
            Session paused due to incoming call
          </div>
          <div className="call-interruption-hint">
            Tap Resume to continue your workout
          </div>
        </div>
      )}

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
