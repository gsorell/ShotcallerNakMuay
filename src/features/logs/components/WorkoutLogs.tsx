import { useEffect, useState } from "react";
// Deep imports rather than the style-share barrel: only the name and the
// sheet that edits it are wanted here, not the whole sharing flow.
import ShareNameSheet from "@/features/style-share/ShareNameSheet";
import {
  ensureSenderName,
  markSenderNameConfirmed,
  setSenderName,
} from "@/features/style-share/shareStorage";
import { ActionMenu, type ActionMenuItem } from "../../shared";
import CharmTrophyCase from "./CharmTrophyCase";
import "./WorkoutLogs.css";

// --- Icon mapping for favorite emphasis (update as needed) ---
const EMPHASIS_ICONS: Record<string, string> = {
  khao: "/assets/icon_knee.webp",
  mat: "/assets/icon_mat.webp",
  tae: "/assets/icon_tae.webp",
  femur: "/assets/icon_femur.webp",
  sok: "/assets/icon_sok.webp",
  boxing: "/assets/icon_boxing.webp",
  newb: "/assets/icon_newb.webp",
  two_piece: "/assets/icon_two_piece.webp",
  southpaw: "/assets/icon_southpaw.webp",
  // icon_timer.png has never existed - not on disk, not in git history - so
  // this silently fell through to the emoji. emphasisConfig and the editor's
  // constants both point timer_only at the stopwatch.
  timer_only: "/assets/icon.stopwatch.webp",
};

type WorkoutEntry = {
  id: string;
  timestamp: string;
  roundsPlanned: number;
  roundsCompleted: number;
  roundLengthMin: number;
  restMinutes?: number;
  difficulty?: string;
  shotsCalledOut?: number;
  emphases: string[];
  status?: "completed" | "abandoned";
  settings?: {
    selectedEmphases: any;
    addCalisthenics: boolean;
    readInOrder: boolean;
    southpawMode: boolean;
  };
};

type EmphasisListItem = {
  key: string;
  label: string;
  iconPath: string;
  emoji?: string;
  desc?: string;
};

const WORKOUTS_STORAGE_KEY = "shotcaller_workouts";

// Helper function to get local date string (YYYY-MM-DD) without timezone conversion
function getLocalDateString(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- Utility: Calculate streaks (days with at least one workout) ---
function calculateStreaks(logs: WorkoutEntry[]) {
  if (!logs.length) return { current: 0, longest: 0 };

  // Get unique workout days, sorted chronologically (using local timezone)
  const days = Array.from(
    new Set(
      logs.map((l) => getLocalDateString(l.timestamp))
    )
  ).sort((a, b) => a.localeCompare(b));

  if (days.length === 0) return { current: 0, longest: 0 };
  if (days.length === 1) return { current: 1, longest: 1 };

  // Calculate longest streak
  let longest = 1,
    current = 1,
    max = 1;
  for (let i = 1; i < days.length; ++i) {
    const prev = new Date(days[i - 1]!);
    const curr = new Date(days[i]!);
    const diff = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 1) {
      current += 1;
      if (current > max) max = current;
    } else {
      current = 1;
    }
  }

  // Calculate current streak (must end on today or yesterday to be "current", using local timezone)
  const today = getLocalDateString(new Date().toISOString());
  const yesterday = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const lastWorkoutDay = days[days.length - 1];

  // Only count as current streak if last workout was today or yesterday
  if (lastWorkoutDay !== today && lastWorkoutDay !== yesterday) {
    return { current: 0, longest: max };
  }

  // Count backwards from the most recent workout day
  let currentStreak = 1;
  for (let i = days.length - 1; i > 0; --i) {
    const prev = new Date(days[i - 1]!);
    const curr = new Date(days[i]!);
    const diff = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 1) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  return { current: currentStreak, longest: max };
}

// Utility to normalize emphasis for icon lookup
function normalizeEmphasis(emphasis: string) {
  // Try to match keys like "tae", "mat", etc.
  const key = emphasis
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "") // remove spaces and special chars
    .replace(
      /(muay|mat|tae|khao|femur|sok|boxing|newb|two_piece|southpaw|timeronly)/,
      (m) => m
    ); // allow all keys
  // fallback to original if not found
  return EMPHASIS_ICONS[key]
    ? key
    : emphasis.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export default function WorkoutLogs({
  onBack,
  emphasisList,
  onResume,
  onViewCompletion,
}: {
  onBack: () => void;
  emphasisList: EmphasisListItem[];
  onResume?: (log: WorkoutEntry) => void;
  onViewCompletion?: (log: WorkoutEntry) => void;
}) {
  const [logs, setLogs] = useState<WorkoutEntry[]>([]);

  // The name on the card is the one the user set for sharing — the only name
  // the app has for them. Resolved on mount, so someone who never chose one
  // still sees the name they have been given rather than a blank.
  const [fighterName, setFighterName] = useState(() => ensureSenderName());
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
      if (!raw) {
        setLogs([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setLogs([]);
        return;
      }
      const normalized: WorkoutEntry[] = parsed.map((p: any, i: number) => ({
        id: String(p?.id ?? `log-${i}-${Date.now()}`),
        timestamp: String(p?.timestamp ?? new Date().toISOString()),
        roundsPlanned: Number.isFinite(Number(p?.roundsPlanned))
          ? Number(p.roundsPlanned)
          : 0,
        roundsCompleted: Number.isFinite(Number(p?.roundsCompleted))
          ? Number(p.roundsCompleted)
          : 0,
        roundLengthMin: Number.isFinite(Number(p?.roundLengthMin))
          ? Number(p.roundLengthMin)
          : 0,
        restMinutes: Number.isFinite(Number(p?.restMinutes))
          ? Number(p.restMinutes)
          : undefined,
        difficulty:
          typeof p?.difficulty === "string" ? p.difficulty : undefined,
        shotsCalledOut: Number.isFinite(Number(p?.shotsCalledOut))
          ? Number(p.shotsCalledOut)
          : undefined,
        emphases: Array.isArray(p?.emphases) ? p.emphases.map(String) : [],
        // Infer status for old entries that don't have it
        status:
          p?.status ||
          (p?.roundsCompleted >= p?.roundsPlanned ? "completed" : "abandoned"),
        settings: p?.settings,
      }));
      setLogs(normalized);
    } catch {
      setLogs([]);
    }
  }, []);

  const persist = (next: WorkoutEntry[]) => {
    try {
      localStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(next));
      setLogs(next);
    } catch {
      /* ignore */
    }
  };

  const deleteEntry = (id: string) => {
    if (!window.confirm("Delete this log entry?")) return;
    persist(logs.filter((l) => l.id !== id));
  };

  const difficultyLabel = (diff?: string) =>
    diff === "easy"
      ? "Novice"
      : diff === "medium"
      ? "Amateur"
      : diff === "hard"
      ? "Pro"
      : undefined;

  // --- Compute summary stats ---
  const stats = (() => {
    if (!logs.length) return null;
    const totalWorkouts = logs.length;
    const totalRounds = logs.reduce(
      (sum, l) => sum + (l.roundsCompleted || 0),
      0
    );
    const totalMinutes = logs.reduce(
      (sum, l) => sum + l.roundsCompleted * l.roundLengthMin,
      0
    );
    const emphasesCount: Record<string, number> = {};
    logs.forEach((l) =>
      l.emphases.forEach((e) => {
        emphasesCount[e] = (emphasesCount[e] || 0) + 1;
      })
    );
    const mostCommonEmphasis =
      Object.entries(emphasesCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const streaks = calculateStreaks(logs);
    return {
      totalWorkouts,
      totalRounds,
      totalMinutes,
      mostCommonEmphasis,
      ...streaks,
    };
  })();

  // --- Responsive summary/favorite layout ---
  // Find the favorite emphasis config by label (case-insensitive)
  const favoriteConfig = stats?.mostCommonEmphasis
    ? emphasisList.find(
        (e) =>
          e.label.trim().toLowerCase() ===
          stats.mostCommonEmphasis.trim().toLowerCase()
      )
    : null;

  // Sessions are listed under the day they happened, newest first. The day
  // is said once, as a heading, instead of being repeated in full on every
  // row — which is also where "Today" belongs: it names a group, not a row.
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayStart = startOfDay(new Date());
  const dayLabel = (d: Date) => {
    const daysAgo = Math.round((todayStart - startOfDay(d)) / 86400000);
    if (daysAgo === 0) return "Today";
    if (daysAgo === 1) return "Yesterday";
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(d.getFullYear() !== new Date().getFullYear()
        ? { year: "numeric" }
        : null),
    });
  };

  const days: { label: string; entries: WorkoutEntry[] }[] = [];
  for (const log of logs.slice().reverse()) {
    const label = dayLabel(new Date(log.timestamp));
    const last = days[days.length - 1];
    if (last && last.label === label) last.entries.push(log);
    else days.push({ label, entries: [log] });
  }

  // The picture on a row is the style that was trained — the first, where
  // there were several. A session with no style of its own (a bare timer, a
  // guided level) wears the app's mark.
  const iconFor = (log: WorkoutEntry) => {
    const first = (log.emphases[0] ?? "").trim().toLowerCase();
    const match = emphasisList.find(
      (e) => e.label.trim().toLowerCase() === first
    );
    return match?.iconPath ?? "/assets/logo_icon.webp";
  };

  return (
    <div className="logs-page">
      <div className="logs-back-row">
        <button type="button" className="back-link" onClick={onBack}>
          <span className="back-link-arrow" aria-hidden="true">
            ←
          </span>
          Back
        </button>
      </div>

      {/* Named for what the menu calls it. It used to be titled "Summary",
          which is a section of this page rather than the page. */}
      <h1 className="logs-title">Workout Logs</h1>
      <p className="logs-subtitle">Your record, and every session behind it.</p>

      {/* The fighter card: who this is, then their record.

          It is shown from the first visit, before there is anything to
          count — the name is already theirs, and a row of zeros says what
          will fill in more plainly than a card that is not there. */}
      <section className="fighter-card" aria-label="Fighter">
        <div className="fighter-card-head">
          <img
            className="fighter-card-avatar"
            // Their favourite style stands in as the avatar; the app's own
            // mark until they have trained enough to have one.
            src={favoriteConfig?.iconPath ?? "/assets/logo_icon.webp"}
            alt=""
          />
          {/* Name first, with the pencil that edits it right beside it —
              the control sits against the thing it changes, not across the
              card from it. One fact underneath, on one line. */}
          <div className="fighter-card-identity">
            <div className="fighter-card-name-row">
              <span className="fighter-card-name">{fighterName}</span>
              <button
                type="button"
                className="fighter-card-edit"
                onClick={() => setEditingName(true)}
                title="Change name"
                aria-label="Change name"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M11.2 2.3a1.4 1.4 0 0 1 2 0l.5.5a1.4 1.4 0 0 1 0 2L6 12.5l-3 .7.7-3 7.5-7.9Z" />
                  <path d="m10 3.6 2.4 2.4" />
                </svg>
              </button>
            </div>
            {favoriteConfig && (
              <span className="fighter-card-favorite">
                Favorite style · {favoriteConfig.label}
              </span>
            )}
          </div>
        </div>

        <div className="fighter-stats">
          <div className="fighter-stat">
            <span className="fighter-stat-value">🔥 {stats?.current ?? 0}</span>
            <span className="fighter-stat-label">Day streak</span>
          </div>
          <div className="fighter-stat">
            <span className="fighter-stat-value">🏆 {stats?.longest ?? 0}</span>
            <span className="fighter-stat-label">Best streak</span>
          </div>
          <div className="fighter-stat">
            <span className="fighter-stat-value">
              {stats?.totalWorkouts ?? 0}
            </span>
            <span className="fighter-stat-label">Workouts</span>
          </div>
          <div className="fighter-stat">
            <span className="fighter-stat-value">{stats?.totalRounds ?? 0}</span>
            <span className="fighter-stat-label">Rounds</span>
          </div>
        </div>

        {stats && (
          <div className="fighter-charms">
            <span className="fighter-card-section-label">Charms</span>
            <CharmTrophyCase
              currentStreak={stats.current}
              longestStreak={stats.longest}
            />
          </div>
        )}
      </section>

      {editingName && (
        <ShareNameSheet
          initialName={fighterName}
          mode="edit"
          onCancel={() => setEditingName(false)}
          onConfirm={(next) => {
            setSenderName(next);
            // Choosing it here counts as confirming, so the first share does
            // not stop to ask again.
            markSenderNameConfirmed();
            setFighterName(next);
            setEditingName(false);
          }}
        />
      )}

      {logs.length === 0 ? (
        <div className="logs-empty">
          <p className="logs-empty-title">No workouts logged yet</p>
          <p className="logs-empty-body">
            Sessions are logged automatically when you finish or stop one.
          </p>
        </div>
      ) : (
        <>
          <div className="logs-section-head">
            <h2>Recent workouts</h2>
            <span className="logs-section-count">{logs.length}</span>
          </div>

          {days.map((day) => (
            <section key={day.label} className="logs-day">
              <h3 className="logs-day-label">{day.label}</h3>
              <div className="logs-list">
                {day.entries.map((log) => {
                  const when = new Date(log.timestamp);
                  const time = when.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  const level = difficultyLabel(log.difficulty);
                  const finished = log.status === "completed";
                  const canResume =
                    !finished &&
                    log.roundsCompleted < log.roundsPlanned &&
                    Boolean(onResume);
                  const canView = finished && Boolean(onViewCompletion);
                  const title = log.emphases.length
                    ? log.emphases.length > 3
                      ? `${log.emphases.slice(0, 3).join(", ")} +${
                          log.emphases.length - 3
                        } more`
                      : log.emphases.join(", ")
                    : "Timer Only";

                  // The row's one action, said in words: finish what was
                  // started, or look at what was finished.
                  const primary = canResume
                    ? {
                        label: "Resume",
                        hint: `Resume from round ${log.roundsCompleted + 1}`,
                        run: () => onResume?.(log),
                      }
                    : canView
                    ? {
                        label: "View result",
                        hint: "View result",
                        run: () => onViewCompletion?.(log),
                      }
                    : null;

                  const actions: ActionMenuItem[] = [];
                  if (primary) {
                    actions.push({
                      label: primary.hint,
                      icon: canResume ? "▶" : "🏆",
                      onSelect: primary.run,
                    });
                  }
                  actions.push({
                    label: "Delete log",
                    icon: "✕",
                    onSelect: () => deleteEntry(log.id),
                    destructive: true,
                  });

                  return (
                    <article key={log.id} className="log-row">
                      <img className="log-row-icon" src={iconFor(log)} alt="" />

                      <div className="log-row-main">
                        <div className="log-row-title">{title}</div>
                        <div className="log-row-meta">
                          {[
                            time,
                            level,
                            `${log.roundsPlanned} × ${log.roundLengthMin} min`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                        <div className="log-row-status">
                          <span
                            className={`log-row-outcome ${
                              finished ? "is-finished" : ""
                            }`}
                          >
                            {finished
                              ? "Completed"
                              : `${log.roundsCompleted} of ${log.roundsPlanned} rounds`}
                          </span>
                          {primary && (
                            <button
                              type="button"
                              className="log-row-action"
                              onClick={primary.run}
                              aria-label={primary.hint}
                            >
                              {primary.label}
                            </button>
                          )}
                        </div>
                      </div>

                      <ActionMenu
                        subject={`${title}, ${day.label} ${time}`}
                        items={actions}
                      />
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
