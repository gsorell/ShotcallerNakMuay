import { MILESTONES_STORAGE_KEY } from "@/constants/storage";
import {
  STREAK_MILESTONES,
  type StreakMilestone,
} from "../constants/milestones";

export function getAwardedThresholds(): number[] {
  try {
    const raw = localStorage.getItem(MILESTONES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === "number");
  } catch {
    return [];
  }
}

function persistAwardedThresholds(thresholds: number[]): void {
  try {
    localStorage.setItem(
      MILESTONES_STORAGE_KEY,
      JSON.stringify(Array.from(new Set(thresholds)).sort((a, b) => a - b))
    );
  } catch {
    /* ignore */
  }
}

export function getUnlockedMilestones(streak: number): StreakMilestone[] {
  return STREAK_MILESTONES.filter((m) => streak >= m.threshold);
}

/**
 * Returns the highest milestone the user just crossed but hasn't been shown,
 * and marks ALL crossed thresholds as awarded so the celebration only fires once
 * per threshold. Returns null if nothing new to celebrate.
 */
export function claimNewMilestone(streak: number): StreakMilestone | null {
  const awarded = new Set(getAwardedThresholds());
  const crossed = getUnlockedMilestones(streak);
  const newlyCrossed = crossed.filter((m) => !awarded.has(m.threshold));
  if (newlyCrossed.length === 0) return null;

  newlyCrossed.forEach((m) => awarded.add(m.threshold));
  persistAwardedThresholds(Array.from(awarded));

  return newlyCrossed[newlyCrossed.length - 1]!;
}
