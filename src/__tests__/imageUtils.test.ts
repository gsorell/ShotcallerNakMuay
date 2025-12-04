import { describe, expect, it } from "vitest";
import type { WorkoutStats } from "../utils/imageUtils";
import {
  generateWorkoutFilename,
  isWebShareSupported,
} from "../utils/imageUtils";

describe("Image Utils", () => {
  const mockStats: WorkoutStats = {
    timestamp: "2025-10-21T16:01:56.000Z",
    emphases: ["Two-Piece Combos", "Kicks"],
    difficulty: "medium",
    shotsCalledOut: 258,
    roundsCompleted: 5,
    roundsPlanned: 5,
    roundLengthMin: 3,
  };

  describe("generateWorkoutFilename", () => {
    it("should generate a proper filename from workout stats with unique timestamp", () => {
      const filename = generateWorkoutFilename(mockStats);
      expect(filename).toBe(
        "shotcaller-workout-2025-10-21-16-01-56-two-piece-combos-kicks-medium"
      );
    });

    it("should handle single emphasis", () => {
      const stats = { ...mockStats, emphases: ["Jabs"] };
      const filename = generateWorkoutFilename(stats);
      expect(filename).toBe(
        "shotcaller-workout-2025-10-21-16-01-56-jabs-medium"
      );
    });

    it("should handle spaces in emphasis names", () => {
      const stats = { ...mockStats, emphases: ["Heavy Bag Work"] };
      const filename = generateWorkoutFilename(stats);
      expect(filename).toBe(
        "shotcaller-workout-2025-10-21-16-01-56-heavy-bag-work-medium"
      );
    });
  });

  describe("isWebShareSupported", () => {
    it("should return boolean indicating Web Share API support", () => {
      const result = isWebShareSupported();
      expect(typeof result).toBe("boolean");
    });
  });
});
