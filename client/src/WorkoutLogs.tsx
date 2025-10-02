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
      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to main page"
          style={{
            all: 'unset',
            cursor: 'pointer',
            color: 'white',
            padding: '0.625rem 1.125rem',
            borderRadius: '0.75rem',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.08)',
            fontSize: '0.875rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            transition: 'all 0.2s ease',
            marginBottom: '0.75rem'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <span style={{ fontSize: '1rem' }}>←</span>
          Back
        </button>
        <h2 style={{ margin: 0, color: 'white', fontSize: '1.25rem', textAlign: 'center' }}>Summary</h2>
      </div>

      {/* --- Compact Stats --- */}
      {stats && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(24, 24, 37, 0.48)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            position: 'relative',
            display: 'block'
          }}
        >
          {/* Favorite Style */}
          {favoriteConfig && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '0.5rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.8)'
              }}>
                <img
                  src={favoriteConfig.iconPath}
                  alt={favoriteConfig.label}
                  style={{ width: 24, height: 24, objectFit: 'contain' }}
                />
                <span>Favorite: {favoriteConfig.label}</span>
              </div>
            </div>
          )}
          
          {/* Streaks */}
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            fontSize: '0.8rem'
          }}>
            {/* Current Streak */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.25rem',
                marginBottom: '0.125rem'
              }}>
                <span style={{ fontSize: '1rem' }}>🔥</span>
                <span style={{ fontWeight: 700, color: 'white', fontSize: '1.125rem' }}>
                  {stats.current}
                </span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                Current Streak
              </div>
            </div>
            
            {/* Longest Streak */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.25rem',
                marginBottom: '0.125rem'
              }}>
                <span style={{ fontSize: '1rem' }}>🏆</span>
                <span style={{ fontWeight: 700, color: 'white', fontSize: '1.125rem' }}>
                  {stats.longest}
                </span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                Best Streak
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Log Entries */}
      <div ref={logsContainerRef}>
        {logs.length === 0 ? (
          <div style={{ 
            padding: '2rem', 
            background: 'rgba(24, 24, 37, 0.48)', 
            borderRadius: '0.75rem', 
            border: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}>📝</div>
            <p style={{ margin: 0, color: '#d1d5db', fontSize: '0.9rem' }}>
              No workouts logged yet.<br/>
              <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>Sessions are logged automatically when completed.</span>
            </p>
          </div>
        ) : (
          <>
            {/* Simple Activity Header */}
            <h3 style={{ 
              margin: '0 0 1rem 0',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'white'
            }}>
              Recent Workouts ({logs.length})
            </h3>
            
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {logs.slice().reverse().map((log, index) => {
                const isToday = new Date(log.timestamp).toDateString() === new Date().toDateString();
                const difficultyColors = {
                  easy: '#10b981',
                  medium: '#f59e0b', 
                  hard: '#ef4444'
                };
                const difficultyColor = difficultyColors[log.difficulty as keyof typeof difficultyColors] || '#6b7280';
                
                return (
                  <div 
                    key={log.id} 
                    style={{ 
                      position: 'relative',
                      padding: '1rem 2.5rem 1rem 1rem',
                      background: 'rgba(24, 24, 37, 0.48)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem'
                    }}
                  >
                    {/* Delete button */}
                    <button
                      onClick={() => deleteEntry(log.id)}
                      style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        padding: 0,
                        width: '1.5rem',
                        height: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '0.375rem',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = '#ef4444';
                        e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                        e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                        e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      }}
                      aria-label="Delete log"
                    >
                      ✕
                    </button>
                    
                    {/* Left: Date and Style */}
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '0.875rem', 
                        fontWeight: 600, 
                        color: 'white',
                        marginBottom: '0.25rem'
                      }}>
                        {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ 
                        fontSize: '0.8rem', 
                        color: 'rgba(255,255,255,0.7)'
                      }}>
                        {log.emphases.length ? log.emphases.join(', ') : 'Timer Only'}
                      </div>
                    </div>
                    
                    {/* Right: Stats */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1rem',
                      fontSize: '0.8rem'
                    }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: `${difficultyColor}15`,
                        color: difficultyColor,
                        borderRadius: '0.375rem',
                        fontSize: '0.7rem',
                        fontWeight: 600
                      }}>
                        {difficultyLabel(log.difficulty)}
                      </span>
                      <div style={{ 
                        textAlign: 'right',
                        color: 'rgba(255,255,255,0.8)'
                      }}>
                        <div>{log.roundsCompleted}/{log.roundsPlanned} rounds</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{log.roundLengthMin} min</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}