import { useMemo, useState } from "react";
import { STREAK_MILESTONES } from "../constants/milestones";
import {
  ACHIEVEMENT_CHARMS,
  type Charm,
  type CharmVisual,
} from "../constants/charms";
import { readWorkoutHistory } from "../utils/charms";
import CharmCelebrationModal from "./CharmCelebrationModal";

interface CharmTrophyCaseProps {
  currentStreak: number;
  longestStreak: number;
}

interface TrophyItem {
  key: string;
  visual: CharmVisual;
  /** Bold text badge shown next to the emoji (streaks show "30d"). */
  badgeText?: string;
  caption: string;
  subtitle?: string;
  earned: boolean;
  /** Progress text for locked items, e.g. "3/5". */
  progressLabel?: string;
}

export default function CharmTrophyCase({
  currentStreak,
  longestStreak,
}: CharmTrophyCaseProps) {
  const [active, setActive] = useState<TrophyItem | null>(null);
  const peak = Math.max(currentStreak, longestStreak);
  const history = useMemo(() => readWorkoutHistory(), []);

  const streakItems: TrophyItem[] = STREAK_MILESTONES.filter(
    (m) => peak >= m.threshold
  ).map((m) => ({
    key: `streak-${m.threshold}`,
    visual: m,
    badgeText: `${m.threshold}d`,
    caption: m.name,
    subtitle: `${m.threshold}-Day Streak 🔥`,
    earned: true,
  }));

  // Earned achievement charms, plus the next 2 locked ones as a teaser.
  const earnedCharms: Charm[] = [];
  const lockedCharms: Charm[] = [];
  ACHIEVEMENT_CHARMS.forEach((c) =>
    (c.isEarned(history) ? earnedCharms : lockedCharms).push(c)
  );

  const achievementItems: TrophyItem[] = earnedCharms.map((c) => ({
    key: c.id,
    visual: c,
    caption: c.name,
    earned: true,
  }));

  const teaserItems: TrophyItem[] = lockedCharms.slice(0, 2).map((c) => {
    const p = c.progress?.(history);
    return {
      key: `locked-${c.id}`,
      visual: c,
      caption: c.name,
      earned: false,
      progressLabel: p ? `${p.current}/${p.target}` : undefined,
    };
  });

  const items = [...streakItems, ...achievementItems, ...teaserItems];
  if (items.length === 0) return null;

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          justifyContent: "center",
          fontSize: "0.8rem",
          flexWrap: "wrap",
        }}
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => item.earned && setActive(item)}
            title={
              item.earned
                ? `${item.caption} — tap to share`
                : `${item.caption} — locked${
                    item.progressLabel ? ` (${item.progressLabel})` : ""
                  }`
            }
            style={{
              all: "unset",
              cursor: item.earned ? "pointer" : "default",
              textAlign: "center",
              opacity: item.earned ? 1 : 0.4,
              filter: item.earned ? "none" : "grayscale(1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.25rem",
                marginBottom: "0.125rem",
              }}
            >
              <span style={{ fontSize: "1rem" }}>{item.visual.emoji}</span>
              {item.badgeText && (
                <span
                  style={{ fontWeight: 700, color: "white", fontSize: "1.125rem" }}
                >
                  {item.badgeText}
                </span>
              )}
            </div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.7rem" }}>
              {item.earned
                ? item.caption
                : `🔒 ${item.progressLabel ?? item.caption}`}
            </div>
          </button>
        ))}
      </div>

      {active && (
        <CharmCelebrationModal
          charm={active.visual}
          subtitle={active.subtitle}
          eyebrow="Charm Earned"
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
