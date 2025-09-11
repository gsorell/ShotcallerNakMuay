export const INITIAL_TECHNIQUES: Record<string, { singles: string[]; combos: string[]; exclusive?: boolean; label?: string; title?: string }> = {
  // Nak Muay Newb - Start here to learn the Art of 8 Limbs
  // exclusive: true means this emphasis should not be combined with other styles
  newb: {
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
      "Flying knee",
      "Left kick",
      "right kick",
      "Left elbow",
      "Right elbow",
      "Spinning Elbow"
    ],
    combos: [
      "1, Step-in Right Knee",
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
      "1, 6, 3, 4, Knee"
    ]
  },

  mat: {
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Left teep", "Right teep", "Left Knee", "Right Knee", "Left Check",
      "Right Check", "Flying knee", "Left kick", "right kick",
      "Left elbow", "Right elbow", "Spinning Elbow"
    ],
    combos: [
      "1, 2, 3",
      "1, 2, 3, Right Low Kick, left check",
      "1, 2 to the body, 3",
      "Catch body kick, 2, 3",
      "1, Overhand, clinch, push",
      "1, 2, 3, Step-in Right Elbow",
      "1, 1, 2",
      "2, 3, 2",
      "1 to the Body, 2",
      "Overhand, 4 to the body, 3 to the body, 3 to the head",
    ]
  },

  tae: {
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Left teep", "Right teep", "Left Knee", "Right Knee", "Left Check",
      "Right Check", "Flying knee", "Left kick", "right kick",
      "Left elbow", "Right elbow", "Spinning Elbow"
    ],
    combos: [
      "1, Right Kick",
      "1, 2, Switch kick",
      "Lead Teep, Right Kick",
      "Right Low Kick, Right High Kick",
      "1, 2, 3, Spinning Back Kick",
      "Inside leg Kick, Right  Kick, left check",
      "2, 3, Low kick, right check",
      "Double Jab, 2, Low kick",
      "3, 2, Low kick",
      "1, 2, right kick, left kick",
    ]
  },

  femur: {
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Left teep", "Right teep", "Left Knee", "Right Knee", "Left Check",
      "Right Check", "Flying knee", "Left kick", "right kick",
      "Left elbow", "Right elbow", "Spinning Elbow"
    ],
    combos: [
      "Check Kick, Right Low Kick",
      "Slip right, 6, 3, right knee, right elbow",
      "Parry Jab, Left Kick",
      "Lean Back, Right Low Kick",
      "Olay Left",
      "Olay right",
      "Catch Kick, Right Cross, Leg Sweep",
      "Parry, Cross, Hook, right kick",
      "Left teep, switch knee, right elbow",
      "switch kick, 2, 3, 2",
      "Lean back, Cross, Low kick"
    ]
  },

  sok: {
    singles: [
      "1", "2", "3", "4", "5", "6",
      "Left teep", "Right teep", "Left Knee", "Right Knee", "Left Check",
      "Right Check", "Flying knee", "Left kick", "right kick",
      "Left elbow", "Right elbow", "Spinning Elbow"
    ],
    combos: [
      "1, 2, right Elbow",
      "1, spinning elbow",
      "3, Spinning Elbow",
      "Parry jab, Uppercut Elbow",
      "1, axe Elbow",
      "Clinch, Left up Elbow, right Elbow",
      "Left elbow, right elbow, left elbow",
      "Double Jab, 2, jumping elbow",
      "Slip, Hook, right up elbow",
      "Switch Knee, right Elbow",
      "1, 2, 3, Spinning Elbow"
    ]
  },

  boxing: {
    singles: [
      "Jab", "Cross", "Left Hook", "Right Hook", "Left Uppercut", "Right Uppercut",
      "1 to the body", "2 to the body", "3 to the body", "Pivot left",  "Pivot right", "duck",
    ],
    combos: [
      "1, 1, 2",
      "1, 2, 3",
      "1, 2, 3, 2",
      "1, 2, 5, 2",
      "2, 3, 2",
      "1, slip right, 2",
      "1, 2, 3 to the body, 3 to the head",
      "1, 2, Roll right, Cross, Hook",
      "1, 2 to body, 3",
      "Feint Jab, Right Cross",
      "1, slip left, 5, 2, slip right, 6, 3"
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
      "3 speed kicks right"
    ],
    combos: []
  }
};

export default INITIAL_TECHNIQUES;