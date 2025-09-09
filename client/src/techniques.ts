// Minimal, safe seed of techniques used by the editor/timer.
// Edit entries later in the Technique Editor UI or in this file.
export const INITIAL_TECHNIQUES: Record<string, { singles: string[]; combos: string[] }> = {
  khao: {
    singles: ["1","2","3","4","5","6","Left teep","Right teep","Left Knee","Right Knee","Flying knee","Left kick","Right kick","Left elbow","Right elbow","Spinning Elbow"],
    combos: [
      "Jab, Step-in Straight Knee",
      "Jab, Cross, Clinch, Double Knees",
      "Right Hook, Clinch Pull-down, Right Knee to Head",
      "High Guard Block, Clinch, Knee",
      "Clinch, Multiple Knees, Dump",
      "Feint Low, Flying Knee",
      "Knee, Elbow",
      "Uppercut, Knee, Elbow",
      "Knee, Knee, Clinch",
      "Elbow, Uppercut, Knee"
    ]
  },
  mat: {
    singles: ["1","2","3","4","5","6","Left teep","Right teep","Left Knee","Right Knee","Flying knee","Left kick","Right kick","Left elbow","Right elbow","Spinning Elbow"],
    combos: [
      "Jab, Cross, Left Hook",
      "Jab, Cross, Left Hook, Right Low Kick",
      "Jab high, Cross to body, Hook high",
      "Catch body kick, Right Cross, Left Hook",
      "Right Overhand, Spinning Left Backfist",
      "Jab, Cross, Left Hook, Step-in Right Elbow",
      "Jab, Jab, Cross",
      "Cross, Hook, Cross",
      "Jab to Body, Cross to Head",
      "Overhand, Hook, Cross"
    ]
  },
  tae: {
    singles: ["1","2","3","4","5","6","Left teep","Right teep","Left Knee","Right Knee","Flying knee","Left kick","Right kick","Left elbow","Right elbow","Spinning Elbow"],
    combos: [
      "Jab, Right Roundhouse Kick",
      "Jab, Cross, Switch Left Roundhouse Kick",
      "Lead Teep, Right Roundhouse Kick",
      "Right Low Kick, Right High Kick",
      "Jab feint, Spinning Back Kick",
      "Switch Left Low Kick, Right Roundhouse Kick",
      "Jab, Cross, Low kick",
      "Double Jab, Cross, Low kick",
      "Hook, Cross, Low kick",
      "Jab, Body kick, High kick"
    ]
  },
  femur: {
    singles: ["1","2","3","4","5","6","Left teep","Right teep","Left Knee","Right Knee","Flying knee","Left kick","Right kick","Left elbow","Right elbow","Spinning Elbow"],
    combos: [
      "Check Kick, Counter Right Low Kick",
      "Slip Jab, Right Uppercut, Left Hook",
      "Parry Jab, Right High Kick",
      "Lean Back, Right Low Kick",
      "Left Hook with pivot, Right Roundhouse Kick",
      "Catch Kick, Right Cross, Leg Sweep",
      "Parry, Cross, Hook",
      "Slip, Cross, Hook, Low kick",
      "Check hook, Cross",
      "Lean back, Cross, Low kick"
    ]
  },
  sok: {
    singles: ["1","2","3","4","5","6","Left teep","Right teep","Left Knee","Right Knee","Flying knee","Left kick","Right kick","Left elbow","Right elbow","Spinning Elbow"],
    combos: [
      "Jab, Cross, Horizontal Elbow",
      "Hook, Spinning Elbow",
      "Parry, Uppercut Elbow",
      "Jab, Overhand, Downward Elbow",
      "Clinch, Horizontal Elbow, Uppercut Elbow",
      "Push kick, Cross, Spear Elbow",
      "Double Jab, Cross, Horizontal Elbow",
      "Slip, Hook, Spinning Elbow",
      "Knee, Downward Elbow",
      "Jab, Cross, Hook, Spinning Elbow"
    ]
  },
  boxing: {
    singles: ["1","2","3","4","5","6","Jab","Cross","Hook","Uppercut","Body Shot"],
    combos: [
      "Jab, Jab, Cross",
      "Jab, Cross, Lead Hook",
      "Jab, Cross, Lead Hook, Cross",
      "Jab, Cross, Lead Uppercut, Cross",
      "Cross, Lead Hook, Cross",
      "Jab, Slip, Cross",
      "Jab, Jab, Body Hook",
      "Jab, Cross, Roll, Cross, Hook",
      "Jab high, Cross to body, Hook high",
      "Feint Jab, Right Cross"
    ]
  },
  calisthenics: {
    singles: ["Breakdown","5 pushups","5 jumpsquats","5 speed kicks left","5 speed kicks right"],
    combos: []
  }
};

export default INITIAL_TECHNIQUES;