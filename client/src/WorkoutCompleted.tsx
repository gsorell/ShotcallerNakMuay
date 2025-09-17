import React from 'react';

interface WorkoutCompletedProps {
  stats: {
    timestamp: string;
    emphases: string[];
    difficulty: string;
    shotsCalledOut: number;
    roundsCompleted: number;
    roundsPlanned: number;
    roundLengthMin: number;
  };
  onRestart: () => void;
  onReset: () => void;
  onViewLog: () => void;
}

export default function WorkoutCompleted({ stats, onRestart, onReset, onViewLog }: WorkoutCompletedProps) {
  return (
    <div style={{
      maxWidth: 600,
      margin: '2rem auto',
      background: 'rgba(24,24,36,0.85)',
      borderRadius: 16,
      padding: '2rem',
      color: 'white',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src="/assets/icon_stacked.png" alt="Logo" style={{ maxWidth: 180, marginBottom: 16 }} />
        <h2 style={{ margin: 0, color: '#f9a8d4' }}>Workout Complete!</h2>
      </div>
      <div style={{
        background: 'linear-gradient(90deg,#581c87 0%,#155e75 100%)',
        borderRadius: 12,
        padding: '1.25rem 1.5rem',
        marginBottom: 24,
        color: '#fff',
        fontSize: '1.05rem'
      }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>
          {new Date(stats.timestamp).toLocaleString()}
        </div>
        <div>
          <span style={{ color: '#f9a8d4', fontWeight: 700 }}>{stats.emphases.join(', ')}</span>
        </div>
        <div style={{ color: '#cbd5e1', margin: '4px 0' }}>
          Difficulty: <span style={{ color: '#f9a8d4' }}>{stats.difficulty}</span>
        </div>
        <div style={{ color: '#cbd5e1', margin: '4px 0' }}>
          Shots Called Out: <span style={{ color: '#f9a8d4' }}>{stats.shotsCalledOut}</span>
        </div>
        <div style={{ color: '#cbd5e1', margin: '4px 0' }}>
          <span style={{ color: '#f9a8d4', fontWeight: 700 }}>
            {stats.roundsCompleted}/{stats.roundsPlanned} rounds
          </span>
        </div>
        <div style={{ color: '#cbd5e1', margin: '4px 0' }}>
          {stats.roundLengthMin} min/round
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16 }}>
        <button onClick={onRestart} style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '0.75rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>Restart</button>
        <button onClick={onReset} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '0.75rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>Home</button>
        <button onClick={onViewLog} style={{ background: '#f9a8d4', color: '#181825', border: 'none', borderRadius: 8, padding: '0.75rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>View Log</button>
      </div>
    </div>
  );
}