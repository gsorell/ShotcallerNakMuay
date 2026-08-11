// ===========================================================================
// TECHNIQUE LIBRARY — the content behind the Pro "Learn" section.
// ---------------------------------------------------------------------------
// The app calls out ~106 distinct strings across 19 styles, but most of those
// are variants of the same idea ("Teep" / "Left Teep" / "Right teep") or the
// numeric shorthand for a punch ("1" = Jab). This file holds the CANONICAL
// concepts, and each entry lists the raw callout strings it explains via
// `matches`. `./techniqueIndex` uses that mapping to (a) resolve any callout
// back to its lesson and (b) derive which styles drill it, straight from
// `INITIAL_TECHNIQUES` so the two never drift apart.
//
// Numbering follows the app's own convention (see the Header glossary):
//   1 = Jab · 2 = Cross · 3 = Left Hook · 4 = Right Hook
//   5 = Left Uppercut · 6 = Right Uppercut
// ===========================================================================

export type TechniqueCategory =
  | "punches"
  | "kicks"
  | "knees"
  | "elbows"
  | "defense"
  | "clinch"
  | "feints"
  | "conditioning";

export interface LearnEntry {
  /** Stable id — used for routing and (later) progress tracking. */
  slug: string;
  /** Display name. */
  name: string;
  /** Thai name, where there is a standard one. */
  thai?: string;
  /** Numeric shorthand, if the technique has one. */
  numbering?: string;
  category: TechniqueCategory;
  /** One or two sentences: what it is and what it is for. */
  summary: string;
  /** How to throw it well. */
  keyPoints: string[];
  /** What people get wrong. */
  mistakes: string[];
  /**
   * Exact callout strings from `@/constants/techniques` that this entry
   * explains. Matched case-insensitively and whitespace-normalized.
   */
  matches: string[];
}

export interface CategoryMeta {
  key: TechniqueCategory;
  label: string;
  /** Emoji fallback, used only if the artwork fails to load. */
  icon: string;
  /** The app's own neon icon art, from `public/assets`. */
  iconPath: string;
  blurb: string;
}

// Display order of the category list. Artwork reuses the existing style icons
// so the Learn section looks like the rest of the app rather than a bolted-on
// emoji list — each category borrows the icon of the style that owns it.
export const CATEGORY_META: readonly CategoryMeta[] = [
  {
    key: "punches",
    label: "Punches",
    icon: "🥊",
    iconPath: "/assets/icon_boxing.png", // boxing glove
    blurb: "The numbered hands — your range-finders and your finishers.",
  },
  {
    key: "kicks",
    label: "Kicks",
    icon: "🦵",
    iconPath: "/assets/icon_tae.png", // Muay Tae — the kicker
    blurb: "Shin-first power, and the push kick that owns the distance.",
  },
  {
    key: "knees",
    label: "Knees",
    icon: "🙏",
    iconPath: "/assets/icon.feintsandfakes.png", // fighter driving a knee up
    blurb: "Khao — the close-range weapon Muay Khao fighters live on.",
  },
  {
    key: "elbows",
    label: "Elbows",
    icon: "💠",
    iconPath: "/assets/icon_sok.png", // Muay Sok — elbow strike
    blurb: "Sok — shortest, sharpest, and the reason Muay Thai cuts.",
  },
  {
    key: "defense",
    label: "Defense & Movement",
    icon: "🛡️",
    iconPath: "/assets/icon_femur.png", // Muay Femur — the technician's ring IQ
    blurb: "Not getting hit, and being somewhere useful afterward.",
  },
  {
    key: "clinch",
    label: "Clinch",
    icon: "🤝",
    iconPath: "/assets/icon_khao.png", // Muay Khao — the clinch fighter's wai
    blurb: "Pam — the grappling range that makes Muay Thai its own sport.",
  },
  {
    key: "feints",
    label: "Feints & Setups",
    icon: "🎭",
    iconPath: "/assets/icon.trickytraps.png", // a baited trap — sell the lie
    blurb: "Selling a lie so the real strike lands on an open target.",
  },
  {
    key: "conditioning",
    label: "Conditioning",
    icon: "🔥",
    iconPath: "/assets/icon.buakaw.png", // flexed arm — work capacity
    blurb: "The non-technique callouts — burnouts that spike the heart rate.",
  },
] as const;

export const TECHNIQUE_LIBRARY: readonly LearnEntry[] = [
  // -------------------------------------------------------------- PUNCHES --
  {
    slug: "jab",
    name: "Jab",
    thai: "Mat Na",
    numbering: "1",
    category: "punches",
    summary:
      "A straight punch with the lead hand. It is the most-thrown strike in the sport — less a knockout blow than a measuring tape, a distraction, and the front door to every combination.",
    keyPoints: [
      "Fire from where the hand already sits — no drawing it back first.",
      "Rotate the fist over at the end and land with the front two knuckles.",
      "Retract on the same line, fast; the jab is judged by how quickly it comes home.",
      "Keep the rear hand glued to your cheek the entire time.",
    ],
    mistakes: [
      "Dropping the hand on the way back, which invites the cross straight down the middle.",
      "Reaching with the shoulder and over-extending, so your weight lands on the front foot.",
      "Throwing it lazily as a rhythm-filler until it stops threatening anything.",
    ],
    matches: ["Jab", "1"],
  },
  {
    slug: "cross",
    name: "Cross",
    thai: "Mat Trong",
    numbering: "2",
    category: "punches",
    summary:
      "The straight rear hand, thrown across the body. Because it travels with your hips and back foot behind it, this is the hardest punch most fighters own.",
    keyPoints: [
      "Power starts at the rear foot — pivot the heel out and let the hip turn drive the arm.",
      "Travel in a straight line from your chin to the target; no looping.",
      "Land with the shoulder rising to shield your own jaw.",
      "Recover the hand to the guard, not to your hip.",
    ],
    mistakes: [
      "Punching with the arm alone and leaving the back foot flat — all shoulder, no power.",
      "Leaning the head forward past the front knee, which walks you into a counter hook.",
      "Telegraphing by loading the shoulder back before firing.",
    ],
    matches: ["Cross", "2"],
  },
  {
    slug: "lead-hook",
    name: "Left Hook",
    numbering: "3",
    category: "punches",
    summary:
      "A short, curved punch with the lead hand that arrives from outside the opponent's field of vision. It is the classic answer to anyone who slips or rolls toward your lead side.",
    keyPoints: [
      "Keep the elbow at roughly the same height as the fist — a flat, level arc.",
      "Turn the lead foot and knee inward; the punch is a hip rotation, not an arm swing.",
      "Stay compact — the hook loses power the moment it becomes wide.",
      "Keep the rear hand high; the hook opens your own guard on that side.",
    ],
    mistakes: [
      "Winding up wide so the opponent sees it coming from across the room.",
      "Dropping the elbow and turning it into an arm-punch with no hip behind it.",
      "Letting the head follow the punch and drift onto the centerline.",
    ],
    matches: ["Left Hook", "3"],
  },
  {
    slug: "rear-hook",
    name: "Right Hook",
    numbering: "4",
    category: "punches",
    summary:
      "The rear-hand hook. Slower to arrive than the lead hook but considerably heavier, it works best after something has pulled the opponent's guard to the other side.",
    keyPoints: [
      "Pivot hard on the rear foot — the whole back side of the body turns through.",
      "Keep the elbow bent at about ninety degrees and level with the fist.",
      "Best thrown as a follow-up, not a lead — it needs the opponent occupied.",
      "Bring the lead hand back to guard as the rear hand goes.",
    ],
    mistakes: [
      "Throwing it as the first punch of an exchange, where it is easy to see and time.",
      "Over-rotating and ending up square, which surrenders your stance and balance.",
      "Swinging from the shoulder with the elbow trailing behind the fist.",
    ],
    matches: ["Right Hook", "4"],
  },
  {
    slug: "lead-uppercut",
    name: "Left Uppercut",
    numbering: "5",
    category: "punches",
    summary:
      "A short lead-hand punch travelling upward into the chin or solar plexus. It lives in the gap between the opponent's gloves and is the natural punishment for a high, tight guard.",
    keyPoints: [
      "Dip slightly at the knees and drive up — legs first, arm second.",
      "Keep the elbow underneath the fist and the palm facing you.",
      "Stay short; anything past your own shoulder width is a loss of power and balance.",
      "Best at close range, after you have closed distance with something else.",
    ],
    mistakes: [
      "Dropping the hand low to load up, which announces it and opens your jaw.",
      "Throwing it from too far out, where the arc has nothing to hit.",
      "Leaning back on the punch instead of driving up through the legs.",
    ],
    matches: ["Left Uppercut", "5"],
  },
  {
    slug: "rear-uppercut",
    name: "Right Uppercut",
    numbering: "6",
    category: "punches",
    summary:
      "The rear-hand uppercut — the heaviest of the inside punches. It splits a high guard down the middle and is a standard finisher after body work has brought the elbows down.",
    keyPoints: [
      "Sit down into the rear leg, then extend up as the hip turns over.",
      "Keep it tight to your own centerline; it should feel almost vertical.",
      "Pair it with hooks — the change of angle is what makes it land.",
      "Keep the lead hand up; you are inside elbow range when you throw this.",
    ],
    mistakes: [
      "Scooping from the hip, which is slow and telegraphed.",
      "Throwing it at kicking range where it simply cannot reach.",
      "Standing straight up as you throw, losing both balance and power.",
    ],
    matches: ["Right Uppercut", "6"],
  },
  {
    slug: "overhand",
    name: "Overhand",
    category: "punches",
    summary:
      "A looping rear-hand punch that travels over the top of the opponent's guard or jab. It is the go-to weapon against a taller opponent or anyone hiding behind a high, straight guard.",
    keyPoints: [
      "Step the lead foot slightly offline as you throw, so you arrive at an angle.",
      "Drop the level a little first — the punch comes over, so you must start under.",
      "Let the arm follow the body's rotation; it is a whipping motion, not a push.",
      "Commit fully but keep the lead hand up as a shield.",
    ],
    mistakes: [
      "Throwing it flat-footed from square-on, where it is both weak and easy to counter.",
      "Winding all the way back — the loop should be tight, not a haymaker.",
      "Falling forward past your base, leaving nothing to defend with.",
    ],
    matches: ["Overhand"],
  },
  {
    slug: "double-jab",
    name: "Double Jab",
    numbering: "1 1",
    category: "punches",
    summary:
      "Two jabs in quick succession. The first occupies the guard and covers your entry, the second lands for real — it is the most reliable way to close distance behind your hands.",
    keyPoints: [
      "Make the first one short and quick, the second one longer and committed.",
      "Step in on the second, not the first, so you gain ground behind cover.",
      "Do not fully retract between the two — half back and out again.",
      "Have something ready behind it; the double jab is an entry, not an end.",
    ],
    mistakes: [
      "Throwing both at the same speed and power, which reads as one telegraphed reach.",
      "Standing still — the double jab without footwork wastes its whole purpose.",
      "Letting the rear hand drift while both jabs are out.",
    ],
    matches: ["Double Jab"],
  },
  {
    slug: "body-punching",
    name: "Punching to the Body",
    category: "punches",
    summary:
      "Any of the numbered punches redirected to the ribs, liver, or solar plexus. Body shots do not knock people out on contact — they take the legs and the breath away over rounds, and they pull the guard down so head shots land later.",
    keyPoints: [
      "Change level with your legs — bend the knees, keep the spine upright.",
      "Keep your eyes up and on the opponent while you are low.",
      "Land and immediately get back to your natural height; do not linger down there.",
      "The lead hook to the body under the elbow is the liver shot — aim just below the ribs.",
    ],
    mistakes: [
      "Bending at the waist instead of the knees, which drops your head onto a knee or uppercut.",
      "Dropping your eyes to look at the target.",
      "Staying crouched after the punch, giving away your head position.",
    ],
    matches: [
      "Jab to the Body",
      "1 to the Body",
      "Cross to the Body",
      "2 to the Body",
      "Left Hook to the Body",
      "3 to the Body",
      "Right Hook to the Body",
    ],
  },

  // ---------------------------------------------------------------- KICKS --
  {
    slug: "roundhouse-kick",
    name: "Roundhouse Kick",
    thai: "Tae Wiang",
    category: "kicks",
    summary:
      "The signature Muay Thai kick, landing with the shin rather than the foot. It swings through the target like a baseball bat rather than snapping at it, and it can be aimed at the legs, body, or head.",
    keyPoints: [
      "Step the support foot slightly offline and turn the heel toward the target.",
      "Rotate the hip fully over — the kick is thrown with the whole body turning.",
      "Swing the opposite arm down and across for counter-rotation and balance.",
      "Kick through the target, not to it; aim your shin past where they stand.",
    ],
    mistakes: [
      "Failing to pivot the support foot, which halves the power and wrecks the knee.",
      "Kicking with the foot or instep instead of the shin.",
      "Leaving the kicking-side hand low, which is exactly when the counter cross arrives.",
    ],
    matches: [
      "Body Kick",
      // Kept although nothing shipped calls it any more: "Middle Kick" was the
      // name in the callout data until it was renamed to the conventional
      // "Body Kick". Users who had customised a group keep their own copy of
      // the old string, and a saved technique that resolves to no lesson is a
      // dead end in the Learn section. Cheap to keep, so keep it.
      "Middle Kick",
      "Left Kick",
      "Right Kick",
      "Left Body Kick",
    ],
  },
  {
    slug: "head-kick",
    name: "Head Kick",
    thai: "Tae Kor",
    category: "kicks",
    summary:
      "A roundhouse kick aimed at the neck and head. Mechanically identical to the body kick but with more rotation and a higher finish — and the single most common way Muay Thai fights end.",
    keyPoints: [
      "Same mechanics as the body kick — commit to the hip turn, just carry it higher.",
      "Lean the upper body away as the leg comes up; the two counterbalance each other.",
      "Set it up with body kicks first so the hands start dropping.",
      "Recover the leg quickly and return to stance — a caught head kick is a sweep.",
    ],
    mistakes: [
      "Trying to lift the leg with the hip flexor instead of turning it over.",
      "Throwing it cold, with nothing done to lower the opponent's guard.",
      "Dropping both hands to help the leg get up there.",
    ],
    matches: ["Head Kick", "Left High Kick"],
  },
  {
    slug: "low-kick",
    name: "Low Kick",
    thai: "Tae Kha",
    category: "kicks",
    summary:
      "A roundhouse to the outside of the opponent's thigh, landing on the meat of the quad or the peroneal nerve. It is a cumulative weapon — each one takes a little more mobility away until the leg stops answering.",
    keyPoints: [
      "Aim through the far side of the leg, not at the surface.",
      "Keep the same full hip rotation you would use for a body kick.",
      "Throw it behind hands — a low kick on its own is easy to check.",
      "Target just above the knee for mobility, mid-thigh for accumulating damage.",
    ],
    mistakes: [
      "Chopping down at the leg instead of swinging through it.",
      "Throwing it as a lone, predictable strike so it gets checked onto your own shin.",
      "Dropping the head forward as you kick, into the path of a counter hook.",
    ],
    matches: ["Low Kick", "Right Low Kick"],
  },
  {
    slug: "inside-low-kick",
    name: "Inside Low Kick",
    category: "kicks",
    summary:
      "A kick to the inside of the opponent's lead thigh. It attacks the base directly — a clean one buckles the stance, opens the hips, and momentarily takes away their ability to kick back.",
    keyPoints: [
      "Throw it off the lead leg for speed; there is very little wind-up available.",
      "Angle the shin slightly upward into the inner thigh.",
      "Use it when their lead foot is weighted — that is when it does the most damage.",
      "Follow immediately with hands; the kick opens their guard as their base shifts.",
    ],
    mistakes: [
      "Telegraphing with a big step, which lets them simply lift the leg.",
      "Landing with the foot instead of the shin.",
      "Standing in front of them after it lands rather than moving off the line.",
    ],
    matches: ["Inside Leg Kick", "Inside Low Kick"],
  },
  {
    slug: "switch-kick",
    name: "Switch Kick",
    category: "kicks",
    summary:
      "A roundhouse thrown after quickly switching your feet, letting you kick with the lead leg at rear-leg power. The switch hides the telegraph and adds a burst of hip torque.",
    keyPoints: [
      "Make the switch a single beat — feet change and the kick is already leaving.",
      "Keep your height level through the switch; do not bounce up and down.",
      "Turn the support-foot heel over exactly as you would for any roundhouse.",
      "Land the shin, and swing the opposite arm down for balance.",
    ],
    mistakes: [
      "Hopping visibly before the kick, which turns it into an announcement.",
      "Making it two separate beats — switch, pause, kick — so it gets timed.",
      "Losing the hip rotation because the switch ate all the momentum.",
    ],
    matches: ["Switch Kick"],
  },
  {
    slug: "teep",
    name: "Teep",
    thai: "Theep",
    category: "kicks",
    summary:
      "The straight push kick — Muay Thai's jab for the legs. It is primarily a distance and rhythm tool: it stops forward pressure, breaks up combinations before they start, and puts opponents where you want them.",
    keyPoints: [
      "Lift the knee first, then extend — chamber, then push.",
      "Land with the ball of the foot or the heel, targeting hip, belt line, or solar plexus.",
      "Push through with the hips rather than snapping with the knee.",
      "Retract fast and put the foot back where it came from; a hanging leg gets caught.",
    ],
    mistakes: [
      "Swinging the leg up straight without chambering, which becomes a slow, weak reach.",
      "Leaning far back to gain reach, which sacrifices balance and power.",
      "Leaving the leg extended after contact, inviting a catch and sweep.",
    ],
    matches: ["Teep", "Left Teep", "Right Teep"],
  },
  {
    slug: "question-mark-kick",
    name: "Question Mark Kick",
    category: "kicks",
    summary:
      "A kick that starts on the path of a low kick and, at the last moment, whips up over the guard to the head. The name comes from the shape the foot traces — up, then hooking over.",
    keyPoints: [
      "Sell the low kick honestly with the first half of the motion.",
      "Raise the knee high before redirecting; the change happens at the knee, not the hip.",
      "Works best against opponents who have been checking or reacting to low kicks.",
      "Commit fully to the finish — a half-hearted one lands on the shoulder.",
    ],
    mistakes: [
      "Not selling the low kick, so there is no reason for the hands to drop.",
      "Throwing it early in a fight before the low-kick reaction has been built.",
      "Telegraphing the switch too early, turning it into a slow head kick.",
    ],
    matches: ["Question Mark Kick"],
  },
  {
    slug: "spinning-back-kick",
    name: "Spinning Back Kick",
    category: "kicks",
    summary:
      "A rear kick delivered by turning the back to the opponent and driving the heel straight out. It generates enormous linear force and is especially effective against someone rushing forward.",
    keyPoints: [
      "Turn the head first and find the target over your shoulder before the leg goes.",
      "Drive the heel out in a straight line — it is a thrust, not a swing.",
      "Best used on an opponent coming toward you; their momentum does half the work.",
      "Complete the rotation and return to stance facing them.",
    ],
    mistakes: [
      "Spinning blind without looking, which is how you kick empty air and get countered.",
      "Throwing it against a retreating opponent, where it cannot land.",
      "Stopping halfway through the spin and ending up with your back exposed.",
    ],
    matches: ["Spinning Back Kick"],
  },
  {
    slug: "spinning-heel-kick",
    name: "Spinning Heel Kick",
    category: "kicks",
    summary:
      "A spinning kick that travels in a horizontal arc, landing with the heel to the head or body. High risk and high reward — it ends fights, and it ends rounds badly when it misses.",
    keyPoints: [
      "Look over the shoulder to spot the target before committing the leg.",
      "Keep the kicking leg relatively straight and swing it through on a level plane.",
      "Use it off a missed strike of theirs, when they are momentarily stationary.",
      "Land back in stance, hands up, ready for the counter.",
    ],
    mistakes: [
      "Throwing it as a first strike where it is easy to see and step away from.",
      "Bending the leg and turning it into a weak, arm-height slap.",
      "Losing balance on the landing and giving up position entirely.",
    ],
    matches: ["Spinning Heel Kick", "Spinning Hook Kick"],
  },
  {
    slug: "speed-kicks",
    name: "Speed Kicks",
    category: "kicks",
    summary:
      "A burst of three quick kicks from the same leg without resetting the stance between them. This is a conditioning and rhythm drill — it trains the hip to re-chamber fast and builds the endurance to keep kicking late in a round.",
    keyPoints: [
      "Prioritize the return: re-chamber the leg fully between each kick.",
      "Keep the support foot pivoting each time rather than planting flat.",
      "Stay tall — do not let your height sink as fatigue sets in.",
      "Speed over power here; the goal is clean repetition.",
    ],
    mistakes: [
      "Letting the kicks degrade into sloppy leg swings by the third rep.",
      "Putting the foot all the way down between kicks, which defeats the drill.",
      "Dropping the hands as the legs get tired.",
    ],
    matches: ["3 Speed Kicks Left", "3 Speed Kicks Right"],
  },

  // ---------------------------------------------------------------- KNEES --
  {
    slug: "straight-knee",
    name: "Straight Knee",
    thai: "Khao Trong",
    category: "knees",
    summary:
      "A knee driven straight up into the body from close range. Knees are the defining weapon of the Muay Khao style — they punish anyone who wants to stand in the pocket and trade.",
    keyPoints: [
      "Drive the hip through the target; the knee is the point, the hip is the engine.",
      "Point the toe down and rise onto the ball of the support foot.",
      "Pull down with the hands — on the head, neck, or arms — as the knee goes up.",
      "Target the floating ribs, solar plexus, or sternum.",
    ],
    mistakes: [
      "Lifting only the knee without any hip extension, which produces a soft tap.",
      "Leaning too far back and losing the ability to follow up.",
      "Throwing knees from too far out, where they land with the thigh.",
    ],
    matches: ["Left Knee", "Right Knee", "Rear Knee"],
  },
  {
    slug: "step-in-knee",
    name: "Step-in Knee",
    category: "knees",
    summary:
      "A knee thrown while closing the gap with a step, so the technique carries your bodyweight forward into the target. It converts a knee from a clinch tool into an offensive entry.",
    keyPoints: [
      "Step onto the lead foot and let momentum load the rear knee.",
      "Keep your hands framing forward, ready to catch the neck as you arrive.",
      "Drive through the target rather than stopping on impact.",
      "Anticipate the clinch — you will usually end up there.",
    ],
    mistakes: [
      "Stepping too far and arriving off balance with your chin leading.",
      "Coming in high and straight into an uppercut or knee of their own.",
      "Not securing anything with the hands on arrival, so you get pushed off.",
    ],
    matches: ["Step-in Knee"],
  },
  {
    slug: "flying-knee",
    name: "Flying Knee",
    thai: "Khao Loi",
    category: "knees",
    summary:
      "A knee thrown with both feet leaving the ground. Spectacular, genuinely dangerous, and a substantial gamble — you are airborne and cannot change your mind.",
    keyPoints: [
      "Build momentum with a step or two before leaving the ground.",
      "Drive the non-kneeing leg up as well to gain height.",
      "Use it on an opponent moving toward you or backed onto the ropes.",
      "Keep both hands high on the way in — you have no other defense mid-air.",
    ],
    mistakes: [
      "Throwing it at a mobile opponent who simply steps offline.",
      "Jumping straight up rather than forward through the target.",
      "Dropping the hands during the flight, which is when the counter cross lands.",
    ],
    matches: ["Flying Knee"],
  },
  {
    slug: "jump-switch-knee",
    name: "Jump Switch Knee",
    category: "knees",
    summary:
      "A knee off the lead leg, set up by switching the feet in the air. The switch disguises which knee is coming and adds upward drive without the full commitment of a flying knee.",
    keyPoints: [
      "Switch and knee as one continuous motion, not two.",
      "Stay compact — a small hop is enough; height is not the point.",
      "Land back in a balanced stance ready to continue.",
      "Pairs naturally with the switch kick, since the entry looks identical.",
    ],
    mistakes: [
      "Making the switch big and obvious, which removes the disguise.",
      "Landing square with the feet parallel, which leaves you with no stance.",
      "Reaching with the knee instead of driving the hip.",
    ],
    matches: ["Jump Switch Knee"],
  },

  // --------------------------------------------------------------- ELBOWS --
  {
    slug: "horizontal-elbow",
    name: "Horizontal Elbow",
    thai: "Sok Tud",
    category: "elbows",
    summary:
      "An elbow swung across the body on a level plane, landing with the point or the forearm's leading edge. It is the shortest, hardest weapon available and the most common cause of cuts in the sport.",
    keyPoints: [
      "Turn the hips and shoulders through — the arm is only the last link.",
      "Keep it tight; the elbow should pass close to your own face.",
      "Land with the point of the elbow or just above it, not the flat of the forearm.",
      "It only exists at close range — you must be inside punching distance.",
    ],
    mistakes: [
      "Throwing it from punching range, where it swings through empty space.",
      "Winging it wide, which telegraphs the strike and exposes your ribs.",
      "Dropping the opposite hand as you turn over.",
    ],
    matches: ["Elbow", "Left Elbow", "Right Elbow"],
  },
  {
    slug: "up-elbow",
    name: "Up Elbow",
    thai: "Sok Ngat",
    category: "elbows",
    summary:
      "An upward elbow travelling into the chin along the same path an uppercut would take. It slips through the middle of a tight guard and is brutally effective in the clinch.",
    keyPoints: [
      "Drive up from the legs, exactly as with an uppercut.",
      "Keep the elbow tight to your centerline on the way up.",
      "Especially strong when the opponent ducks or lowers their level.",
      "Keep the other hand controlling or guarding — you are very close.",
    ],
    mistakes: [
      "Reaching up with the arm instead of driving with the legs and hips.",
      "Throwing it from outside, where there is nothing in range.",
      "Standing tall on it and losing the base underneath the strike.",
    ],
    matches: ["Up Elbow"],
  },
  {
    slug: "axe-elbow",
    name: "Axe Elbow",
    thai: "Sok Sap",
    category: "elbows",
    summary:
      "An elbow chopped downward onto the forehead, brow, or crown from above. It is the standard answer to an opponent who ducks low or drives in with their head down.",
    keyPoints: [
      "Raise the elbow high, then bring your bodyweight down behind it.",
      "Drop the level with your legs as it lands to add weight.",
      "Ideal against level-changers and forward-pressure fighters.",
      "Keep the free hand controlling their posture where you can.",
    ],
    mistakes: [
      "Chopping with the arm alone and no bodyweight behind it.",
      "Raising the elbow far too early, which gives the whole thing away.",
      "Leaving your own head unprotected while the arm is up high.",
    ],
    matches: ["Axe Elbow"],
  },
  {
    slug: "spinning-elbow",
    name: "Spinning Elbow",
    thai: "Sok Klap",
    category: "elbows",
    summary:
      "An elbow delivered by rotating the whole body away and bringing the point around behind the turn. It arrives from an angle the opponent's guard is not built for — but it costs you sight of them mid-spin.",
    keyPoints: [
      "Turn the head first and re-find the target as early in the rotation as possible.",
      "Keep the elbow tight to the body through the turn, then extend at the last moment.",
      "Throw it off a missed punch of theirs or immediately after your own combination.",
      "Finish facing them in stance — never with your back still turned.",
    ],
    mistakes: [
      "Spinning fully blind and hoping something is still there.",
      "Using it as a lead strike, where the setup does not exist.",
      "Over-rotating past the target and giving up your back.",
    ],
    matches: ["Spinning Elbow"],
  },
  {
    slug: "step-in-elbow",
    name: "Step-in Elbow",
    category: "elbows",
    summary:
      "An elbow thrown while stepping forward to close the gap, so you arrive already striking. It solves the elbow's central problem, which is that the range it needs is a range you must first get to.",
    keyPoints: [
      "Cover the entry with the lead hand or a jab as you step.",
      "Step onto the outside angle where you can, not straight up the middle.",
      "Land the elbow as the foot lands, so bodyweight is behind it.",
      "Be ready to clinch immediately afterward.",
    ],
    mistakes: [
      "Entering with the head high and unprotected.",
      "Stepping straight into the centerline, into their knee or uppercut.",
      "Throwing the elbow before the step has actually closed the range.",
    ],
    matches: ["Step-in Elbow"],
  },
  {
    slug: "step-off-elbow",
    name: "Step-Off Elbow",
    category: "elbows",
    summary:
      "An elbow thrown while stepping out to an angle rather than straight in. You leave the line of their attack and land from the side, where their guard is not facing.",
    keyPoints: [
      "Step the lead foot off at roughly forty-five degrees as they come forward.",
      "Turn your hips to face the new angle before you strike.",
      "Use their forward momentum — they walk past you into the elbow.",
      "Reset your stance immediately on the new angle.",
    ],
    mistakes: [
      "Stepping backward instead of to the side, which just gives up ground.",
      "Throwing the elbow before the feet have created the angle.",
      "Stepping off but leaving the head on the original line.",
    ],
    matches: ["Step-Off Elbow"],
  },

  // -------------------------------------------------------------- DEFENSE --
  {
    slug: "slip",
    name: "Slip",
    category: "defense",
    summary:
      "Moving the head just off the line of a straight punch so it passes by. Because your hands stay free and your feet stay planted, a slip leaves you in perfect position to counter.",
    keyPoints: [
      "Move from the waist and knees, not by leaning the neck.",
      "Slip just far enough — inches, not feet.",
      "Keep your eyes on the opponent throughout.",
      "Return to centre immediately, or better, punch on the way back.",
    ],
    mistakes: [
      "Over-slipping so far that you cannot counter and your balance is gone.",
      "Closing the eyes or turning the head away.",
      "Slipping straight into the path of the other hand.",
    ],
    matches: ["Slip", "Slip Left", "Slip Right"],
  },
  {
    slug: "roll",
    name: "Roll",
    category: "defense",
    summary:
      "Bending at the knees and rotating under a hook so it travels over your head or rolls off the shoulder. It is the standard defense against wide punches, and it loads your legs for a counter.",
    keyPoints: [
      "Dip with the legs and rotate — a U-shaped path under the punch.",
      "Keep the guard up; rolling is not a substitute for hands.",
      "Come up on the far side already in position to punch.",
      "Keep the chin tucked throughout the motion.",
    ],
    mistakes: [
      "Rolling with the waist only and leaving the head at the same height.",
      "Rolling in place repeatedly until an uppercut finds you.",
      "Coming up square and flat-footed with no counter available.",
    ],
    matches: ["Roll Left", "Roll Right"],
  },
  {
    slug: "duck",
    name: "Duck",
    category: "defense",
    summary:
      "Dropping straight down under a strike by bending the knees. Simpler than a roll and effective against high kicks and wide punches — but the position it leaves you in is a dangerous one to hold.",
    keyPoints: [
      "Bend the knees, keep the back straight, and keep your eyes up.",
      "Come back up immediately — the bottom of a duck is not a place to live.",
      "Come up offline rather than straight back into where you started.",
      "Keep the guard tight while you are down there.",
    ],
    mistakes: [
      "Bending at the waist, which puts your head out front for a knee or uppercut.",
      "Ducking repeatedly against a fighter who is waiting to time it.",
      "Dropping the eyes to the floor.",
    ],
    matches: ["Duck"],
  },
  {
    slug: "lean-back",
    name: "Lean Back",
    category: "defense",
    summary:
      "Pulling the upper body backward so a strike falls just short. It costs no footwork and can leave the opponent badly overextended — but it is the defense with the smallest margin for error.",
    keyPoints: [
      "Shift weight to the rear leg while keeping the feet planted.",
      "Keep the hands up; leaning is not a replacement for the guard.",
      "Come forward again immediately with a counter as they recover.",
      "Best against straight punches and teeps that are already near maximum range.",
    ],
    mistakes: [
      "Leaning so far you have no base and cannot counter or move.",
      "Relying on it against a fighter who steps in behind their strikes.",
      "Dropping the hands because the head is moving.",
    ],
    matches: ["Lean Back"],
  },
  {
    slug: "parry",
    name: "Parry",
    category: "defense",
    summary:
      "Redirecting an incoming straight punch to the side with a small movement of the hand. It requires far less energy than blocking and it opens a counter lane immediately.",
    keyPoints: [
      "Deflect, do not swat — a few inches of redirection is enough.",
      "Parry across your own body, not out to the side.",
      "Return the hand to guard instantly.",
      "Counter into the gap the parry just created.",
    ],
    mistakes: [
      "Reaching out to meet the punch, which opens your guard early.",
      "Over-parrying and dragging your own hand far off the centerline.",
      "Parrying and then standing still instead of countering.",
    ],
    matches: ["Parry Jab"],
  },
  {
    slug: "catch",
    name: "Catch",
    category: "defense",
    summary:
      "Receiving a straight punch on the palm of the rear glove. It is the most economical defense available against a cross — no head movement, no footwork, and your stance stays completely intact.",
    keyPoints: [
      "Meet the punch with the palm, absorbing it rather than pushing back.",
      "Keep the elbow in and the hand near your own face — catch close, not out front.",
      "Keep your eyes open and on them.",
      "Fire back immediately; the catch keeps you perfectly loaded to counter.",
    ],
    mistakes: [
      "Catching too far in front, which lets the punch drive your own glove into your face.",
      "Turning the head away as the punch arrives.",
      "Treating it as a complete answer rather than the first half of a counter.",
    ],
    matches: ["Catch Cross"],
  },
  {
    slug: "check",
    name: "Check",
    thai: "Bang",
    category: "defense",
    summary:
      "Lifting the shin to intercept an incoming kick, so their shin meets your bone instead of your thigh or ribs. A well-timed check hurts the kicker more than the kick would have hurt you.",
    keyPoints: [
      "Turn the knee outward and raise the shin so the bone faces the kick.",
      "Point the toe down and keep the shin angled, not flat.",
      "Keep the hands up — checking is a leg job, the guard does not change.",
      "Return the foot to stance immediately and be ready to fire back.",
    ],
    mistakes: [
      "Lifting the knee without turning it out, so the kick lands on the soft thigh.",
      "Checking late — a half-raised leg is worse than no check at all.",
      "Dropping the hands to help with balance.",
    ],
    matches: [
      "Left Check",
      "Right Check",
      "Alternating Checks",
      "Left Check Right Check",
      "Right Check, Left Check",
    ],
  },
  {
    slug: "check-and-return",
    name: "Check and Return",
    category: "defense",
    summary:
      "Checking a kick and immediately kicking back with the same leg as it comes down. The opponent is at their most vulnerable in the instant after their own kick, when their hip is still open and their base is not yet reset.",
    keyPoints: [
      "Do not put the checking foot down and reset — kick straight off the check.",
      "The leg is already loaded; use that, do not re-chamber from the floor.",
      "Aim low or mid; there is no time for anything elaborate.",
      "Train it as one motion so it becomes automatic rather than a decision.",
    ],
    mistakes: [
      "Pausing after the check, which surrenders the entire window.",
      "Rushing the return so badly that it is thrown off balance.",
      "Watching their kick land instead of already firing.",
    ],
    matches: ["Check and Return"],
  },
  {
    slug: "long-guard",
    name: "Long Guard",
    category: "defense",
    summary:
      "Extending the lead arm out toward the opponent's face to occupy the space between you. It is a classic Muay Thai frame — it disrupts their vision, measures range, and makes entries awkward.",
    keyPoints: [
      "Extend the lead arm with the palm out and the elbow slightly bent.",
      "Keep the rear hand tight to the chin behind the frame.",
      "Use it to interrupt their rhythm, then strike out from behind it.",
      "Do not hold it forever — it is a tool, not a resting position.",
    ],
    mistakes: [
      "Locking the arm out straight, where it can be grabbed and pulled.",
      "Letting the rear hand drift while the lead arm is extended.",
      "Standing behind it passively and giving up all initiative.",
    ],
    matches: ["Long Guard"],
  },
  {
    slug: "high-guard",
    name: "High Guard Block",
    category: "defense",
    summary:
      "The tight double-forearm shell — gloves at the temples, elbows in. It is the default protective position and the base every other defense returns to.",
    keyPoints: [
      "Gloves at the temples, elbows tucked in against the ribs.",
      "Absorb on the forearms and shoulders, keeping the head still behind them.",
      "Look through the gap between your gloves; never close your eyes.",
      "Move or counter out of the shell — do not just wait it out.",
    ],
    mistakes: [
      "Flaring the elbows out, which opens the body completely.",
      "Staying in the shell for long stretches while getting hit at will.",
      "Letting the gloves get pushed back into your own face.",
    ],
    matches: ["High Guard Block"],
  },
  {
    slug: "pivot",
    name: "Pivot",
    category: "defense",
    summary:
      "Turning on the lead foot to swing your rear foot around, changing your angle without changing your distance. It takes you off the line they are attacking and puts you where their stance is not facing.",
    keyPoints: [
      "Pivot on the ball of the lead foot and step the rear foot around.",
      "Keep the guard up and your eyes on them through the whole turn.",
      "Finish in a proper stance, not square.",
      "Pivot after a strike lands — it is the natural exit from a combination.",
    ],
    mistakes: [
      "Stepping backward instead of turning, which just gives up territory.",
      "Pivoting with the feet too close, which costs you your balance.",
      "Turning the body without moving the feet, so you stay on the same line.",
    ],
    matches: ["Pivot Left", "Pivot Right"],
  },
  {
    slug: "angle-off-hook",
    name: "Angle Off Hook",
    category: "defense",
    summary:
      "Throwing a hook and using the rotation to step out to a new angle behind it. The punch and the exit become one motion, so you finish the exchange somewhere they are not aiming.",
    keyPoints: [
      "Let the hook's hip rotation carry the feet — do not fight it.",
      "Step the rear foot around as the punch lands.",
      "Keep the guard tight on the way out; you are moving past their hands.",
      "Reset your stance on the new angle and immediately reassess.",
    ],
    mistakes: [
      "Throwing the hook, then stopping, then trying to move as an afterthought.",
      "Angling off directly into their power side.",
      "Dropping the lead hand as you turn away.",
    ],
    matches: ["Angle Off Hook"],
  },
  {
    slug: "slip-and-counter",
    name: "Slip and Counter",
    category: "defense",
    summary:
      "Slipping a punch and firing back into the opening it leaves, as a single motion. This is where defense becomes offense — the opponent is extended, committed, and momentarily unable to defend.",
    keyPoints: [
      "Counter on the way back to centre, not after you have fully recovered.",
      "Slip outside their lead hand where possible — the safest place to be.",
      "Keep the counter short and direct; there is no time for a wind-up.",
      "Drill it as one beat until the counter needs no decision.",
    ],
    mistakes: [
      "Slipping, admiring the miss, and then countering far too late.",
      "Slipping into the path of their other hand.",
      "Countering with something wide that gives them time to recover.",
    ],
    matches: ["Slip and Counter"],
  },

  // ---------------------------------------------------------------- CLINCH --
  {
    slug: "clinch",
    name: "Clinch",
    thai: "Pam",
    category: "clinch",
    summary:
      "The grappling range unique to Muay Thai, where fighters control each other's head, neck, and arms. It is where knees, short elbows, and sweeps live — and in Thailand it is heavily scored.",
    keyPoints: [
      "Fight for inside position — hands inside their arms, on the back of the neck.",
      "Keep your own posture upright and break theirs down.",
      "Stay chest-to-chest and hip-to-hip; space is what lets them knee you.",
      "Constantly off-balance them rather than standing and holding.",
    ],
    mistakes: [
      "Pulling down with the arms alone instead of using bodyweight and posture.",
      "Letting them get double inside control on the neck.",
      "Standing tall and passive, which is both scoreless and dangerous.",
    ],
    matches: ["Clinch"],
  },
  {
    slug: "sweep",
    name: "Sweep",
    category: "clinch",
    summary:
      "Taking the opponent's base out from under them by combining an off-balancing pull with a step or leg block. Sweeps score visibly and drain the opponent's confidence in the clinch.",
    keyPoints: [
      "Break their balance first with the upper body; the leg only finishes it.",
      "Step your foot behind or across their base at the moment they are loaded on one leg.",
      "Turn your hips through the direction you want them to fall.",
      "Stay standing and composed as they go down.",
    ],
    mistakes: [
      "Going for the leg before their weight has actually been displaced.",
      "Throwing them, which is illegal — a sweep trips or off-balances, it does not lift.",
      "Falling down with them and losing the score.",
    ],
    matches: ["Sweep Left", "Sweep Right"],
  },
  {
    slug: "hand-trap",
    name: "Hand Trap",
    category: "clinch",
    summary:
      "Briefly pinning, pushing, or pulling the opponent's guard hand out of position to open a lane for the strike behind it. A small, cheap action that creates a hole where there was not one.",
    keyPoints: [
      "Move their hand across their own centerline, not just out to the side.",
      "Strike the instant the trap happens — the opening closes very fast.",
      "Use the lead hand to trap so the rear hand stays loaded.",
      "Keep it subtle; a big grab is obvious and gets countered.",
    ],
    mistakes: [
      "Holding the trap too long, which lets them free the hand and punish you.",
      "Trapping with both hands and leaving yourself entirely open.",
      "Trapping without anything ready behind it.",
    ],
    matches: ["Hand Trap"],
  },

  // ---------------------------------------------------------------- FEINTS --
  {
    slug: "jab-feint",
    name: "Jab Feint",
    category: "feints",
    summary:
      "Starting the jab convincingly and stopping it short, to draw a reaction. The opponent's blink, parry, or slip tells you what they do under pressure — and hands you the opening for the real strike.",
    keyPoints: [
      "Sell it with the shoulder and a small extension, then cut it off.",
      "Watch what they do; the information is the whole point.",
      "Have the real strike loaded before you feint.",
      "Vary it with real jabs, or they will stop respecting it.",
    ],
    mistakes: [
      "Feinting so lightly that nothing is sold and nothing reacts.",
      "Over-extending on the feint so it becomes a slow, weak real jab.",
      "Feinting on a fixed rhythm until they read it.",
    ],
    matches: ["Jab Feint"],
  },
  {
    slug: "body-jab-feint",
    name: "Body Jab Feint",
    category: "feints",
    summary:
      "Dropping the level and starting a jab to the body to pull their guard and eyes downward, then coming back up top. It is the most direct way to make a high guard open.",
    keyPoints: [
      "Change level with the legs so the feint is genuinely believable.",
      "Keep your eyes up on their guard, not on the body target.",
      "Come back up with the real strike as their hands drop.",
      "Mix in actual body jabs so the feint keeps working.",
    ],
    mistakes: [
      "Bending at the waist, which puts your head in range while you are low.",
      "Staying low too long and getting kneed or uppercut.",
      "Feinting low but not actually threatening, so nothing moves.",
    ],
    matches: ["Body Jab Feint"],
  },
  {
    slug: "shoulder-feint",
    name: "Shoulder Feint",
    category: "feints",
    summary:
      "A sharp twitch of the shoulder that suggests a punch without moving the hands. It is the cheapest feint available — almost no energy, no exposure, and it still buys a reaction.",
    keyPoints: [
      "Move only the shoulder; the hands stay exactly where they are.",
      "Make it sharp and short — a twitch, not a sway.",
      "Use it constantly to keep them guessing at zero cost.",
      "Read the reaction and take whatever it opens.",
    ],
    mistakes: [
      "Rocking the whole torso, which is slow and telegraphs your own movement.",
      "Doing it so often and so rhythmically that it stops registering.",
      "Feinting with no plan for what follows.",
    ],
    matches: ["Shoulder Feint"],
  },
  {
    slug: "step-feint",
    name: "Step Feint",
    category: "feints",
    summary:
      "A short, sharp step toward the opponent that threatens an entry without committing to one. It provokes a defensive reaction you can then attack, and it lets you steal ground a few inches at a time.",
    keyPoints: [
      "Make the step small and sudden — a stab forward, not a lunge.",
      "Keep your stance intact so you can genuinely go either way.",
      "Watch whether they retreat, freeze, or strike, and act on it.",
      "Follow up occasionally with a real entry so the threat stays live.",
    ],
    mistakes: [
      "Stepping so far that you are committed and cannot recover.",
      "Losing stance width and ending up with the feet together.",
      "Feinting entries but never actually entering.",
    ],
    matches: ["Step Feint"],
  },
  {
    slug: "switch-step-feint",
    name: "Switch Step Feint",
    category: "feints",
    summary:
      "Switching your stance briefly to suggest a switch kick or lead-leg attack, then reverting or attacking from the new stance. It forces the opponent to re-solve which side the danger is on.",
    keyPoints: [
      "Make the switch look identical to the one you use for a real switch kick.",
      "Stay level through the switch — no bouncing.",
      "Be genuinely willing to attack from the switched stance sometimes.",
      "Keep the guard consistent so the switch is the only thing that changes.",
    ],
    mistakes: [
      "Switching so slowly that they simply strike you mid-transition.",
      "Only ever feinting from it, so they learn to ignore it.",
      "Ending up square with the weight evenly split.",
    ],
    matches: ["Switch Step Feint"],
  },
  {
    slug: "low-kick-feint",
    name: "Low Kick Feint",
    category: "feints",
    summary:
      "Beginning the motion of a low kick to draw a check, then attacking somewhere else. Once an opponent commits to checking, they are standing on one leg and cannot answer anything.",
    keyPoints: [
      "Sell the hip turn — the check is a reaction to the hip, not the foot.",
      "Have the follow-up ready for the instant their leg comes up.",
      "Go high or go to the hands while they are balanced on one foot.",
      "Throw real low kicks regularly so the check reflex exists to exploit.",
    ],
    mistakes: [
      "Feinting before establishing any real low-kick threat.",
      "Committing so far into the feint that it becomes a bad kick.",
      "Missing the window because the follow-up was not preloaded.",
    ],
    matches: ["Low Kick Feint"],
  },
  {
    slug: "teep-feint",
    name: "Teep Feint",
    category: "feints",
    summary:
      "Chambering the knee as if to teep, then doing something else. Because the teep is the technique that controls distance, threatening it makes opponents freeze or retreat — and both reactions are useful.",
    keyPoints: [
      "Chamber the knee properly; the chamber is what sells it.",
      "Read whether they check, retreat, or freeze.",
      "Convert to a kick, a step-in, or hands from the same chambered position.",
      "The double version — two chambers in a row — is especially good at freezing people.",
    ],
    mistakes: [
      "A lazy half-chamber that does not look like a real teep.",
      "Holding the chamber too long, which invites them to attack the standing leg.",
      "Always converting to the same follow-up.",
    ],
    matches: ["Teep Feint", "Double Teep Feint"],
  },
  {
    slug: "body-kick-feint",
    name: "Body Kick Feint",
    category: "feints",
    summary:
      "Starting the hip rotation of a body kick to pull their elbow down and their guard around, then striking the gap that opens. Big feints for big reactions.",
    keyPoints: [
      "Commit the hip turn far enough that the arm genuinely comes down.",
      "Recover balance quickly — this is a large motion to abort.",
      "Attack the head side they just uncovered.",
      "Land real body kicks first so the reaction is trained into them.",
    ],
    mistakes: [
      "Feinting with the leg only, so their guard never moves.",
      "Getting caught off balance mid-abort.",
      "Feinting from too far out for the follow-up to reach.",
    ],
    matches: ["Body Kick Feint"],
  },
  {
    slug: "limp-feint",
    name: "Limp Feint",
    category: "feints",
    summary:
      "Deliberately showing damage or fatigue you do not have — a limp, a wince, hands dropping — to invite the opponent to commit. A trap, not a technique: you are selling an opening in order to counter it.",
    keyPoints: [
      "Sell it with the whole body, briefly, then be completely ready.",
      "Know exactly which counter you want before you bait.",
      "Use it sparingly; it works once or twice, not all night.",
      "Stay genuinely defensively sound behind the act.",
    ],
    mistakes: [
      "Selling it so well you actually stop defending.",
      "Overusing it until they realise it is theatre.",
      "Baiting without a specific counter prepared.",
    ],
    matches: ["Limp Feint"],
  },
  {
    slug: "retreat-feint",
    name: "Retreat Feint",
    category: "feints",
    summary:
      "Stepping back to invite the opponent forward, then meeting them as they come. Their forward momentum adds to your counter, which is why fighters get caught hardest when they are chasing.",
    keyPoints: [
      "Retreat under control, with the stance intact and weight balanced.",
      "Give only a step or two — enough to invite, not enough to be trapped.",
      "Plant the rear foot and fire as they step in.",
      "Straight counters and teeps work best against a chaser.",
    ],
    mistakes: [
      "Retreating in a straight line until you run out of ring.",
      "Backing up with the feet crossing or the stance collapsing.",
      "Inviting them in without being ready to actually meet them.",
    ],
    matches: ["Retreat Feint"],
  },
  {
    slug: "lazy-teep",
    name: "Lazy Teep",
    category: "feints",
    summary:
      "A deliberately soft, low-effort teep thrown to establish a pattern rather than to do damage. You are teaching the opponent that your teep is harmless — right before it stops being harmless.",
    keyPoints: [
      "Keep it genuinely light and slightly slow, but repeat it consistently.",
      "Establish the pattern over several exchanges before breaking it.",
      "Break it with a hard teep, a kick from the same chamber, or an entry.",
      "Keep the chamber the same as your real teep so nothing gives it away.",
    ],
    mistakes: [
      "Being so lazy with it that they simply catch the leg.",
      "Never cashing in the pattern you built.",
      "Using a visibly different chamber for the lazy and real versions.",
    ],
    matches: ["Lazy Teep"],
  },
  {
    slug: "guard-bait",
    name: "Guard Bait",
    category: "feints",
    summary:
      "Intentionally exposing a target — dropping a hand, leaving the body open — to invite a specific strike you already know how to counter. You choose which punch they throw.",
    keyPoints: [
      "Bait one specific opening so you know exactly what is coming.",
      "Have the counter fully rehearsed and preloaded.",
      "Keep the rest of your defense genuinely tight.",
      "Close the bait the instant they commit.",
    ],
    mistakes: [
      "Baiting an opening you cannot actually defend if they take it fast.",
      "Leaving the bait open too long against a sharp opponent.",
      "Baiting without a specific counter, which is just being open.",
    ],
    matches: ["Guard Bait"],
  },
  {
    slug: "pattern-break",
    name: "Pattern Break",
    category: "feints",
    summary:
      "Deliberately establishing a repeated sequence, letting the opponent start timing it, then changing the ending. Every pattern you show is a setup you are building, whether you intend it or not.",
    keyPoints: [
      "Repeat a sequence two or three times so it genuinely registers.",
      "Change the final strike, not the entry — the entry is what they are reading.",
      "Watch for the moment they start moving early; that is the cue to break.",
      "Keep the timing identical so only the ending is different.",
    ],
    mistakes: [
      "Breaking the pattern before it has actually been established.",
      "Changing the entry too, so they never had a read to punish.",
      "Repeating so many times that you get countered before you break it.",
    ],
    matches: ["Pattern Break"],
  },

  // ---------------------------------------------------------- CONDITIONING --
  {
    slug: "burpee",
    name: "Burpee",
    category: "conditioning",
    summary:
      "A full drop to the floor and back up, thrown into a round to spike your heart rate. The point is not the burpee itself — it is learning to produce clean technique immediately afterward, while gassed.",
    keyPoints: [
      "Get back to your stance fast; the recovery is the part that matters.",
      "Hands come straight back to guard as you stand.",
      "Keep breathing rhythmically rather than holding your breath.",
      "Expect the next callout immediately and be ready to strike.",
    ],
    mistakes: [
      "Standing up and pausing to recover instead of returning to work.",
      "Coming up with the hands down.",
      "Sacrificing the technique that follows because you are winded.",
    ],
    matches: ["1 Burpee"],
  },
  {
    slug: "jumpsquats",
    name: "Jump Squats",
    category: "conditioning",
    summary:
      "Explosive squat jumps dropped into a round. They load the legs quickly, which makes everything afterward — kicking, checking, staying in stance — considerably harder, and that is the training effect.",
    keyPoints: [
      "Land softly through the knees rather than slapping the floor.",
      "Keep the chest up and the back straight.",
      "Return to a proper stance immediately after the last rep.",
      "Keep the hands up throughout.",
    ],
    mistakes: [
      "Letting the knees cave inward on landing.",
      "Half-squatting to make them easier, which defeats the purpose.",
      "Dropping the guard while the legs work.",
    ],
    matches: ["3 Jumpsquats"],
  },
  {
    slug: "jumping-jacks",
    name: "Jumping Jacks",
    category: "conditioning",
    summary:
      "A light, continuous conditioning movement used to keep the heart rate elevated without loading the legs heavily. Often used as an active-recovery callout rather than a hard burst.",
    keyPoints: [
      "Stay light on the balls of the feet.",
      "Keep the breathing steady and controlled — use it to recover.",
      "Return to stance cleanly on the last rep.",
      "Keep your eyes forward as if the opponent is still there.",
    ],
    mistakes: [
      "Treating it as a rest and dropping out of fight posture entirely.",
      "Landing heavily and flat-footed.",
      "Losing the round's rhythm because the movement is easy.",
    ],
    matches: ["Jumping Jacks"],
  },
  {
    slug: "high-knees",
    name: "High Knees",
    category: "conditioning",
    summary:
      "Fast alternating knee drives on the spot. It doubles as conditioning and as knee-mechanics practice — the same hip drive that powers a real knee strike, at speed and volume.",
    keyPoints: [
      "Drive the knees to hip height or above.",
      "Stay on the balls of the feet with a quick tempo.",
      "Keep the torso upright rather than leaning back.",
      "Keep the hands up in guard or pulling down as if clinching.",
    ],
    mistakes: [
      "Letting the knee height drop as fatigue sets in.",
      "Leaning back to make the knees easier to lift.",
      "Letting the arms swing loosely instead of holding a fighting posture.",
    ],
    matches: ["High Knees"],
  },
  {
    slug: "punch-burnouts",
    name: "Punch Burnouts",
    category: "conditioning",
    summary:
      "Rapid repeated punch sequences — 1-2-1-2-1-2 or 2-3-2-3-2-3 — thrown at maximum output. They build shoulder endurance and teach you to keep punches technically sound when the arms are burning.",
    keyPoints: [
      "Keep every punch returning fully to the guard, even at speed.",
      "Keep the feet planted in stance; do not let it become an arm-flail.",
      "Breathe out on every punch rather than holding your breath.",
      "Prioritize technique over raw speed as fatigue arrives.",
    ],
    mistakes: [
      "Letting the hands stop coming back once the shoulders burn.",
      "Standing square and losing the stance entirely.",
      "Shortening the punches into pushes rather than strikes.",
    ],
    matches: ["1 2 1 2 1 2", "2 3 2 3 2 3"],
  },
];
