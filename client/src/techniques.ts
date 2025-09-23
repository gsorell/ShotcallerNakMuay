export const INITIAL_TECHNIQUES: Record<string, { singles: string[]; combos: string[]; exclusive?: boolean; label?: string; title?: string; description?: string }> = {
  // Nak Muay Newb - Start here to learn the Art of 8 Limbs
  // exclusive: true means this emphasis should not be combined with other styles
  newb: {
    label: 'newb',
    title: 'Nak Muay Newb',
    singles: [
      "Jab",
      "Cross",
      "Left Hook",
      "Right Hook",
      "Left Uppercut",
      "Right Uppercut",
      "Overhand",
      "Jab to the Body",
      "Cross to the Body",
      "Left Hook to the Body",
      "Right Hook to the Body",
      "Left Teep",
      "Right Teep",
      "Left Check",
      "Right Check",
      "Inside Leg Kick",
      "Switch Kick",
      "Low Kick",
      "Middle Kick",
      "Head Kick",
      "Left Knee",
      "Right Knee",
      "Duck",
      "Slip Left",
      "Slip Right",
      "Lean Back",
      "Pivot Left",
      "Pivot Right",
      "Roll Right",
      "Roll Left",
      "Long Guard",
      "High Guard Block"
    ],
    combos: [],
    exclusive: true
  },

  khao: {
    label: 'khao',
    title: 'Muay Khao',
    // Close-range, clinch-focused combos and strikes
    singles: [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "1 to the body", 
      "2 to the body", 
      "3 to the body",
      "Left teep",
      "Right teep",
      "Left Knee",
      "Right Knee",
      "Left Check",
      "Right Check",
      "Left Kick",
      "Right Kick",
      "Left Elbow",
      "Right Elbow",
      "Spinning Elbow"
    ],
    combos: [
      "1, Step-in, Right Knee, Pivot Left",
      "2, Step-in, Left Knee",
      "High Block March, Left Knee, Right Knee",
      "1 2, Clinch, Double Knees",
      "1 4, Switch Knee, Elbow",
      "Left Check, 2 3 2",
      "Right Check, 3 2 3",
      "2, Left Elbow, Right Elbow",
      "Knee, Elbow, Knee",
      "1 2, 3 to the Body, 3 to the Head",
      "Knee, Knee, Knee",
      "1 4, Switch Knee"
    ]
  },

  mat: {
    label: 'mat',
    title: 'Muay Mat',
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Left Teep", "Right Teep", "Left Knee", "Right Knee", "Left Check",
      "Right Check", "Left Kick", "Right Kick",
      "Left Elbow", "Right Elbow",
    ],
    combos: [
      "1 2 3",
      "3, Low Kick, 3",
      "2, Inside Leg Kick, 2 3",
      "1, 2 to the Body, 3 to the Head",
      "Overhand, Left Knee, 6 3",
      "Catch Body Kick, 2 3",
      "1, Overhand, 3 to the Body, 3 to the Head",
      "1 2 3, Step-in Right Elbow",
      "1 1 2",
      "2 3 2",
      "1 to the Body, 2",
      "Overhand, 4 to the Body, 3 to the Body",
    ]
  },

  tae: {
    label: 'tae',
    title: 'Muay Tae',
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Left Teep", "Right Teep", "Left Knee", "Right Knee",
      "Left Check", "Head Kick",
      "Right Check", "Left Kick", "Right Kick", "Left Check",
      "Right Check", "Left Check",
      "Left Elbow", "Right Elbow",
    ],
    combos: [
      "1, Right Kick",
      "Right Kick, Right Kick", "Left Kick, Left Kick",
      "1 2, Switch Kick",
      "Right Kick, Left Kick",
      "Left Teep, Right Kick",
      "Right Kick, Right Teep",
      "Right Low Kick, Right High Kick",
      "2 3, Spinning Back Kick",
      "Inside Leg Kick, Switch Kick",
      "2 3, Low Kick, Right Check",
      "1 1 2, Low Kick",
      "3 2, Low Kick",
      "1 2, Right Kick, Left Kick",
    ]
  },

  femur: {
    label: 'femur',
    title: 'Muay Femur',
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Left Teep", "Right Teep", "Left Knee", "Right Knee", "Left Check",
      "Right Check", "Flying Knee", "Left Kick", "Right Kick", "Head Kick",
      "Left Elbow", "Right Elbow", "Spinning Elbow", "Question Mark Kick",
      "Sweep Left", "Sweep Right", "Left Check", "Right Check"
    ],
    combos: [
      "Right Check, Right Low Kick",
      "6 3, Right Knee, Right Elbow",
      "Parry Jab, Left Kick",
      "Lean Back, Right Low Kick",
      "Left Teep, Right Knee, Sweep Left",
      "Thai Hop, Axe Elbow",
      "Inside Leg Kick, Switch Knee",
      "1, Shift Left, Head Kick",
      "1, Shift Right, Head Kick",
      "Catch Kick, 2 3, Right Knee, Sweep Right",
      "Parry Jab, 1 2 3, Right Kick",
      "Right Kick, Right Teep",
      "Right Teep, Question Mark Kick",
      "Step Through, Left Kick",
      "Left Teep, Switch Knee, Right Elbow",
      "Switch Kick, 2 3 2",
      "1, Lean Back, Cross, Low Kick",
      "2, Switch Kick, 2 3, Low Kick"
    ]
  },

  sok: {
    label: 'sok',
    title: 'Muay Sok',
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Left Teep", "Right Teep", "Left Knee", "Right Knee", "Left Check",
      "Right Check", "Left Kick", "Right Kick",
      "Left Elbow", "Right Elbow", "Axe Elbow", "Spinning Elbow",
    ],
    combos: [
      "1 2, Right Elbow",
      "1, Right Elbow",
      "3, Right Elbow",
      "Parry Jab, Left Up Elbow",
      "2, Roll Right, Right Elbow",
      "Clinch, Left Up Elbow, Right Elbow",
      "Left Elbow, Right Elbow, Left Elbow",
      "1 1 2, Jumping Elbow",
      "2 3, Right Up Elbow",
      "Switch Knee, Right Elbow",
      "1 2 3, Spinning Elbow"
    ]
  },

  boxing: {
    label: 'boxing',
    title: 'Boxing',
    singles: [
      "Jab", "Cross", "3", "4", "5", "6", "Overhand", 
      "High Guard Block", "Parry Jab", "Catch Cross",
      "1 to the Body", "2 to the Body", "3 to the Body", 
      "Pivot Left",  "Pivot Right", "Duck",
    ],
    combos: [
      "1 1 2",
      "1 2 3",
      "1 2 3 2",
      "1 2 5 2",
      "2 3 2",
      "3 3 3",
      "2 2 2",
      "1, Slip Right, 2",
      "1 2, 3 to the Body, 3 to the Head",
      "1 2, Roll Right, 2 3",
      "2 3, Roll Left, 3 2",
      "1, 2 to the Body, 3 to the Head",
      "1 2",
      "1, Slip Left, 5 2, Pivot Left",
      "2, Slip Right, 6 3, Pivot Right"
    ]
  },

  calisthenics: {
    singles: [
      "Breakdown",
      "High Knees",
      "Alternating Checks",
      "Jumping Jacks",
      "1 2 1 2 1 2",
      "2 3 2 3 2 3",
      "3 Jumpsquats",
      "3 Speed Kicks Left",
      "3 Speed Kicks Right",
      "Left Check",
      "Right Check",
    ],
    combos: []
  },

  two_piece: {
    singles: [],
    combos: [
      "1 2",
      "2 3",
      "3 4",
      "5 6",
      "6 3",
      "1, Right Kick",
      "2, Switch Kick",
      "Inside Leg Kick, 2",
      "3, Low Kick",
      "Right Kick, 3",
      "Left Teep, Right Kick",
      "Left Teep, Switch Kick",
      "Right Kick, 2"
    ]
    // NOTE: added empty 'singles' to satisfy the required type; emphasis remains combos-focused
  },

  southpaw: {
    singles: [],
    combos: [
      "1 2",
      "1 1 2",
      "1 2 3",
      "1 2, 3 to the Body",
      "Slip Outside, 2 to the Body, 3 to the Head",
      "1 2, Pivot Left, 2",
      "1 2, Left Uppercut, 3",
      "Feint 1, Step Outside, 2, 2 to the Body",
      "3, Overhand, 2 3",
      "1, Slip, 2 3 2",
      "1 2, Left Body Kick",
      "1 2 3, Right Low Kick",
      "Left Teep, 2, Left Round Kick",
      "1, 2 to Body, Left High Kick",
      "1 2 3, Left Low Kick",
      "1 2, Switch Kick, 2",
      "Left Teep, 2, Clinch, Right Knee, Left Elbow",
      "Feint Left Kick, 1 2, Left Kick",
      "1 2 3, Left Elbow, Pivot Left",
      "1 1 2, Left Kick, Clinch, Double Knees"
    ]
  },

  muay_tech: {
    label: "muay_tech",
    title: "Muay Tech",
    description: "Technical timing, feints, sweeps, and counters",
    // Custom style: technical feints, sweeps, and counters
    singles: [
      "Feint Jab",
      "Cross",
      "Left Hook",
      "Right Kick",
      "Left Teep",
      "Right Teep",
      "Slip",
      "Parry Jab",
      "Sweep Left",
      "Lean Back"
    ],
    combos: [
      "Feint Teep, 2, Left Hook",
      "Parry Jab, 2, Rear Kick",
      "Lean Back, Counter Right Kick",
      "Slip, 2 3, Sweep",
      "Check, 2, Pivot Left",
      "Fake Kick, 2 3",
      "Teep, Step-in Right Elbow",
      "Oley Left, Head Kick",
      "Parry, 2 3, Right Teep",
      "1, Lean Back, Cross, Low Kick"
    ]
  },
  meat_potatoes: {
    label: "meat_potatoes",
    title: "Meat & Potatoes",
    description: "Classic, high-percentage strikes and combos for all levels",
    singles: [
      "Jab",
      "Cross",
      "Left Hook",
      "Right Kick",
      "Left Body Kick",
      "Right Low Kick",
      "Left Teep",
      "Right Teep"
    ],
    combos: [
      "1 2, Right Kick",
      "2 3, Low Kick",
      "1 2 3 2, Low Kick",
      "1, Rear Teep",
      "2 3, Rear Kick",
      "1 1 2, Left Body Kick",
      "Slip, 2, Right Kick",
      "1 2, Switch Kick",
      "2, Low Kick",
      "1 2 3, Right Kick"
    ]
  },
  buakaw: {
    label: "buakaw",
    title: "Buakaws Corner",
    description: "Aggressive clinch, knees, and sweeps inspired by Buakaw",
    singles: [
      "Jab",
      "Cross",
      "Left Hook",
      "Left Knee",
      "Right Knee",
      "Clinch",
      "Elbow",
      "Teep",
      "Sweep Right"
    ],
    combos: [
      "1, Step-in Clinch, Double Knees",
      "2, Long Guard, Rear Knee",
      "1 2, Clinch, Knee, Elbow",
      "Left Teep, Step-in, Double Knees",
      "Long Guard, Knee, Knee, Elbow",
      "1 4, Clinch, Double Knees",
      "Inside Low Kick, Clinch, Knee",
      "2, Clinch , Sweep Right",
      "Clinch Break, Elbow, Left Kick",
      "Switch Kick Switch Kick Switch Kick",
      "Catch Kick, Clinch, Knee"
    ]
  },
  low_kick_legends: {
    label: "low_kick_legends",
    title: "Low Kick Legends",
    description: "Devastating low kicks and classic Dutch-style combinations",
    singles: [
      "Cross",
      "Left Hook",
      "Right Low Kick",
      "Inside Low Kick",
      "Switch Kick",
      "Slip Right",
      "Overhand",
      "Double Jab"
    ],
    combos: [
      "1 2, Low Kick",
      "2 3, Low Kick",
      "1 1 2, Low Kick",
      "Overhand, Low Kick",
      "Slip, 2, Low Kick",
      "Inside Low Kick, 2",
      "3, Low Kick, 3",
      "2, Low Kick, Switch Kick",
      "Low Kick, High Kick"
    ]
  },
  elbow_arsenal: {
    label: "elbow_arsenal",
    title: "Elbow Arsenal",
    description: "Sharp elbow strikes and creative close-range attacks",
    singles: [
      "Jab",
      "Cross",
      "Left Hook",
      "Right Elbow",
      "Left Elbow",
      "Spinning Elbow",
      "Step-in Elbow",
      "Up Elbow",
      "Clinch"
    ],
    combos: [
      "1 2, Step-in Elbow",
      "3, Rear Elbow",
      "2, Up Elbow",
      "1, Pull Back, Up Elbow",
      "Clinch Break, Spinning Elbow",
      "Rear Kick, Step-in Elbow",
      "2, Left Elbow, Right Elbow",
      "1 4, Elbow, Knee",
      "Slip, Elbow",
      "Jumping Elbow, Cross"
    ]
  },
  ko_setups: {
    label: "ko_setups",
    title: "KO Setups",
    description: "Explosive knockout setups and finishing combinations",
    singles: [
      "Jab",
      "Cross",
      "Left Hook",
      "Overhand",
      "Right Kick",
      "Left High Kick",
      "Slip",
      "Rear Knee",
      "Elbow"
    ],
    combos: [
      "1 2, Head Kick",
      "Slip Right, 2, Rear Kick",
      "Right Low Kick, Right Head Kick",
      "1 1 2, Head Kick",
      "2 3, Head Kick",
      "1 2 3, Overhand",
      "Slip, 6 3 2",
      "Overhand, 3 to the Body, Low Kick",
      "2, Rear Knee, Elbow",
      "Teep, Step-in, Head Kick"
    ]
  },
};

export default INITIAL_TECHNIQUES;