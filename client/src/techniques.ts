export const INITIAL_TECHNIQUES: Record<string, { singles: string[]; combos: string[]; exclusive?: boolean; label?: string; title?: string }> = {
  // Nak Muay Newb - Start here to learn the Art of 8 Limbs
  // exclusive: true means this emphasis should not be combined with other styles
  newb: {
    label: 'newb',
    title: 'Nak Muay Newb',
    singles: [
      "Jab",
      "Cross",
      "Lead Hook",
      "Rear Hook",
      "Lead Uppercut",
      "Rear Uppercut",
      "Overhand",
      "Jab to the Body",
      "Cross to the Body",
      "Lead Hook to the Body",
      "Rear Hook to the Body",
      "Lead Teep",
      "Rear Teep",
      "Lead Check",
      "Rear Check",
      "Inside Leg Kick",
      "Switch Kick",
      "Low Kick",
      "Middle Kick",
      "Head Kick",
      "Lead Knee",
      "Rear Knee",
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
      "Lead teep",
      "Rear teep",
      "Lead Knee",
      "Rear Knee",
      "Lead Check",
      "Rear Check",
      "Lead Kick",
      "Rear Kick",
      "Lead Elbow",
      "Rear Elbow",
      "Spinning Elbow"
    ],
    combos: [
      "1, Step-in Rear Knee, Pivot Left",
      "2, Step-in Lead Knee",
      "High Block March, Lead Knee, Rear Knee",
      "1, 2, Clinch, Double Knees",
      "1, 4, Switch Knee, Elbow",
      "Lead Check, 2, 3, 2",
      "Rear Check, 3, 2, 3",
      "2, Lead Elbow, Rear Elbow",
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
      "Lead Teep", "Rear Teep", "Lead Knee", "Rear Knee", "Lead Check",
      "Rear Check", "Lead Kick", "Rear Kick",
      "Lead Elbow", "Rear Elbow",
    ],
    combos: [
      "1, 2, 3",
      "3, Low Kick, 3",
      "2, Inside Leg Kick, 2, 3",
      "1, 2 to the Body, 3",
      "Overhand, Lead Knee, 6, 3",
      "Catch Body Kick, 2, 3",
      "1, Overhand, 3 to the Body, 3",
      "1, 2, 3, Step-in Rear Elbow",
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
      "Lead Teep", "Rear Teep", "Lead Knee", "Rear Knee",
      "Lead Check", "Head Kick",
      "Rear Check", "Lead Kick", "Rear Kick", "Lead Check",
      "Rear Check", "Lead Check",
      "Lead Elbow", "Rear Elbow",
    ],
    combos: [
      "1, Rear Kick",
      "Double Rear Kick", "Double Lead Kick",
      "1, 2, Switch Kick",
      "Rear Kick, Lead Kick",
      "Lead Teep, Rear Kick",
      "Rear Kick, Rear Teep",
      "Rear Low Kick, Rear High Kick",
      "2, 3, Spinning Back Kick",
      "Inside Leg Kick, Switch Kick",
      "2, 3, Low Kick, Rear Check",
      "Double Jab, 2, Low Kick",
      "3, 2, Low Kick",
      "1, 2, Rear Kick, Lead Kick",
    ]
  },

  femur: {
    label: 'femur',
    title: 'Muay Femur',
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Lead Teep", "Rear Teep", "Lead Knee", "Rear Knee", "Lead Check",
      "Rear Check", "Flying Knee", "Lead Kick", "Rear Kick", "Head Kick",
      "Lead Elbow", "Rear Elbow", "Spinning Elbow", "Question Mark Kick",
      "Sweep Left", "Sweep Right", "Lead Check", "Rear Check"
    ],
    combos: [
      "Check Kick, Rear Low Kick",
      "6, 3, Rear Knee, Rear Elbow",
      "Parry Jab, Lead Kick",
      "Lean Back, Rear Low Kick",
      "Lead Teep, Rear Knee, Sweep Left",
      "Thai Hop, Axe Elbow",
      "Inside Leg Kick, Switch Knee",
      "1, Oley Left, Head Kick",
      "1, Oley Right, Head Kick",
      "Catch Kick, Cross",
      "Parry, 2, 3, Rear Kick",
      "Rear Kick, Rear Teep",
      "Rear Teep, Question Mark Kick",
      "Step Through, Lead Kick",
      "Lead Teep, Switch Knee, Rear Elbow",
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
      "Lead Teep", "Rear Teep", "Lead Knee", "Rear Knee", "Lead Check",
      "Rear Check", "Lead Kick", "Rear Kick",
      "Lead Elbow", "Rear Elbow", "Axe Elbow", "Spinning Elbow",
    ],
    combos: [
      "1, 2, Rear Elbow",
      "1, Rear Elbow",
      "3, Rear Elbow",
      "Parry Jab, Uppercut Elbow",
      "2, Roll Right, Rear Elbow",
      "Clinch, Lead Up Elbow, Rear Elbow",
      "Lead Elbow, Rear Elbow, Lead Elbow",
      "Double Jab, 2, Jumping Elbow",
      "2, 3, Rear Up Elbow",
      "Switch Knee, Rear Elbow",
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
      "Rear Kick, 3",
      "Lead Teep, Rear Kick",
      "Lead Teep, Switch Kick",
      "Rear Kick, 2"
    ]
    // NOTE: added empty 'singles' to satisfy the required type; emphasis remains combos-focused
  },
};

export default INITIAL_TECHNIQUES;