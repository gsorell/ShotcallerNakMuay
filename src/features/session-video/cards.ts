import type { Card } from "./reelRenderer";

/** "3:00", "2:30", "0:45". */
const clock = (ms: number): string => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The reel's opening: what the session was, before a single strike — so a
 * stranger scrolling past knows what they're watching. "5 ROUNDS × 3:00",
 * then the day.
 */
export const titleCard = (rounds: number, roundMs: number, when = new Date()): Card => ({
  lines: [
    `${rounds} ${rounds === 1 ? "ROUND" : "ROUNDS"} × ${clock(roundMs)}`,
    when
      .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      .toUpperCase(),
  ],
  durationMs: 1400,
});

/**
 * The reel's close: what got done, and where it came from. Reels are free
 * and made to be shared, so the last frame says where to get the app.
 */
export const endCard = (calls: number, workMs: number): Card => {
  const minutes = Math.max(1, Math.round(workMs / 60000));
  return {
    lines: [
      `${calls} ${calls === 1 ? "CALL" : "CALLS"} · ${minutes} MIN`,
      "Called by Shot Caller",
      "shotcallermuaythai.app",
    ],
    durationMs: 2500,
  };
};
