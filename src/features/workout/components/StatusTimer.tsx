import "./StatusTimer.css";

type Status =
  | "ready"
  | "running"
  | "paused"
  | "stopped"
  | "resting"
  | "pre-round";

type StatusTimerProps = {
  time: string;
  round: number;
  totalRounds: number;
  status: Status;
  isResting: boolean;
  restTimeLeft: number;
  isPreRound: boolean;
  preRoundTimeLeft: number;
  fmtTime: (seconds: number) => string;
};

export default function StatusTimer({
  time,
  round,
  totalRounds,
  status,
  isResting,
  restTimeLeft,
  isPreRound,
  preRoundTimeLeft,
  fmtTime,
}: StatusTimerProps) {
  const statusColor = {
    ready: "#4ade80",
    running: "#60a5fa",
    paused: "#fbbf24",
    stopped: "#9ca3af",
    resting: "#a5b4fc",
    "pre-round": "#facc15",
  }[status];

  const statusText = {
    ready: "Ready to Start",
    running: "Training Active",
    paused: "Paused",
    stopped: "Session Complete",
    resting: "Rest Period",
    "pre-round": "Get Ready!",
  }[status];

  return (
    <div className="status-timer-container">
      {/* Now round count above status */}
      {round > 0 && (
        <div className="status-timer-round-info">
          <div className="status-timer-round-text">
            Round {round} of {totalRounds}
          </div>
          <div className="status-timer-dots">
            {Array.from({ length: totalRounds }).map((_, index) => (
              <div
                key={index}
                className={`status-timer-dot ${index < round ? 'is-active' : ''}`}
              />
            ))}
          </div>
        </div>
      )}
      <div className={`status-timer-text status--${status}`}>
        {statusText}
      </div>
      <div className="status-timer-display">
        {isResting
          ? fmtTime(restTimeLeft)
          : isPreRound
          ? preRoundTimeLeft
          : time}
      </div>
    </div>
  );
}