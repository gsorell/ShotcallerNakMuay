import {
  CHARMS_SEEDED_FLAG,
  CHARMS_STORAGE_KEY,
  WORKOUTS_STORAGE_KEY,
} from "@/constants/storage";
import {
  ACHIEVEMENT_CHARMS,
  type Charm,
  type WorkoutLogLite,
} from "../constants/charms";

/** Reads the workout history from localStorage, normalized to what charms need. */
export function readWorkoutHistory(): WorkoutLogLite[] {
  try {
    const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p: any) => ({
      timestamp: String(p?.timestamp ?? new Date().toISOString()),
      emphases: Array.isArray(p?.emphases) ? p.emphases.map(String) : [],
      roundsCompleted: Number.isFinite(Number(p?.roundsCompleted))
        ? Number(p.roundsCompleted)
        : 0,
      difficulty: typeof p?.difficulty === "string" ? p.difficulty : undefined,
    }));
  } catch {
    return [];
  }
}

export function getAwardedCharmIds(): string[] {
  try {
    const raw = localStorage.getItem(CHARMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function persistAwardedCharmIds(ids: string[]): void {
  try {
    localStorage.setItem(
      CHARMS_STORAGE_KEY,
      JSON.stringify(Array.from(new Set(ids)))
    );
  } catch {
    /* ignore */
  }
}

export function getEarnedCharms(logs: WorkoutLogLite[]): Charm[] {
  return ACHIEVEMENT_CHARMS.filter((c) => c.isEarned(logs));
}

/**
 * Runs once per device. For users who already have workout history when this
 * feature ships, silently marks their currently-earned charms as awarded so
 * they don't get a flood of celebration modals on their next workout. The
 * trophy case still shows the charms; only the celebration is suppressed.
 * Brand-new users (no history) are left untouched so they get the full
 * celebration when they first earn each charm.
 */
export function seedAwardedCharmsOnce(): void {
  try {
    if (localStorage.getItem(CHARMS_SEEDED_FLAG)) return;
    const history = readWorkoutHistory();
    if (history.length > 0) {
      const alreadyEarned = getEarnedCharms(history).map((c) => c.id);
      persistAwardedCharmIds([...getAwardedCharmIds(), ...alreadyEarned]);
    }
    localStorage.setItem(CHARMS_SEEDED_FLAG, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Marks every newly-earned charm as awarded and returns the ones that crossed
 * for the first time, so each charm only celebrates once. Returns [] if nothing
 * new. On a user's first run this also seeds already-satisfied charms without
 * celebrating a backlog — see seedAwardedCharms.
 */
export function claimNewCharms(logs: WorkoutLogLite[]): Charm[] {
  const awarded = new Set(getAwardedCharmIds());
  const newlyEarned = getEarnedCharms(logs).filter((c) => !awarded.has(c.id));
  if (newlyEarned.length === 0) return [];

  newlyEarned.forEach((c) => awarded.add(c.id));
  persistAwardedCharmIds(Array.from(awarded));
  return newlyEarned;
}
