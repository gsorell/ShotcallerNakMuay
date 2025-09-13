export const INITIAL_TECHNIQUES: Record<string, { singles: string[]; combos: string[]; exclusive?: boolean; label?: string; title?: string }> = {
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
      "Left kick",
      "right kick",
      "Left elbow",
      "Right elbow",
      "Spinning Elbow"
    ],
    combos: [
      "1, Step-in Right Knee, Pivot Left",
      "2, Step-in Left Knee",
      "High Block March, Left Knee, Right Knee",
      "1, 2, Clinch, Double Knees",
      "1, 4, Switch Knee, Elbow",
      "Left Check, 2, 3, 2",
      "Right Check, 3, 2, 3",
      "2, Left Elbow, Right Elbow",
      "Knee, Elbow, knee",
      "1, 2, 3 to the body, 3 to the head",
      "Knee, Knee, knee",
      "1, 4, Switch Knee"
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
      "1, 2, 3",
      "3, Low Kick, 3",
      "2, Inside Leg Kick, 2, 3",
      "1, 2 to the Body, 3",
      "Overhand, Left Knee, 6, 3",
      "Catch Body Kick, 2, 3",
      "1, Overhand, 3 to the Body, 3",
      "1, 2, 3, Step-in Right Elbow",
      "Double Jab, Cross",
      "2, 3, 2",
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
      "Double Right Kick", "Double Left Kick",
      "1, 2, Switch Kick",
      "Right Kick, Left Kick",
      "Lead Teep, Right Kick",
      "Right Kick, Right Teep",
      "Right Low Kick, Right High Kick",
      "2, 3, Spinning Back Kick",
      "Inside Leg Kick, Switch Kick",
      "2, 3, Low Kick, Right Check",
      "Double Jab, 2, Low Kick",
      "3, 2, Low Kick",
      "1, 2, Right Kick, Left Kick",
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
      "Check Kick, Right Low Kick",
      "6, 3, Right Knee, Right Elbow",
      "Parry Jab, Left Kick",
      "Lean Back, Right Low Kick",
      "Lead Teep, Right Knee, Sweep Left",
      "Thai Hop, Axe Elbow",
      "Inside Leg Kick, Switch Knee",
      "1, Oley Left, Head Kick",
      "1, Oley Right, Head Kick",
      "Catch Kick, Right Cross",
      "Parry, 2, 3, Right Kick",
      "Right Kick, Right Teep",
      "Right Teep, Question Mark Kick",
      "Step Through, Left Kick",
      "Lead Teep, Switch Knee, Right Elbow",
      "Switch Kick, 2, 3, 2",
      "1, Lean Back, Cross, Low Kick",
      "2, Switch Kick, 2, 3, Low Kick"
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
      "1, 2, Right Elbow",
      "1, Right Elbow",
      "3, Right Elbow",
      "Parry Jab, Uppercut Elbow",
      "2, Roll Right, Right Elbow",
      "Clinch, Left Up Elbow, Right Elbow",
      "Left Elbow, Right Elbow, Left Elbow",
      "Double Jab, 2, Jumping Elbow",
      "2, 3, Right Up Elbow",
      "Switch Knee, Right Elbow",
      "1, 2, 3, Spinning Elbow"
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
      "1, 1, 2",
      "1, 2, 3",
      "1, 2, 3, 2",
      "1, 2, 5, 2",
      "2, 3, 2",
      "3, 3, 3",
      "2, 2, 2",
      "1, Slip Right, 2",
      "1, 2, 3 to the Body, 3 to the Head",
      "1, 2, Roll Right, Cross, Hook",
      "1, 2 to Body, 3",
      "Feint Jab, Right Cross",
      "1, Slip Left, 5, 2",
      "2, Slip Right, 6, 3"
    ]
  },

  calisthenics: {
    singles: [
      "Breakdown",
      "3 Pushups",
      "Alternating Checks",
      "3 Jumping Jacks",
      "1, 2, 1, 2, 1, 2",
      "2, 3, 2, 3, 2, 3",
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
      "1, 2",
      "2, 3",
      "3, 4",
      "5, 6",
      "6, 3",
      "1, Right Kick",
      "2, Switch Kick",
      "Inside Leg Kick, 2",
      "3, Low Kick",
      "Right Kick, 3",
      "Lead Teep, Right Kick",
      "Lead Teep, Switch Kick",
      "Right Kick, 2"
    ]
    // NOTE: added empty 'singles' to satisfy the required type; emphasis remains combos-focused
  },
};

export default INITIAL_TECHNIQUES;