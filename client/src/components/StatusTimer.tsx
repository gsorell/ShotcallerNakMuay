import React from 'react';

type Status =
  | 'ready'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'resting'
  | 'pre-round';

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
}: {
  time: string;
  round: number;
  totalRounds: number;
  status: Status;
  isResting: boolean;
  restTimeLeft: number;
  isPreRound: boolean;
  preRoundTimeLeft: number;
  fmtTime: (seconds: number) => string;
}) {
  const statusColor = {
    ready: '#4ade80',
    running: '#60a5fa',
    paused: '#fbbf24',
    stopped: '#9ca3af',
    resting: '#a5b4fc',
    'pre-round': '#facc15',
  }[status];
  const statusText = {
    ready: 'Ready to Start',
    running: 'Training Active',
    paused: 'Paused',
    stopped: 'Session Complete',
    resting: 'Rest Period',
    'pre-round': 'Get Ready!',
  }[status];
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 0,
        textAlign: 'center',
      }}
    >
      {/* Now round count above status */}
      {round > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.875rem',
              color: '#f9a8d4',
              textAlign: 'center',
            }}
          >
            Round {round} of {totalRounds}
          </div>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px',
            }}
          >
            {Array.from({ length: totalRounds }).map((_, index) => (
              <div
                key={index}
                style={{
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%',
                  transition: 'background-color 0.3s',
                  backgroundColor:
                    index < round
                      ? '#f9a8d4'
                      : 'rgba(255,255,255,0.2)',
                  border:
                    index < round
                      ? '1px solid #ec4899'
                      : '1px solid rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </div>
        </div>
      )}
      <div
        style={{
          fontSize: '1.125rem',
          fontWeight: 'bold',
          color: statusColor,
          marginBottom: '1rem',
          textAlign: 'center',
        }}
      >
        {statusText}
      </div>
      <div style={{ textAlign: 'center', marginBottom: '1rem', width: '100%' }}>
        <div
          className="main-timer"
          style={{
            fontSize: '8rem',
            fontWeight: 900,
            color: 'white',
            letterSpacing: '0.05em',
            textShadow: '0 4px 8px rgba(0,0,0,0.3)',
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            textAlign: 'center',
            width: '100%',
            margin: '0 auto',
          }}
        >
          {isResting
            ? fmtTime(restTimeLeft)
            : isPreRound
            ? preRoundTimeLeft
            : time}
        </div>
      </div>
    </div>
  );
}