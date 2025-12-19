import { useEffect, useState } from "react";
import { WORKOUTS_STORAGE_KEY } from "@/constants/storage";

export interface HomeStats {
  mostCommonEmphasis: string;
  current: number;
  longest: number;
}

export function useHomeStats(trigger: number) {
  const [homePageStats, setHomePageStats] = useState<HomeStats | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
      if (!raw) {
        setHomePageStats(null);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setHomePageStats(null);
        return;
      }

      // Normalize workout entries
      const logs = parsed.map((p: any, i: number) => ({
        id: String(p?.id ?? `log-${i}-${Date.now()}`),
        timestamp: String(p?.timestamp ?? new Date().toISOString()),
        emphases: Array.isArray(p?.emphases) ? p.emphases.map(String) : [],
      }));

      // Calculate stats
      const emphasesCount: Record<string, number> = {};
      logs.forEach((l: any) =>
        l.emphases.forEach((e: string) => {
          emphasesCount[e] = (emphasesCount[e] || 0) + 1;
        })
      );
      const mostCommonEmphasis =
        Object.entries(emphasesCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

      const streaks = calculateStreaks(logs);

      setHomePageStats({ mostCommonEmphasis, ...streaks });
    } catch {
      setHomePageStats(null);
    }
  }, [trigger]);

  return homePageStats;
}

// Helper function to get local date string (YYYY-MM-DD) without timezone conversion
function getLocalDateString(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper logic extracted from the hook
function calculateStreaks(logs: any[]) {
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

  // Calculate current streak (using local timezone)
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
