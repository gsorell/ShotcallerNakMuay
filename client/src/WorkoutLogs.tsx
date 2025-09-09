import { useEffect, useState } from 'react';
import './editor.css';

type WorkoutEntry = {
  id: string;
  timestamp: string;
  roundsPlanned: number;
  roundsCompleted: number;
  roundLengthMin: number;
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

  // remove clearLogs(); only individual deletes retained
  const deleteEntry = (id: string) => { if (!window.confirm('Delete this log entry?')) return; persist(logs.filter(l => l.id !== id)); };

  return (
    <div className="editor-root">
      <div className="editor-panel" style={{ paddingBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2>Workout Logs</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={onBack} className="btn btn-ghost" aria-label="Back to timer">Back</button>
            {/* removed "Clear all" button intentionally */}
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem' }}>
          <p style={{ margin: 0 }}>No workouts logged yet. Sessions are logged automatically at completion or on stop.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {logs.slice().reverse().map(log => (
            <div key={log.id} className="log-card" role="article" aria-labelledby={`log-${log.id}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
                <div>
                  <div id={`log-${log.id}`} style={{ fontWeight: 700 }}>{new Date(log.timestamp).toLocaleString()}</div>
                  <div className="log-meta">{log.emphases.length ? log.emphases.join(', ') : 'No emphasis selected'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{log.roundsCompleted}/{log.roundsPlanned} rounds</div>
                  <div className="log-meta">{log.roundLengthMin} min</div>
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => deleteEntry(log.id)} className="btn icon-btn icon-btn--danger" aria-label={`Delete log ${log.id}`}>✕</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}