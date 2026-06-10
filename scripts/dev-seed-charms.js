// Dev helper: seeds workout logs that earn the achievement charms so you can
// demo the trophy case, the shareable charm cards, and the "next charm" teaser.
//
// HOW TO USE:
//   1. Run `npm run dev` and open the app in your browser.
//   2. Open DevTools (F12) → Console tab.
//   3. Paste this entire file's contents and press Enter.
//   4. Refresh → Logs tab. Tap any charm to open its shareable card.
//
// TO RESET:
//   Run `dummyCharmsReset()` in the console, then refresh.
//
// NOTE: emphases are stored as LABELS (e.g. "Muay Mat"), exactly how the real
// app writes them — the charm style-predicates match on labels.

(() => {
  const WORKOUTS_KEY = "shotcaller_workouts";
  const MILESTONES_KEY = "shotcaller_streak_milestones";
  const CHARMS_KEY = "shotcaller_charms";
  const CHARMS_SEEDED_FLAG = "shotcaller_charms_seeded";

  // 12 consecutive days ending today. Distinct styles span Mat/Tae/Khao + more
  // (earns Jack of All Trades + Mat·Tae·Khao). Today's session has 6 rounds
  // (earns Double Session). Total rounds stay under 100 so Century Club shows
  // as a LOCKED teaser with progress.
  const dayStyles = [
    ["Muay Mat", "Boxing"],
    ["Muay Khao"],
    ["Muay Tae"],
    ["Muay Femur"],
    ["Muay Sok"],
    ["Boxing"],
    ["Muay Mat"],
    ["Muay Tae"],
    ["Muay Khao"],
    ["Dutch Kickboxing"],
    ["Muay Femur"],
    ["Muay Sok"],
  ];
  const difficulties = ["easy", "medium", "hard"];

  const now = new Date();
  now.setHours(12, 0, 0, 0);

  const logs = dayStyles.map((emphases, idx) => {
    const i = dayStyles.length - 1 - idx; // 0 == today
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const rounds = i === 0 ? 6 : 5; // today's session breaks 5 rounds
    return {
      id: `seed-charm-${day.getTime()}`,
      timestamp: day.toISOString(),
      roundsPlanned: rounds,
      roundsCompleted: rounds,
      roundLengthMin: 3,
      restMinutes: 1,
      difficulty: difficulties[idx % difficulties.length],
      shotsCalledOut: 40 + (idx % 30),
      emphases,
      status: "completed",
      settings: {
        selectedEmphases: {},
        addCalisthenics: false,
        readInOrder: false,
        southpawMode: false,
      },
    };
  });

  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(logs));
  // 12-day streak → 3- and 7-day streak charms earned. Mark awarded so the
  // streak modal doesn't fire on a later real workout.
  localStorage.setItem(MILESTONES_KEY, JSON.stringify([3, 7]));
  // Mark the achievement charms these logs earn as awarded + set the seed flag,
  // so a later real workout doesn't replay their celebrations.
  localStorage.setItem(
    CHARMS_KEY,
    JSON.stringify([
      "first_blood",
      "ten_toward_glory",
      "double_session",
      "jack_of_all_trades",
      "mat_tae_khao",
    ])
  );
  localStorage.setItem(CHARMS_SEEDED_FLAG, "1");

  window.dummyCharmsReset = () => {
    [WORKOUTS_KEY, MILESTONES_KEY, CHARMS_KEY, CHARMS_SEEDED_FLAG].forEach((k) =>
      localStorage.removeItem(k)
    );
    console.log("[dummy-charms] Cleared. Refresh the page.");
  };

  console.log(
    "[dummy-charms] Seeded 12 workout days. Earned: First Blood, Ten Toward " +
      "Glory, Double Session, Jack of All Trades, Mat·Tae·Khao (+ 3/7-day " +
      "streak charms). Century Club stays locked as a teaser. Refresh → Logs. " +
      "Run dummyCharmsReset() to undo."
  );
})();
