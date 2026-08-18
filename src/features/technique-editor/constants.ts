// Define thumbnails for groups (example mapping)
export const GROUP_THUMBNAILS: Record<string, string> = {
  timer_only: "/assets/icon.stopwatch.png",
  newb: "/assets/icon_newb.png",
  two_piece: "/assets/icon_two_piece.png",
  boxing: "/assets/icon_boxing.png",
  mat: "/assets/icon_mat.png",
  tae: "/assets/icon_tae.png",
  khao: "/assets/icon_knee.png",
  sok: "/assets/icon_sok.png",
  femur: "/assets/icon_femur.png",
  southpaw: "/assets/icon_southpaw.png",
  muay_tech: "/assets/icon.muaytech.png",
  meat_potatoes: "/assets/icon_meat_potatoes.png",
  buakaw: "/assets/icon.buakaw.png",
  low_kick_legends: "/assets/icon_low_kick.png",
  elbow_arsenal: "/assets/icon.elbow arsenal.png",
  ko_setups: "/assets/icon.ko.png",
  tricky_traps: "/assets/icon.trickytraps.png",
  feints_and_fakeouts: "/assets/icon.feintsandfakes.png",
  dutch_kickboxing: "/assets/icon.dutch.png",
  counters: "/assets/icon.counters.png",
};

/**
 * The canonical style order — the single list the home screen grid and the
 * Manage Techniques page both read, so the two can never disagree about where
 * a style sits. There used to be a second copy of this inside `useEmphasisList`
 * and the two had drifted: different order, and this one still listed
 * `muay_tech`, which was removed from the app.
 *
 * Nak Muay Newb leads: it is the beginner's door, and the first tile a new user
 * sees should be the one they can actually use. `timer_only` and `freestyle`
 * trail because they are modes, not fighting styles — the home screen renders
 * those two separately at the end (see LEADING_KEYS / TRAILING_KEYS).
 */
export const CORE_ORDER = [
  "newb",
  // --- above the fold ---
  "meat_potatoes",
  "mat",
  "tae",
  "khao",
  "sok",
  "femur",
  "buakaw",
  "dutch_kickboxing",
  // --- below the fold ---
  "two_piece",
  "counters",
  "low_kick_legends",
  "boxing",
  "ko_setups",
  "elbow_arsenal",
  "feints_and_fakeouts",
  "tricky_traps",
  "southpaw",
  // --- modes, rendered last ---
  "timer_only",
  "freestyle",
];
