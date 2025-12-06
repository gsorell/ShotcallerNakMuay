import { WORKOUTS_STORAGE_KEY } from "../constants/storage";

export function createWorkoutLogEntry(
  settings: any,
  timer: any,
  shotsCalledOut: number,
  emphasisList: any[],
  status: "completed" | "abandoned"
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

  const emphasesLabels = Object.entries(settings.selectedEmphases)
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
