import type { StreakMilestone } from "../constants/milestones";
import CharmCelebrationModal from "./CharmCelebrationModal";

interface StreakCelebrationModalProps {
  milestone: StreakMilestone;
  streak: number;
  onClose: () => void;
}

/**
 * Thin wrapper preserving the streak-specific API. A StreakMilestone already
 * matches the CharmVisual shape, so it renders through the shared (shareable)
 * charm modal with a streak-count subtitle.
 */
export default function StreakCelebrationModal({
  milestone,
  streak,
  onClose,
}: StreakCelebrationModalProps) {
  return (
    <CharmCelebrationModal
      charm={milestone}
      subtitle={`${streak}-Day Streak 🔥`}
      onClose={onClose}
    />
  );
}

export { CharmBadge, SparkleField } from "./CharmCelebrationModal";
