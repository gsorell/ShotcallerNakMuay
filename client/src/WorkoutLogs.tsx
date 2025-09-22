import { useEffect, useState, useRef } from 'react';
import './editor.css';

// --- Icon mapping for favorite emphasis (update as needed) ---
const EMPHASIS_ICONS: Record<string, string> = {
  khao: '/assets/icon_khao.png',
  mat: '/assets/icon_mat.png',
  tae: '/assets/icon_tae.png',
  femur: '/assets/icon_femur.png',
  sok: '/assets/icon_sok.png',
  boxing: '/assets/icon_boxing.png',
  newb: '/assets/icon_newb.png',
  two_piece: '/assets/icon_two_piece.png',
  southpaw: '/assets/icon_southpaw.png',
  timer_only: '/assets/icon_timer.png',
};

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

type EmphasisListItem = {
  key: string;
  label: string;
  iconPath: string;
  emoji?: string;
  desc?: string;
};

const WORKOUTS_STORAGE_KEY = 'shotcaller_workouts';

// --- Utility: Calculate streaks (days with at least one workout) ---
function calculateStreaks(logs: WorkoutEntry[]) {
  if (!logs.length) return { current: 0, longest: 0 };
  const days = Array.from(
    new Set(
      logs
        .map((l) => new Date(l.timestamp).toISOString().slice(0, 10))
        .sort((a, b) => a.localeCompare(b))
    )
  );
  let longest = 1, current = 1, max = 1;
  for (let i = 1; i < days.length; ++i) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      current += 1;
      if (current > max) max = current;
    } else {
      current = 1;
    }
  }
  let streak = 1;
  for (let i = days.length - 1; i > 0; --i) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) streak += 1;
    else break;
  }
  return { current: streak, longest: max };
}

// Utility to normalize emphasis for icon lookup
function normalizeEmphasis(emphasis: string) {
  // Try to match keys like "tae", "mat", etc.
  const key = emphasis
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '') // remove spaces and special chars
    .replace(/(muay|mat|tae|khao|femur|sok|boxing|newb|two_piece|southpaw|timeronly)/, m => m); // allow all keys
  // fallback to original if not found
  return EMPHASIS_ICONS[key] ? key : emphasis.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export default function WorkoutLogs({
  onBack,
  emphasisList
}: {
  onBack: () => void;
  emphasisList: EmphasisListItem[];
}) {
  const [logs, setLogs] = useState<WorkoutEntry[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to top when WorkoutLogs mounts (especially for mobile)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

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

  // --- Compute summary stats ---
  const stats = (() => {
    if (!logs.length) return null;
    const totalWorkouts = logs.length;
    const totalRounds = logs.reduce((sum, l) => sum + (l.roundsCompleted || 0), 0);
    const totalMinutes = logs.reduce((sum, l) => sum + (l.roundsCompleted * l.roundLengthMin), 0);
    const emphasesCount: Record<string, number> = {};
    logs.forEach(l => l.emphases.forEach(e => { emphasesCount[e] = (emphasesCount[e] || 0) + 1; }));
    const mostCommonEmphasis = Object.entries(emphasesCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const streaks = calculateStreaks(logs);
    return { totalWorkouts, totalRounds, totalMinutes, mostCommonEmphasis, ...streaks };
  })();

  // --- Get log card width for summary/favorite alignment ---
  const [logsWidth, setLogsWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function updateWidth() {
      if (logsContainerRef.current) {
        setLogsWidth(logsContainerRef.current.offsetWidth);
      }
    }
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // --- Responsive summary/favorite layout ---
  // Find the favorite emphasis config by label (case-insensitive)
  const favoriteConfig = stats?.mostCommonEmphasis
    ? emphasisList.find(
        e => e.label.trim().toLowerCase() === stats.mostCommonEmphasis.trim().toLowerCase()
      )
    : null;

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

      {/* --- Workout Summary + Favorite --- */}
      {stats && (
        <div
          className="main-container"
          style={{
            display: 'flex',
            gap: '2rem',
            justifyContent: 'center',
            alignItems: 'stretch',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            maxWidth: 900,
            marginLeft: 'auto',
            marginRight: 'auto'
          }}
        >
          {/* Summary Card */}
          <div
            style={{
              flex: '1 1 320px',
              minWidth: 260,
              maxWidth: 480,
              padding: '1.5rem 2rem',
              background: 'rgba(24, 24, 37, 0.72)',
              border: '1.5px solid rgba(139,92,246,0.13)',
              borderRadius: '1.25rem',
              color: '#fff',
              boxShadow: '0 2px 16px 0 rgba(139,92,246,0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div style={{
              fontWeight: 700,
              fontSize: '1.13rem',
              letterSpacing: '0.01em',
              marginBottom: '1.1rem',
              color: '#a5b4fc'
            }}>
              Workout Summary
            </div>
            <div style={{
              display: 'flex',
              gap: '2rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '1.08rem',
              fontWeight: 500,
              letterSpacing: '0.01em'
            }}>
              <div title="Total sessions completed">
                <span style={{ fontWeight: 700 }}>{stats.totalWorkouts}</span>
                <span style={{ opacity: 0.85 }}> sessions</span>
              </div>
              <div title="Total rounds completed">
                <span style={{ fontWeight: 700 }}>{stats.totalRounds}</span>
                <span style={{ opacity: 0.85 }}> rounds</span>
              </div>
              <div title="Total minutes trained">
                <span style={{ fontWeight: 700 }}>{stats.totalMinutes}</span>
                <span style={{ opacity: 0.85 }}> min</span>
              </div>
            </div>
            <div style={{
              display: 'flex',
              gap: '2rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '1.1rem',
              fontSize: '1.08rem',
              fontWeight: 500,
              letterSpacing: '0.01em'
            }}>
              <div title="Current streak: consecutive days with a workout" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span role="img" aria-label="flame">🔥</span>
                <span style={{ fontWeight: 700 }}>{stats.current}</span>
                <span style={{ opacity: 0.85 }}> day streak</span>
              </div>
              <div title="Longest streak: most consecutive days with a workout" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span role="img" aria-label="trophy">🏆</span>
                <span style={{ fontWeight: 700 }}>{stats.longest}</span>
                <span style={{ opacity: 0.85 }}> day - longest streak</span>
              </div>
            </div>
          </div>
          {/* Favorite Card */}
          {favoriteConfig && (
            <div
              style={{
                flex: '0 1 180px',
                minWidth: 160,
                maxWidth: 220,
                padding: '1.2rem 1.2rem 1rem 1.2rem',
                background: 'rgba(24, 24, 37, 0.72)',
                border: '1.5px solid rgba(139,92,246,0.13)',
                borderRadius: '1.25rem',
                color: '#fff',
                boxShadow: '0 2px 16px 0 rgba(139,92,246,0.08)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div style={{
                fontWeight: 700,
                fontSize: '1.08rem',
                letterSpacing: '0.01em',
                marginBottom: '0.7rem',
                color: '#a5b4fc'
              }}>
                Favorite
              </div>
              <div style={{ marginBottom: '0.7rem', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={favoriteConfig.iconPath}
                  alt={favoriteConfig.label}
                  style={{ width: 48, height: 48, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px #0006)' }}
                />
              </div>
              <div style={{ fontWeight: 600, fontSize: '1.08rem', textAlign: 'center', wordBreak: 'break-word' }}>
                {favoriteConfig.label}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log items (unchanged) */}
      <div ref={logsContainerRef}>
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
    </div>
  );
}