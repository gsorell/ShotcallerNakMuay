import { WORKOUTS_STORAGE_KEY } from "@/constants/storage";

/** Marks a log entry as a guided-path session rather than a style workout. */
export interface RoadmapLogRef {
  pathId: string;
  levelId: number;
  /** Pre-rendered label, so history renders without loading the path data. */
  label: string;
}

export function createWorkoutLogEntry(
  settings: any,
  timer: any,
  shotsCalledOut: number,
  emphasisList: any[],
  status: "completed" | "abandoned",
  roadmap?: RoadmapLogRef | null
) {
  // Calculate completed rounds
  let roundsCompleted = settings.roundsCount;
  if (status === "abandoned") {
    if (timer.currentRound > 0) {
      roundsCompleted = timer.isResting
        ? timer.currentRound
        : Math.max(0, timer.currentRound - 1);
    }
    if (!timer.running && timer.currentRound > settings.roundsCount) {
      roundsCompleted = settings.roundsCount;
    }
  }

  // A roadmap session has no emphasis selected — it sets the callout pool
  // directly — so it supplies its own label. Without this the entry would show
  // up in history as a workout with no style at all.
  const emphasesLabels = roadmap
    ? [roadmap.label]
    : Object.entries(settings.selectedEmphases)
        .filter(([, v]) => v)
        .map(([k]) => {
          const found = emphasisList.find((e) => e.key === k);
          return found ? found.label : k;
        });

  const entry = {
    id: `${Date.now()}`,
    timestamp: new Date().toISOString(),
    roundsPlanned: settings.roundsCount,
    roundsCompleted,
    roundLengthMin: settings.roundMin,
    restMinutes: settings.restMinutes,
    difficulty: settings.difficulty,
    shotsCalledOut: shotsCalledOut,
    emphases: emphasesLabels,
    status: status,
    ...(roadmap ? { roadmap } : {}),
    settings: {
      selectedEmphases: settings.selectedEmphases,
      addCalisthenics: settings.addCalisthenics,
      readInOrder: settings.readInOrder,
      southpawMode: settings.southpawMode,
    },
  };

  try {
    const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(entry);
    localStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(arr));
  } catch (err) {
    console.error("Failed to save log", err);
  }

  return entry;
}
