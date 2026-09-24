import { describe, expect, it } from "vitest";
import type { WorkoutStats } from "../utils/imageUtils";
import { SITE_URL } from "../constants/storeLinks";
import {
  buildChallengeText,
  formatRoundLength,
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

  describe("formatRoundLength", () => {
    it("leaves whole minutes as minutes", () => {
      expect(formatRoundLength(3)).toBe("3 min");
      expect(formatRoundLength(1)).toBe("1 min");
    });

    it("renders sub-minute rounds as clock time", () => {
      // The floor is 0.25 min in the start controls, and "0.25 min" is not a
      // thing anyone says out loud.
      expect(formatRoundLength(0.25)).toBe("0:15");
      expect(formatRoundLength(0.5)).toBe("0:30");
    });

    it("renders mixed lengths as clock time", () => {
      expect(formatRoundLength(1.5)).toBe("1:30");
      expect(formatRoundLength(2.25)).toBe("2:15");
    });

    it("pads the seconds", () => {
      expect(formatRoundLength(1.05)).toBe("1:03");
    });
  });

  describe("buildChallengeText", () => {
    it("leads with the setup a friend can repeat", () => {
      expect(buildChallengeText(mockStats)).toBe(
        "5 × 3 min · Amateur · Two-Piece Combos, Kicks. 258 shots called. " +
          "Same setup — your move.\n" +
          "https://shotcallernakmuay.netlify.app/\n" +
          "#NakMuay #ShotcallerNakMuay #MuayThai"
      );
    });

    it("links to the plain address, with nothing appended", () => {
      // A caption is read before it is clicked, and a query string in the
      // middle of one is noise. The setup is spelled out above it already.
      const url = buildChallengeText({
        ...mockStats,
        emphasisKeys: ["two_piece", "tae"],
      })
        .split("\n")
        .find((l) => l.startsWith("http"))!;
      expect(url).toBe(SITE_URL);
      expect(url).not.toContain("?");
    });

    it("shows the user's difficulty label, not the internal value", () => {
      expect(buildChallengeText({ ...mockStats, difficulty: "hard" })).toContain(
        "· Pro ·"
      );
      expect(buildChallengeText({ ...mockStats, difficulty: "easy" })).toContain(
        "· Novice ·"
      );
    });

    it("counts the rounds actually completed, not the rounds planned", () => {
      // The card is an invitation to match the work, so it advertises what was
      // done rather than what was intended.
      const cutShort = { ...mockStats, roundsCompleted: 3, roundsPlanned: 6 };
      expect(buildChallengeText(cutShort)).toContain("3 × 3 min");
      expect(buildChallengeText(cutShort)).not.toContain("6");
    });

    it("keeps the hashtag user-generated proof accumulates under", () => {
      expect(buildChallengeText(mockStats)).toContain("#ShotcallerNakMuay");
    });

    it("stays in voice: no exclamation, no emoji, never 'workout'", () => {
      const text = buildChallengeText(mockStats);
      expect(text).not.toContain("!");
      expect(text.toLowerCase()).not.toContain("workout");
      expect(/\p{Extended_Pictographic}/u.test(text)).toBe(false);
    });
  });

  describe("isWebShareSupported", () => {
    it("should return boolean indicating Web Share API support", () => {
      const result = isWebShareSupported();
      expect(typeof result).toBe("boolean");
    });
  });
});
