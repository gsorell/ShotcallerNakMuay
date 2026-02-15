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
    iconPath: "/assets/icon.stopwatch.png",
  },
  freestyle: {
    label: "Freestyle",
    icon: "🔥",
    desc: "You call the shots — just a clack to keep pace. No techniques, no voice. Pure flow.",
    iconPath: "/assets/icon.flame.png",
  },
  newb: {
    label: "Nak Muay Newb",
    icon: "👶",
    desc: "Start here to learn the basic strikes",
    iconPath: "/assets/icon_newb.png",
  },
  khao: {
    label: "Muay Khao",
    icon: "🙏",
    desc: "Close-range clinch work and knee combinations",
    iconPath: "/assets/icon_khao.png",
  },
  mat: {
    label: "Muay Mat",
    icon: "👊",
    desc: "Blending Heavy hands with Kicks and Knees",
    iconPath: "/assets/icon_mat.png",
  },
  tae: {
    label: "Muay Tae",
    icon: "🦵",
    desc: "Kicking specialist with long-range attacks",
    iconPath: "/assets/icon_tae.png",
  },
  femur: {
    label: "Muay Femur",
    icon: "🧠",
    desc: "Technical timing and defensive counters",
    iconPath: "/assets/icon_femur.png",
  },
  sok: {
    label: "Muay Sok",
    icon: "🔪",
    desc: "Vicious elbows and close-range attacks",
    iconPath: "/assets/icon_sok.png",
  },
  boxing: {
    label: "Boxing",
    icon: "🥊",
    desc: "Fundamental boxing combinations",
    iconPath: "/assets/icon_boxing.png",
  },
  two_piece: {
    label: "Two-Piece Combos",
    icon: "⚡️",
    desc: "Short, powerful 2-strike combinations",
    iconPath: "/assets/icon_two_piece.png",
  },
  southpaw: {
    label: "Southpaw",
    icon: "🦶",
    desc: "Left-handed stance with combos tailored for southpaw fighters",
    iconPath: "/assets/icon_southpaw.png",
  },
  // --- Custom icons for new groups ---
  meat_potatoes: {
    label: "Meat & Potatoes",
    icon: "🥔",
    desc: "Classic, high-percentage strikes and combos for all levels",
    iconPath: "/assets/icon_meat_potatoes.png",
  },
  buakaw: {
    label: "Buakaws Corner",
    icon: "🥋",
    desc: "Aggressive clinch, knees, and sweeps inspired by Buakaw",
    iconPath: "/assets/icon.buakaw.png",
  },
  low_kick_legends: {
    label: "Low Kick Legends",
    icon: "🦵",
    desc: "Devastating low kicks and classic Dutch-style combinations",
    iconPath: "/assets/icon_lowkicklegends.png",
  },
  elbow_arsenal: {
    label: "Elbow Arsenal",
    icon: "💥",
    desc: "Sharp elbow strikes and creative close-range attacks",
    iconPath: "/assets/icon.elbow arsenal.png",
  },
  // REMOVE muay_tech entry entirely
  ko_setups: {
    label: "KO Setups",
    icon: "💣",
    desc: "Explosive knockout setups and finishing combinations",
    iconPath: "/assets/icon.ko.png",
  },
  tricky_traps: {
    label: "Tricky Traps and Spinning Shit",
    icon: "🌪️",
    desc: "Advanced spinning techniques and deceptive setups",
    iconPath: "/assets/icon.trickytraps.png",
  },
  feints_and_fakeouts: {
    label: "Feints and Fakeouts",
    icon: "🎭",
    desc: "Deceptive movements and setups that manipulate timing and rhythm.",
    iconPath: "/assets/icon.feintsandfakes.png",
  },
  dutch_kickboxing: {
    label: "Dutch Kickboxing",
    icon: "🥊",
    desc: "High-pressure combinations emphasizing volume, flow, and power.",
    iconPath: "/assets/icon.dutch.png",
  },
};
