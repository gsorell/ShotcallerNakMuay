import { BASE_EMPHASIS_CONFIG } from "@/emphasisConfig";

/**
 * Shared visual shape for every collectible — both streak milestones and
 * achievement charms render with these fields (badge, modal, trophy case).
 */
export interface CharmVisual {
  name: string;
  thaiName: string;
  emoji: string;
  description: string;
  accentColor: string;
  glowColor: string;
}

/** Minimal slice of a workout log entry that charm predicates rely on. */
export interface WorkoutLogLite {
  timestamp: string;
  emphases: string[];
  roundsCompleted: number;
  difficulty?: string;
}

export type CharmCategory = "explorer" | "volume" | "warrior" | "ritual";

export interface Charm extends CharmVisual {
  id: string;
  category: CharmCategory;
  /** True once the full workout history satisfies this charm. */
  isEarned: (logs: WorkoutLogLite[]) => boolean;
  /** Optional progress for the "next charm" teaser (locked state). */
  progress?: (logs: WorkoutLogLite[]) => { current: number; target: number };
}

// --- Helpers shared by predicates -------------------------------------------

const label = (key: string) => BASE_EMPHASIS_CONFIG[key]?.label ?? key;

// Modes, not fighting styles — excluded from "distinct styles" counts.
const NON_STYLE_LABELS = new Set([label("timer_only"), label("freestyle")]);

function localDay(timestamp: string): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function distinctStyles(logs: WorkoutLogLite[]): Set<string> {
  const styles = new Set<string>();
  logs.forEach((l) =>
    l.emphases.forEach((e) => {
      if (e && !NON_STYLE_LABELS.has(e)) styles.add(e);
    })
  );
  return styles;
}

/** Highest number of rounds completed within a single local calendar day. */
function maxRoundsInADay(logs: WorkoutLogLite[]): number {
  const byDay: Record<string, number> = {};
  logs.forEach((l) => {
    byDay[localDay(l.timestamp)] =
      (byDay[localDay(l.timestamp)] || 0) + (l.roundsCompleted || 0);
  });
  return Object.values(byDay).reduce((max, v) => Math.max(max, v), 0);
}

// --- Catalog -----------------------------------------------------------------

export const ACHIEVEMENT_CHARMS: Charm[] = [
  {
    id: "first_blood",
    category: "volume",
    name: "First Blood",
    thaiName: "หมัดแรก",
    emoji: "🩸",
    description: "Your first session is in the books. The journey of a Nak Muay begins.",
    accentColor: "#f87171",
    glowColor: "rgba(248, 113, 113, 0.55)",
    isEarned: (logs) => logs.length >= 1,
    progress: (logs) => ({ current: Math.min(logs.length, 1), target: 1 }),
  },
  {
    id: "ten_toward_glory",
    category: "volume",
    name: "Ten Toward Glory",
    thaiName: "สิบครั้ง",
    emoji: "🔟",
    description: "Ten sessions logged. Showing up is the hardest technique to master.",
    accentColor: "#60a5fa",
    glowColor: "rgba(96, 165, 250, 0.55)",
    isEarned: (logs) => logs.length >= 10,
    progress: (logs) => ({ current: Math.min(logs.length, 10), target: 10 }),
  },
  {
    id: "double_session",
    category: "volume",
    name: "Double Session",
    thaiName: "ซ้อมสองเวลา",
    emoji: "🌅",
    description:
      "More than five rounds in a single day — the morning-and-evening grind of a real fight camp.",
    accentColor: "#fb923c",
    glowColor: "rgba(251, 146, 60, 0.6)",
    isEarned: (logs) => maxRoundsInADay(logs) > 5,
    progress: (logs) => ({ current: Math.min(maxRoundsInADay(logs), 6), target: 6 }),
  },
  {
    id: "century_club",
    category: "volume",
    name: "Century Club",
    thaiName: "ร้อยยก",
    emoji: "💯",
    description: "One hundred rounds completed. The fundamentals are instinct now.",
    accentColor: "#facc15",
    glowColor: "rgba(250, 204, 21, 0.6)",
    isEarned: (logs) =>
      logs.reduce((sum, l) => sum + (l.roundsCompleted || 0), 0) >= 100,
    progress: (logs) => ({
      current: Math.min(
        logs.reduce((sum, l) => sum + (l.roundsCompleted || 0), 0),
        100
      ),
      target: 100,
    }),
  },
  {
    id: "jack_of_all_trades",
    category: "explorer",
    name: "Jack of All Trades",
    thaiName: "รอบรู้",
    emoji: "🎒",
    description: "Trained five different styles. A well-rounded fighter has no blind spots.",
    accentColor: "#a78bfa",
    glowColor: "rgba(167, 139, 250, 0.55)",
    isEarned: (logs) => distinctStyles(logs).size >= 5,
    progress: (logs) => ({ current: Math.min(distinctStyles(logs).size, 5), target: 5 }),
  },
  {
    id: "mat_tae_khao",
    category: "explorer",
    name: "Mat • Tae • Khao",
    thaiName: "หมัด เตะ เข่า",
    emoji: "🥋",
    description:
      "Trained the three classic archetypes — heavy hands, kicks, and knees. The complete Nak Muay.",
    accentColor: "#34d399",
    glowColor: "rgba(52, 211, 153, 0.55)",
    isEarned: (logs) => {
      const styles = distinctStyles(logs);
      return (
        styles.has(label("mat")) &&
        styles.has(label("tae")) &&
        styles.has(label("khao"))
      );
    },
    progress: (logs) => {
      const styles = distinctStyles(logs);
      const have = [label("mat"), label("tae"), label("khao")].filter((s) =>
        styles.has(s)
      ).length;
      return { current: have, target: 3 };
    },
  },
];

export function getCharmById(id: string): Charm | undefined {
  return ACHIEVEMENT_CHARMS.find((c) => c.id === id);
}
