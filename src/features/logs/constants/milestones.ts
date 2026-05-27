export interface StreakMilestone {
  threshold: number;
  name: string;
  thaiName: string;
  emoji: string;
  description: string;
  accentColor: string;
  glowColor: string;
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  {
    threshold: 3,
    name: "Pra Jiad",
    thaiName: "ประเจียด",
    emoji: "🪢",
    description: "The student's armband. You've shown up three days running.",
    accentColor: "#f9a8d4",
    glowColor: "rgba(249, 168, 212, 0.55)",
  },
  {
    threshold: 7,
    name: "Mongkol",
    thaiName: "มงคล",
    emoji: "👑",
    description: "The sacred headband worn before battle. One full week of training.",
    accentColor: "#fbbf24",
    glowColor: "rgba(251, 191, 36, 0.55)",
  },
  {
    threshold: 14,
    name: "Bronze Belt",
    thaiName: "เข็มขัดทองแดง",
    emoji: "🥉",
    description: "Two weeks of consistency. The fundamentals are becoming instinct.",
    accentColor: "#cd7f32",
    glowColor: "rgba(205, 127, 50, 0.55)",
  },
  {
    threshold: 30,
    name: "Kru — Silver Belt",
    thaiName: "ครู",
    emoji: "🥈",
    description: "A full month. You've earned the rank of teacher.",
    accentColor: "#cbd5e1",
    glowColor: "rgba(203, 213, 225, 0.55)",
  },
  {
    threshold: 60,
    name: "Gold Belt",
    thaiName: "เข็มขัดทอง",
    emoji: "🥇",
    description: "Sixty days. Few make it this far. Fewer keep going.",
    accentColor: "#facc15",
    glowColor: "rgba(250, 204, 21, 0.6)",
  },
  {
    threshold: 100,
    name: "Arjarn",
    thaiName: "อาจารย์",
    emoji: "🏆",
    description: "One hundred days. Master tier. The path is yours now.",
    accentColor: "#ef4444",
    glowColor: "rgba(239, 68, 68, 0.6)",
  },
];

export function getMilestoneAtOrBelow(streak: number): StreakMilestone | null {
  for (let i = STREAK_MILESTONES.length - 1; i >= 0; i--) {
    if (streak >= STREAK_MILESTONES[i]!.threshold) return STREAK_MILESTONES[i]!;
  }
  return null;
}
