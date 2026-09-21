// Base UI config for known styles
export const BASE_EMPHASIS_CONFIG: {
  [key: string]: {
    label: string;
    icon: string;
    desc: string;
    iconPath: string;
  };
} = {
  timer_only: {
    label: "Timer Only",
    icon: "⏱️",
    desc: "Just a round timer — no shotcalling, no techniques.",
    iconPath: "/assets/icon.stopwatch.webp",
  },
  freestyle: {
    label: "Freestyle",
    icon: "🔥",
    desc: "You call the shots — just a clack to keep pace.",
    iconPath: "/assets/icon.flame.webp",
  },
  newb: {
    label: "Nak Muay Newb",
    icon: "👶",
    desc: "Punches, kicks, knees and defence, plus simple combos",
    iconPath: "/assets/icon_newb.webp",
  },
  khao: {
    label: "Muay Khao",
    icon: "🙏",
    desc: "Close-range clinch work and knee combinations",
    iconPath: "/assets/icon_knee.webp",
  },
  mat: {
    label: "Muay Mat",
    icon: "👊",
    desc: "Blending Heavy hands with Kicks and Knees",
    iconPath: "/assets/icon_mat.webp",
  },
  tae: {
    label: "Muay Tae",
    icon: "🦵",
    desc: "Kicking specialist with long-range attacks",
    iconPath: "/assets/icon_tae.webp",
  },
  femur: {
    label: "Muay Femur",
    icon: "🧠",
    desc: "Technical timing and defensive counters",
    iconPath: "/assets/icon_femur.webp",
  },
  sok: {
    label: "Muay Sok",
    icon: "🔪",
    desc: "Vicious elbows and close-range attacks",
    iconPath: "/assets/icon_sok.webp",
  },
  boxing: {
    label: "Boxing",
    icon: "🥊",
    desc: "Fundamental boxing combinations",
    iconPath: "/assets/icon_boxing.webp",
  },
  two_piece: {
    label: "Two-Piece Combos",
    icon: "⚡️",
    desc: "Short, powerful 2-strike combinations",
    iconPath: "/assets/icon_two_piece.webp",
  },
  southpaw: {
    label: "Southpaw",
    icon: "🦶",
    desc: "Left-handed stance with combos for southpaw fighters.",
    iconPath: "/assets/icon_southpaw.webp",
  },
  // --- Custom icons for new groups ---
  meat_potatoes: {
    label: "Meat & Potatoes",
    icon: "🥔",
    desc: "Classic, high-percentage strikes and combos for all levels",
    iconPath: "/assets/icon_meat_potatoes.webp",
  },
  buakaw: {
    label: "Buakaws Corner",
    icon: "🥋",
    desc: "Aggressive clinch, knees, and sweeps inspired by Buakaw",
    iconPath: "/assets/icon.buakaw.webp",
  },
  low_kick_legends: {
    label: "Low Kick Legends",
    icon: "🦵",
    desc: "Devastating low kicks and classic Dutch-style combinations",
    iconPath: "/assets/icon_low_kick.webp",
  },
  elbow_arsenal: {
    label: "Elbow Arsenal",
    icon: "💥",
    desc: "Sharp elbow strikes and creative close-range attacks",
    iconPath: "/assets/icon.elbow arsenal.webp",
  },
  // REMOVE muay_tech entry entirely
  ko_setups: {
    label: "KO Setups",
    icon: "💣",
    desc: "Explosive knockout setups and finishing combinations",
    iconPath: "/assets/icon.ko.webp",
  },
  tricky_traps: {
    label: "Tricky Traps and Spinning Shit",
    icon: "🌪️",
    desc: "Advanced spinning techniques and deceptive setups",
    iconPath: "/assets/icon.trickytraps.webp",
  },
  feints_and_fakeouts: {
    label: "Feints and Fakeouts",
    icon: "🎭",
    desc: "Deceptive setups that manipulate timing and rhythm.",
    iconPath: "/assets/icon.feintsandfakes.webp",
  },
  dutch_kickboxing: {
    label: "Dutch Kickboxing",
    icon: "🥊",
    desc: "High-pressure combinations built on volume and power.",
    iconPath: "/assets/icon.dutch.webp",
  },
  counters: {
    label: "The Answer Back",
    icon: "↩️",
    desc: "Defense first — read the strike, then make them pay.",
    iconPath: "/assets/icon.counters.webp",
  },
};
