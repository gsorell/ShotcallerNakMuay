import { useEffect, useState } from 'react';
import './editor.css';

type WorkoutEntry = {
  id: string;
  timestamp: string;
  roundsPlanned: number;
  roundsCompleted: number;
  roundLengthMin: number;
  difficulty?: string;
  shotsCalledOut?: number;
  emphases: string[];
};

const WORKOUTS_STORAGE_KEY = 'shotcaller_workouts';

export default function WorkoutLogs({ onBack }: { onBack: () => void }) {
  const [logs, setLogs] = useState<WorkoutEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
      if (!raw) { setLogs([]); return; }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) { setLogs([]); return; }
      const normalized: WorkoutEntry[] = parsed.map((p: any, i: number) => ({
        id: String(p?.id ?? `log-${i}-${Date.now()}`),
        timestamp: String(p?.timestamp ?? new Date().toISOString()),
        roundsPlanned: Number.isFinite(Number(p?.roundsPlanned)) ? Number(p.roundsPlanned) : 0,
        roundsCompleted: Number.isFinite(Number(p?.roundsCompleted)) ? Number(p.roundsCompleted) : 0,
        roundLengthMin: Number.isFinite(Number(p?.roundLengthMin)) ? Number(p.roundLengthMin) : 0,
        difficulty: typeof p?.difficulty === 'string' ? p.difficulty : undefined,
        shotsCalledOut: Number.isFinite(Number(p?.shotsCalledOut)) ? Number(p.shotsCalledOut) : undefined,
        emphases: Array.isArray(p?.emphases) ? p.emphases.map(String) : []
      }));
      setLogs(normalized);
    } catch {
      setLogs([]);
    }
  }, []);

  const persist = (next: WorkoutEntry[]) => {
    try { localStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(next)); setLogs(next); } catch { /* ignore */ }
  };

  const deleteEntry = (id: string) => { if (!window.confirm('Delete this log entry?')) return; persist(logs.filter(l => l.id !== id)); };

  const difficultyLabel = (diff?: string) =>
    diff === 'easy' ? 'Amateur' :
    diff === 'medium' ? 'Pro' :
    diff === 'hard' ? 'Legend' :
    undefined;

  return (
    <div className="editor-root">
      {/* Header with Back button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to main page"
          style={{
            all: 'unset',
            cursor: 'pointer',
            color: '#f9a8d4',
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.06)'
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, color: 'white', fontSize: '1.25rem' }}>Workout Logs</h2>
        <div style={{ width: '4rem' }} />
      </div>

      {logs.length === 0 ? (
        <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ margin: 0, textAlign: 'center', color: '#d1d5db' }}>No workouts logged yet. Sessions are logged automatically when they are stopped or completed.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {logs.slice().reverse().map(log => (
            <div key={log.id} className="log-card log-card-flex" style={{ position: 'relative' }}>
              {/* Delete button at top right */}
              <button
                className="icon-btn log-delete-btn"
                onClick={() => deleteEntry(log.id)}
                aria-label="Delete log"
              >✕</button>
              {/* Left: Date & Time */}
              <div className="log-card-left">
                <div className="log-date">{new Date(log.timestamp).toLocaleString()}</div>
              </div>
              {/* Center: Emphases, Difficulty, Shots Called Out */}
              <div className="log-card-center">
                <div className="log-meta">{log.emphases.length ? log.emphases.join(', ') : 'No emphasis selected'}</div>
                {difficultyLabel(log.difficulty) && (
                  <div className="log-meta">Difficulty: {difficultyLabel(log.difficulty)}</div>
                )}
                {typeof log.shotsCalledOut === 'number' && (
                  <div className="log-meta">Shots Called Out: {log.shotsCalledOut}</div>
                )}
              </div>
              {/* Right: Rounds, Length */}
              <div className="log-card-right">
                <div className="log-rounds">{log.roundsCompleted}/{log.roundsPlanned} rounds</div>
                <div className="log-meta">{log.roundLengthMin} min</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}