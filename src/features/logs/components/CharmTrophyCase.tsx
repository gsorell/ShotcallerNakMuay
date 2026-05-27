import { STREAK_MILESTONES } from "../constants/milestones";

interface CharmTrophyCaseProps {
  currentStreak: number;
  longestStreak: number;
}

export default function CharmTrophyCase({
  currentStreak,
  longestStreak,
}: CharmTrophyCaseProps) {
  const peak = Math.max(currentStreak, longestStreak);
  const earned = STREAK_MILESTONES.filter((m) => peak >= m.threshold);

  if (earned.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: "0.75rem",
        justifyContent: "center",
        fontSize: "0.8rem",
        flexWrap: "wrap",
      }}
    >
      {earned.map((milestone) => (
        <div
          key={milestone.threshold}
          title={`${milestone.name} — ${milestone.threshold}-day streak`}
          style={{ textAlign: "center" }}
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
            <span style={{ fontSize: "1rem" }}>{milestone.emoji}</span>
            <span
              style={{
                fontWeight: 700,
                color: "white",
                fontSize: "1.125rem",
              }}
            >
              {milestone.threshold}d
            </span>
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: "0.7rem",
            }}
          >
            {milestone.name}
          </div>
        </div>
      ))}
    </div>
  );
}
