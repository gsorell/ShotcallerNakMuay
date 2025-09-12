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
      "1, Step-in Right Knee, pivot left",
      "2, Step-in Left Knee",
      "High block march, left knee, right knee",
      "1, 2, Clinch, Double Knees",
      "1, 4, Switch Knee, Elbow",
      "Left check, 2, 3, 2",
      "Right check, 3, 2, 3",
      "2, Left elbow, Right elbow",
      "Knee, Elbow, knee",
      "1, 2, 3 to the body, 3 to the head",
      "Knee, Knee, knee",
      "1, 4, switch Knee"
    ]
  },

  mat: {
    label: 'mat',
    title: 'Muay Mat',
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Left teep", "Right teep", "Left Knee", "Right Knee", "Left Check",
      "Right Check", "Left kick", "right kick",
      "Left elbow", "Right elbow",
    ],
    combos: [
      "1, 2, 3",
      "3, Low Kick, 3",
      "2, Inside Leg Kick, 2, 3",
      "1, 2 to the body, 3",
      "Overhand, Left knee, 6, 3",
      "Catch body kick, 2, 3",
      "1, Overhand, 3 to the body, 3",
      "1, 2, 3, Step-in Right Elbow",
      "Double Jab, Cross",
      "2, 3, 2",
      "1 to the Body, 2",
      "Overhand, 4 to the body, 3 to the body",
    ]
  },

  tae: {
    label: 'tae',
    title: 'Muay Tae',
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Left teep", "Right teep", "Left Knee", "Right Knee", 
      "Left Check", "head kick",
      "Right Check",  "Left kick", "right kick", "left check", 
      "right check", "left check",
      "Left elbow", "Right elbow", 
    ],
    combos: [
      "1, Right Kick",
      "Double right kick", "double left kick",
      "1, 2, Switch kick",
      "Right kick, Left kick",
      "Lead Teep, Right Kick",
      "Right kick, Right teep",
      "Right Low Kick, Right High Kick",
      "2, 3, Spinning Back Kick",
      "Inside leg Kick, Switch Kick",
      "2, 3, Low kick, right check",
      "Double Jab, 2, Low kick",
      "3, 2, Low kick",
      "1, 2, right kick, left kick",
    ]
  },

  femur: {
    label: 'femur',
    title: 'Muay Femur',
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Left teep", "Right teep", "Left Knee", "Right Knee", "Left Check",
      "Right Check", "Flying knee", "Left kick", "right kick", "Head Kick",
      "Left elbow", "Right elbow", "Spinning Elbow", "Question mark kick",
      "sweep left", "Sweep right", "Left check", "Right check"
    ],
    combos: [
      "Check Kick, Right Low Kick",
      "6, 3, right knee, right elbow",
      "Parry Jab, Left Kick",
      "Lean Back, Right Low Kick",
      "Lead teep, right knee, sweep left",
      "Thai hop, Axe Elbow",
      "Inside leg kick, Switch knee",
      "1, Olay Left, head kick",
      "1, Olay right, head kick",
      "Catch Kick, Right Cross",
      "Parry, 2, 3, right kick",
      "Right kick, right teep",
      "Right teep, question mark kick",
      "Step through, left kick",
      "Lead teep, switch knee, right elbow",
      "switch kick, 2, 3, 2",
      "1, Lean back, Cross, Low kick",
      "2, switch kick, 2, 3, low kick"
    ]
  },

  sok: {
    label: 'sok',
    title: 'Muay Sok',
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Left teep", "Right teep", "Left Knee", "Right Knee", "Left Check",
      "Right Check", "Flying knee", "Left kick", "right kick",
      "Left elbow", "Right elbow", "Axe Elbow", "Spinning Elbow", "Sweep left", "Sweep right"
    ],
    combos: [
      "1, 2, right Elbow",
      "1, right elbow",
      "3, Right Elbow",
      "Parry jab, Uppercut Elbow",
      "2, roll right, right elbow",
      "Clinch, Left up Elbow, right Elbow",
      "Left elbow, right elbow, left elbow",
      "Double Jab, 2, jumping elbow",
      "2, 3, right up elbow",
      "Switch Knee, right Elbow",
      "1, 2, 3, Spinning Elbow"
    ]
  },

  boxing: {
    label: 'boxing',
    title: 'Boxing',
    singles: [
      "Jab", "Cross", "3", "4", "5", "6", "Overhand", 
      "high guard block", "Parry jab", "Catch cross",
      "1 to the body", "2 to the body", "3 to the body", 
      "Pivot left",  "Pivot right", "duck",
    ],
    combos: [
      "1, 1, 2",
      "1, 2, 3",
      "1, 2, 3, 2",
      "1, 2, 5, 2",
      "2, 3, 2",
      "3, 3, 3",
      "2, 2, 2",
      "1, slip right, 2",
      "1, 2, 3 to the body, 3 to the head",
      "1, 2, Roll right, Cross, Hook",
      "1, 2 to body, 3",
      "Feint Jab, Right Cross",
      "1, slip left, 5, 2", 
      "2, slip right, 6, 3"
    ]
  },

  calisthenics: {
    singles: [
      "Breakdown",
      "3 pushups",
      "Alternating checks",
      "3 jumping jacks",
      "1, 2, 1, 2, 1, 2",
      "2, 3, 2, 3, 2, 3",
      "3 jumpsquats",
      "3 speed kicks left",
      "3 speed kicks right",
      "Left check",
      "Right check",
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
      "1, right kick",
      "2, switch kick",
      "Inside leg kick, 2",
      "3, low kick",
      "right kick, 3",
      "Lead teap, right kick",
      "Lead teap, switch kick",
      "Right kick, 2"
    ]
    // NOTE: added empty 'singles' to satisfy the required type; emphasis remains combos-focused
  },
};

export default INITIAL_TECHNIQUES;