// Dev helper: seeds dummy workout logs to demo the charm trophy case.
//
// HOW TO USE:
//   1. Run `npm run dev` and open the app in your browser.
//   2. Open browser DevTools (F12) → Console tab.
//   3. Copy/paste this entire file's contents into the console and press Enter.
//   4. Refresh the page → Logs tab → you'll see all charms earned.
//
// TO RESET:
//   Run `dummyStreakReset()` in the console, then refresh.

(() => {
  const WORKOUTS_KEY = "shotcaller_workouts";
  const MILESTONES_KEY = "shotcaller_streak_milestones";
  const DAYS = 100;

  const emphasesPool = [
    ["mat", "boxing"],
    ["khao"],
    ["tae", "low_kick_legends"],
    ["femur"],
    ["sok", "elbow_arsenal"],
    ["boxing"],
    ["two_piece"],
    ["dutch_kickboxing"],
  ];
  const difficulties = ["easy", "medium", "hard"];

  const logs = [];
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  for (let i = DAYS - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const emphases = emphasesPool[i % emphasesPool.length];
    const difficulty = difficulties[i % difficulties.length];
    const rounds = 3 + (i % 5);
    logs.push({
      id: `seed-${day.getTime()}`,
      timestamp: day.toISOString(),
      roundsPlanned: rounds,
      roundsCompleted: rounds,
      roundLengthMin: 3,
      restMinutes: 1,
      difficulty,
      shotsCalledOut: 40 + (i % 30),
      emphases,
      status: "completed",
      settings: {
        selectedEmphases: emphases.reduce((acc, k) => {
          acc[k] = true;
          return acc;
        }, {}),
        addCalisthenics: false,
        readInOrder: false,
        southpawMode: false,
      },
    });
  }

  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(logs));
  // Mark milestones as already awarded so the celebration modal does NOT fire
  // on next workout completion — we just want to view the trophy case.
  localStorage.setItem(MILESTONES_KEY, JSON.stringify([3, 7, 14, 30, 60, 100]));

  window.dummyStreakReset = () => {
    localStorage.removeItem(WORKOUTS_KEY);
    localStorage.removeItem(MILESTONES_KEY);
    console.log("[dummy-streak] Cleared. Refresh the page.");
  };

  console.log(
    `[dummy-streak] Seeded ${DAYS} consecutive workout days ending today. ` +
      `Refresh and open the Logs tab. Run dummyStreakReset() to undo.`
  );
})();
