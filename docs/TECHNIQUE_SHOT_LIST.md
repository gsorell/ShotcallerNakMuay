# Technique shot list — visual reference for the learning module

## What this is for

The Learn lesson cards (and the roadmap level cards that reuse them) have room for a
small visual beside the body copy — see the accordion body in
`src/features/roadmap/components/RoadmapSection.tsx`. The plan is to fill that slot
with a short looping sprite of the technique being thrown.

The output is a **neon silhouette**, not a photograph. The slot is roughly 150px on
desktop and smaller on a phone, so photographic detail is wasted at that size, and a
silhouette matches the app's existing icon art. That makes the shoot forgiving: you do
not need good lighting, a nice gym, or a photogenic model. You need a background that
contrasts with the fighter, and correct form.

Everything below is keyed to the lesson `slug` in
`src/features/learn/data/techniqueLibrary.ts`. One visual per lesson — **not** per
callout, because the cards already group callouts by lesson.

- 63 lessons in the library
- **25** of them are taught by the Start Here roadmap → Tier 1, **shot**
- **1** more (`double-jab`) is derived from a Tier 1 sheet rather than filmed — see
  *Derived sheets* below
- **37 remain** → Tier 2, and some of those should probably never get one (see below)

**These 37 are not visible in the app.** Learn shows the figures and nothing else, so a
lesson with no sheet is not on the shelf at all — its written content still sits in
`techniqueLibrary.ts` and appears the moment a sheet lands. The list below is therefore
also the list of lessons currently unreachable from Learn.

## Why we film rather than generate

Image generators do not know Muay Thai. They produce plausible-and-wrong: a flat rear
foot on a cross, a "check" that is really a knee, a round kick landing on the instep.
This app's glossary already carries a note about having shipped a technique description
that was wrong for half the stances it supports, and it tells users to learn form from a
qualified coach. Filling the learning module with hallucinated technique cuts against
that directly.

Generation is still useful for the *treatment* — glow, background, upscaling a
silhouette already pulled from real footage. Just not for deciding where the limbs go.

## Shooting spec

**The one thing that matters most:** fixed tripod, no zoom, no camera movement, and
identical framing across every take. A coherent set beats any individual shot. Mark the
tripod position and the fighter's starting spot on the floor with tape and do not move
either until the whole tier is shot.

| | |
|---|---|
| Background | Plain and evenly lit, and — see below — a **contrast pair** with the fighter, not merely plain. A racquetball court is close to ideal: measured, its walls and floor sit within 0.04 of each other, so one threshold handles both. |
| Wardrobe | Dark, and **unprinted**. A light graphic on a dark top is brighter than the fabric and punches holes in the torso. Plain shorts and bare shins read far better in silhouette than baggy gear. |
| Framing | Full body with headroom, **including for punches** — the lessons repeatedly teach that power starts at the feet, so the feet must be in frame. |
| Frame rate | 60fps if the phone offers it. More frames to choose from during extraction. |
| Reps | Three clean reps per technique, with a pause between. Best one gets picked in the edit. |
| Slate | Say the technique name out loud before each set. The audio marks the takes so they can be split automatically. |
| Stance | Shoot orthodox throughout. The app is stance-neutral in its wording, so the card copy stays correct either way, and mirrored variants can be flipped in CSS rather than shot twice. |

**Output format:** one sprite sheet per lesson, 6 frames laid out horizontally, lossless
WebP, at `public/assets/technique/<slug>.webp`. Six frames covers load → travel → land →
recover for a strike, and a fixed count keeps the CSS `steps()` animation uniform. Not
GIF: 256 colours band badly across the neon gradients, at 5–10× the file size.

Lossless is not a preference here. ffmpeg's *lossy* WebP encoder writes a bare `VP8 `
chunk, which has no way to store an alpha channel — the encode reports success and every
silhouette arrives on an opaque black box. Only the lossless `VP8L` path carries alpha.
Flat-coloured silhouettes compress well losslessly anyway, so it costs very little.

Budget is roughly 2MB for all 25, measured from real keyed footage at ~79KB a sheet,
against an app that already ships audio.

## What the court test showed

Measured off real footage shot in a racquetball court — dark top, dark shorts, bare
legs, static camera. Luma on a 0–1 scale:

| Region | Luma | |
|---|---|---|
| Ceiling light | 0.97 | background |
| Floor, near feet | 0.64 | background |
| Floor, open | 0.63 | background |
| Wall, behind head | 0.63 | background |
| Wall, left | 0.60 | background |
| Thigh, bare skin | 0.30 | fighter |
| Shirt | 0.26 | fighter |
| Calf, bare skin | 0.25 | fighter |
| Shoe | 0.16 | fighter |
| Shorts | 0.02 | fighter |

Three things follow, and they change the spec above.

**The feet are not the risk.** Bare skin sits at 0.25–0.30 against a floor at 0.63 —
a wider margin than the torso gets. Any cutoff between about 0.40 and 0.55 separates
them, and bare feet key as cleanly as shoes. This was the obvious worry going in and
it is unfounded.

**What matters is a contrast pair, not a plain wall.** The fighter and the background
have to sit at opposite ends of the luma range. A shirtless fighter in daylight sits
mid-range and will fail against a bright wall no matter how plain that wall is — that
is exactly how the first test clip failed, with no usable threshold anywhere between
0.55 and 0.85.

**What did survive the key was the room, not the body**: the seam where the wall meets
the floor, and scuff marks on the wall. Both are thin and a body is not, so the
pipeline now opens the mask — erode, then dilate — and they disappear. That is the
`clean` setting, defaulting to 2 passes. Drop it to 0 to keep fine detail such as
open fingers; raise it in a scruffier room.

## Catching the strike

Six frames spread evenly across a window will miss a fast technique. A jab is at
full extension for roughly 60ms; six frames over a two-second window land one
every 333ms, so the odds of catching extension are about one in six. On the first
real footage it lost three times in a row and produced six frames of guard — a
sprite in which the punch is never thrown.

So the pipeline finds the strike before choosing frames. It measures the
horizontal span of the silhouette across the window at 30fps, takes the widest
frame as the moment of furthest extension, and places the six frames so that
extension lands on frame four — three of wind-up, two of recovery. This is the
`anchor` setting and it is on by default. Set it to a timestamp to pin extension
by hand, or to `false` for even sampling.

One detail worth keeping: measure the span by counting only columns that hold a
few stacked dark pixels, never a plain bounding box. The one-pixel seam where a
court wall meets the floor reaches both edges of frame, so a bounding box reports
every frame as maximally wide and the peak is meaningless.

## Keeping the silhouette solid

A limb at full speed is motion-blurred, so its edge blends toward the wall and the
key drops out in patches. That reads two ways, both bad: grey shading inside a body
that should be one flat colour, and a chewed, broken profile line.

Three settings fix it, and the order they run in matters more than any of them:

- `solid` forces every mask pixel fully opaque or fully clear, removing the
  half-transparent pixels that read as shading. On by default.
- `clean` opens the mask (erode, then dilate) to delete thin room features.
- `close` closes it (dilate, then erode) to fill interior holes and weld the gaps
  motion blur tore in the outline.

All of it happens at **source resolution**, with the downscale to the cell running
last and supplying the anti-aliasing. Run the same passes after the downscale and
they chew visible 256px blocks out of the profile — the opposite of the intent.
With `solid` on, `softness` stays at 0: feathering before a threshold only shifts
the outline outward.

## Fast techniques need their own settings

Kicks and teeps blur far more than punches, because the foot covers more ground
than a fist. Measured on a teep at full extension, against a wall at 0.82 and a
floor at 0.76:

| Part | Luma |
|---|---|
| Torso | 0.09 |
| Standing shin | 0.33 |
| Kicking thigh | 0.49 |
| Shin, blurred | 0.45 |
| **Foot tip, blurred** | **0.79** |

The blurred foot tip is brighter than the floor. No threshold recovers it — the
foot has smeared far enough into the wall that it is no longer distinguishable,
and raising the cutoff past 0.76 floods the floor in before the foot comes back.

What does work is raising the cutoff just short of the floor and leaning harder on
the opening pass: **`cutoff` 0.67 with `clean` 6** recovers most of the foot while
the extra erosion strips the wood grain that starts keying in alongside it.
Punches stay fine at 0.60 / 3 — they simply do not blur as much.

**The real fix is at the camera.** These clips were shot at 30fps; the spec asks
for 60, which halves the exposure per frame and so halves the smear. That single
change would remove this whole class of problem at source rather than trading
cutoff against floor grain in post.

## Keeping only the fighter

Opening deletes thin noise but not compact noise. A knot in the floorboards or a
scuff the size of a fist survives any number of erosion passes and lands in the
sprite as a speck floating beside the body — and pushing `clean` high enough to
remove it starts eating the standing leg.

`isolate` solves it by definition rather than by size: label the mask's connected
regions and keep only what is joined to the largest one. Anything not attached to
the fighter is gone regardless of how big it is. On by default.

`isolateMin` (0.04) keeps separate regions worth at least that fraction of the
main body, so a blurred foot that genuinely broke away from the leg survives while
floor grain does not.

This runs as its own pass — ffmpeg builds the mask, node relabels it, ffmpeg merges
it back — because ffmpeg has no connected-component filter. Two things to know if
that pass is ever touched: the mask must be emitted as raw grey rather than an
image format, so node can read it without needing a PNG decoder; and
`alphaextract` needs an explicit `format=rgba` immediately before it, or the graph
fails to configure against a raw grey sink.

## Framing inside the cell

Two settings decide whether a sprite reads as complete.

`margin` (0.07 per side) fits the figure inside an inset rather than the full
cell. Without it, a technique that reaches — a teep, a switch kick — lands hard
against the boundary and the glow, which extends several pixels past the
silhouette, is sliced off square. It looks like the fighter was cropped even
though every pixel of them is present.

`hold` repeats the peak frame. A guard is a position, not a movement, and at an
even six frames it flickers past the thing it is meant to teach. `hold: 2` parks
the animation on the held shape for half the loop.

Worth auditing rather than eyeballing. Two checks catch nearly everything:
compare each crop against the fighter's bounding box over the exact frames the
sprite uses (catches a crop that cuts them off), and check whether the finished
mask touches any cell edge (catches a figure that fills the cell with no room for
the glow). The first found three clipped sprites, the second found five more —
and the two kicks among them were cropping the extended leg, which is the entire
point of the picture.

## Easing, and picking the right peak per technique

`hold` repeats the peak frame, which emphasises a position but stops the loop
dead — it reads as broken rather than deliberate. `ease` is the better tool: it
bunches the frames toward the peak so every frame stays distinct while the
technique visibly settles into its shape. 1 is even spacing; 2 to 3 reads as a
pause. Both guards use 2.4.

No single measure finds the peak of every technique, and using the wrong one
picks a frame between reps:

| Technique | What peaks |
|---|---|
| Punches, kicks, teeps | Horizontal reach |
| Roll, duck, slip | Lowest head position |
| Pivot | Narrowest silhouette — the completed turn |
| High guard | Chin tucked so the head vanishes into the guard — not raised hands |
| Long guard | Widest upper body only, ignoring the legs |

## What makes a room usable, measured

The court worked because of one property, and it is worth stating precisely
because the second location failed on it: **every part of the fighter was darker
than every part of the background, everywhere in frame.** Body 0.02–0.30, skin
up to 0.49, walls and floor 0.60–0.76. One threshold, no exceptions.

A gym shot afterwards failed, and not by a little. Measured:

| | luma |
|---|---|
| Wall | 0.73 |
| Grey floor | 0.71 |
| Fighter, body | 0.11–0.42 |
| **Green turf underfoot** | **0.27** |
| **Black rubber strip** | **0.25** |
| **Foot, lit from above** | **0.64** |

Two separate failures in one frame. The floor he stands on is *inside* the
fighter's range, so it keys as body and stays joined to his feet — isolation
cannot tell them apart because they genuinely are one region. And hard overhead
light blows the top of the foot to 0.64 against a floor of 0.71, a margin
narrower than the noise. Above the shins the rule is "bright is background";
below them it is "dark is background". No single threshold does both, and a
retouch cannot rescue it either: the feet come out as notches cut from a slab,
so restoring them means drawing feet rather than trimming an edge.

**The test before rolling** is therefore not "is the wall plain" but: stand at
the camera and check that the darkest thing behind the fighter is still brighter
than the brightest thing on him — *including under his feet*, which is the part
everyone forgets.

Three cheap fixes, in order of preference:

1. **Something light under his feet.** A white mat, a sheet, flattened card. It
   turns the one band that fails into the one that works, and costs nothing.
2. **Dark socks.** Bare feet lit from above are the brightest thing on a fighter;
   socks put them back at about 0.16 without changing the silhouette's shape at
   150px.
3. **Move out from under the light.** The same overhead lamp that blows the foot
   also blows the top of the thigh — visible as holes in the mask that only the
   closing pass fills.

## A silhouette cannot show a limb that overlaps the body

The one real limitation of this whole approach, found the hard way on the
rear-leg check.

Shot side-on, a check with the *lead* leg reads perfectly: the knee lifts on the
camera side, against the wall, and there is background between the raised shin
and the standing leg. The same check with the *rear* leg does not read at all.
The leg comes up in front of the torso, so every pixel of it sits inside the
body's own outline — and a silhouette has no way to draw it. The sprite comes
out as a fighter standing in guard.

Nothing downstream can recover this. It is not the key, not the morphology
(2/0 and 5/3 are identical here), and not the take: all three rear-check reps in
the solo footage — 97.55, 99.70, 102.10 — have the same geometry. The
information was never in the frame.

**So the test when shooting is not "is the technique correct" but "does every
moving part break the body's outline".** Stand where the camera is and look:
if a limb travels across the torso rather than away from it, that camera
position cannot capture the technique, however good the form is.

For the techniques this affects — anything where the far-side limb works across
the body — the fix is a second camera position at roughly three-quarters,
turned so the working side opens toward the lens. Shoot the same rep from both
and keep whichever breaks the outline.

## Floor reflection

A varnished court reflects the fighter, and the reflection is joined to the feet,
so `isolate` cannot remove it — it is attached to the body by definition.

Lowering the cutoff to shed it does not work, and it is worth recording why,
because the measurement that suggested it looked convincing. A luma profile taken
straight down the body at one moment showed the fighter at 0.05–0.34 against a
contact reflection at 0.53, implying a cutoff near 0.50 would separate them
cleanly. It does at that spot. It does not anywhere else: the court is lit
unevenly, and elsewhere in the same clip bare skin measures up to 0.49. A cutoff
of 0.50 therefore eats the body — feet first, since skin is the brightest part of
the fighter — and the silhouettes come back spotty with clipped feet.

**One profile is not a calibration.** Sample several points across the session
before moving a threshold, or leave the per-class values alone: 0.60 for static
and defensive work, 0.63 for punches, 0.65–0.67 for kicks and knees.

The reflection is best treated at the camera instead — matte floor, or a shooting
position that keeps the contact point out of frame.
## Retouching in Photoshop

Some floor survives every automatic pass. A reflection or contact shadow is
*joined* to the foot, so isolation cannot cut it, and the cutoff range that would
remove it overlaps bare skin. That last bit is a hand job.

**Paint the mask, never the sprite.** The finished sprite has the glow baked in,
so erasing floor there leaves a halo exactly where the floor was, and painting
flat colour back over a limb cannot restore its edge. The mask is one channel,
black and white, and everything downstream is regenerated from it.

```
node scripts/technique-sprites.mjs --export-masks retouch
```

That writes two files per technique at the sprite's exact geometry — 1536x256,
six cells across:

- `<slug>.mask.png` — the alpha. White keeps, black drops. This is the one to edit.
- `<slug>.plate.png` — the same six frames as footage, for seeing what you are
  painting. Without it you are editing a white shape with no way to tell a foot
  from its reflection.

In Photoshop: open the plate, **File > Place Embedded** the mask above it, commit
at 100%, and rasterize when prompted — a smart object cannot be painted on. Drop
the mask layer to roughly 50% opacity so the footage reads through, and paint on
it: pure black removes, pure white restores, hard brush. Most floor sits in a band
along the bottom, so a rectangular marquee across all six cells, minus the feet,
clears a technique in about three actions rather than six passes.

**Saving is where this goes wrong.** The file has to end up as the mask ALONE —
black and white, no footage. Set the mask layer back to 100% opacity, hide the
plate layer, then Flatten Image and discard hidden layers before saving over the
same `.mask.png`. Flatten with the plate still visible and the footage is baked
into the mask; because every pixel is then opaque, the sprite renders as a solid
rectangle with no silhouette at all.

`--masks` checks for both mistakes. A mask that is not the right size is refused
outright, since every edit would land in the wrong place. One carrying a wide
spread of mid-greys is flagged as a probable saved composite — a warning rather
than a refusal, because a soft-brushed edge is legitimate and only the author
knows which was meant.

```
node scripts/technique-sprites.mjs --masks retouch
```

Any slug with a mask in that folder is rendered from it; the rest are computed as
normal, so only the files actually edited need to be there. An untouched mask
round-trips to a pixel-identical sprite, which is the property that makes this
safe to re-run.

## One edge for every sheet

Twenty-six masks painted by hand over two days will not agree with each other,
and the sprites sit side by side in the app where any disagreement shows. So the
render conditions the mask before it becomes alpha: a small blur, then a gain
about mid-grey that puts the edge back.

The two numbers are tied to each other. A step blurred by sigma has a peak slope
of 255/(2.5*sigma) luma per pixel, so a gain of K leaves a ramp 2.5*sigma/K
pixels wide. Set `harden` to 2.5x `smooth` and the result is a one-pixel edge no
matter how soft or hard the input was — the same anti-aliasing the downscale
gives a computed mask, now guaranteed rather than inherited. The defaults are
1.2 and 3.

Both are worth respecting. At a gain of 8 the outline stair-steps, visibly, on
any diagonal — a shin, a forearm. Past about sigma 2 the blur starts rounding
real detail: a heel loses its corner, and the notch between a glove and the head
in the high guard closes up. The measured cost at the defaults is a shape change
of a quarter of a percent, which is nothing, and a core edge that tightens from
0.92 to 0.68 grey pixels per boundary pixel.

The pass runs on the far side of the downscale, unlike the morphology, because
it is measured in the pixels the sprite ships with and a retouched mask only
exists at that size. Both routes into a sheet — computed and painted — go
through it, which is what keeps an untouched mask round-tripping to a
byte-identical sprite.

Worth knowing what this pass is *not* for. Measured across all 26 masks, the
painted edges came out at 0.75 grey pixels per boundary pixel with a spread of
0.12, and the one mask that was never retouched sits at 0.71 — the brushwork did
not actually feather anything. What reads as softness in a finished sprite is the
glow, a 6-pixel blur of the same alpha. Tighten that and the whole silhouette
hardens; conditioning the mask only ever sharpens the last pixel.

## Processing

`scripts/technique-sprites.mjs` does the whole conversion. ffmpeg is its only dependency
— it keys the background, recolours the silhouette, adds the glow, tiles the frames and
encodes the sheet in one pass per technique.

```
node scripts/technique-sprites.mjs --init          # stub manifest, all 25 slugs
node scripts/technique-sprites.mjs                 # build everything with footage
node scripts/technique-sprites.mjs --only jab --frames
```

Fill in `file`, `start` and `duration` per shot in `raw/shots.json` as you cut takes.
Entries whose footage does not exist yet are skipped rather than failing the run, so the
manifest can be complete long before the shoot is.

The one setting that needs a human eye is `cutoff` — the luma above which a pixel counts
as wall. The default 0.72 suits a white-ish wall; a lit racquetball court measured out
nearer 0.50. Raise it if the fighter is being eaten, lower it if the wall is surviving.
`--frames` writes the six frames as PNGs
instead of a sheet, which is how you find the number for a given clip. Per-shot `crop`
(as `"w:h:x:y"`) tightens framing without a reshoot, and `flip: true` mirrors a take.

## Tier 1 — the 25 roadmap lessons

Shoot in this order; it follows the curriculum, so a partial shoot still ships whole
levels.

| # | Slug | Technique | Thai | Angle | Note |
|---|---|---|---|---|---|
| 1 | `jab` | Jab (1) | Mat Na | Lead-side 3/4 | Show the retraction, not just the extension |
| 2 | `cross` | Cross (2) | Mat Trong | Rear-side 3/4 | Rear heel pivot must be visible — it is the lesson's main point |
| 3 | `lead-hook` | Left Hook (3) | — | Front 3/4 | The arc reads best slightly off-front |
| 4 | `rear-hook` | Right Hook (4) | — | Front 3/4 | Same framing as lead hook so the pair matches |
| 5 | `teep` | Teep | Theep | Side | Covers *Left Teep* and *Right Teep* — one shot only |
| 6 | `low-kick` | Low Kick | Tae Kha | Side | Full body; the step-out is half the technique |
| 7 | `roundhouse-kick` | Roundhouse Kick | Tae Wiang | Side | Called as *Body Kick* in the app |
| 8 | `switch-kick` | Switch Kick | — | Side | Needs the switch itself, so start further back in the rep |
| 9 | `check` | Check | Bang | Side | Covers *Left Check* and *Right Check* |
| 10 | `high-guard` | High Guard Block | — | Front | Static hold — a still frame may serve better than a loop |
| 11 | `long-guard` | Long Guard | — | Front 3/4 | Static hold |
| 12 | `slip` | Slip | — | Front | Covers *Slip Left* and *Slip Right*; front view is the only one where head movement reads |
| 13 | `duck` | Duck | — | Front | Front view for the same reason |
| 14 | `lean-back` | Lean Back | — | Side | The one head movement that needs a side view |
| 15 | `roll` | Roll | — | Front | Covers *Roll Left* and *Roll Right* |
| 16 | `pivot` | Pivot | — | Front, slightly elevated | Covers *Pivot Left* and *Pivot Right*; elevate so foot placement reads |
| 17 | `straight-knee` | Straight Knee | Khao Trong | Side | Covers *Left Knee* and *Right Knee* |
| 18 | `body-punching` | Punching to the Body | — | 3/4 | **Covers four callouts** — see open decisions |
| 19 | `lead-uppercut` | Left Uppercut (5) | — | Side | Side view shows the rise; front view flattens it |
| 20 | `rear-uppercut` | Right Uppercut (6) | — | Side | Match the lead uppercut framing |
| 21 | `overhand` | Overhand | — | Front 3/4 | The looping path over the guard is the whole point |
| 22 | `inside-low-kick` | Inside Low Kick | — | Front 3/4 | Called as *Inside Leg Kick* |
| 23 | `head-kick` | Head Kick | Tae Kor | Side | Full body, plenty of headroom |
| 24 | `horizontal-elbow` | Horizontal Elbow | Sok Tud | Front 3/4 | Bonus level; covers *Left Elbow* and *Right Elbow* |
| 25 | `up-elbow` | Up Elbow | Sok Ngat | Side | Bonus level |

Seven of these cover mirrored callout pairs and one covers four punches, so 25 shots
answer all 35 roadmap callouts.

## Tier 2 — the remaining 37 Learn lessons

Not needed to ship the roadmap. Grouped by how easy they are to shoot rather than by
category, because that is what decides the running order of a second session.

**Easy, same setup, no partner (5)** — conditioning, and honestly the fastest wins in the
whole list:
`burpee`, `jumpsquats`, `jumping-jacks`, `high-knees`, `punch-burnouts`

**Straightforward solo strikes (11)** — same protocol as Tier 1:
`question-mark-kick`, `spinning-back-kick`, `spinning-heel-kick`,
`speed-kicks`, `step-in-knee`, `flying-knee`, `jump-switch-knee`, `axe-elbow`,
`spinning-elbow`, `step-in-elbow`, `step-off-elbow`

Note the spinning techniques need more floor space and a wider framing than the Tier 1
setup — shoot them as a group, after re-marking the tape.

**Needs a partner or a bag (8)** — a defensive technique with nothing coming at it is
just a pose:
`parry`, `catch`, `check-and-return`, `angle-off-hook`, `slip-and-counter`, `clinch`,
`sweep`, `hand-trap`

**Probably should not get a sprite at all (13)** — the feints:
`jab-feint`, `body-jab-feint`, `shoulder-feint`, `step-feint`, `switch-step-feint`,
`low-kick-feint`, `teep-feint`, `body-kick-feint`, `limp-feint`, `retreat-feint`,
`lazy-teep`, `guard-bait`, `pattern-break`

A feint is defined by the reaction it draws, not by the movement itself. Filmed solo,
`shoulder-feint` and `jab-feint` are indistinguishable from a twitch. These either need
two people in frame, or they are the category where a schematic diagram beats footage.
Worth deciding before booking a partner for the Tier 2 shoot.

## Derived sheets

`double-jab` is not filmed. It is the jab's own six cells re-cut into a new order —
guard, extension, a partial retract, extension again, retract, guard — because a double
jab is one jab and then another and the jab clip already contains every pose in it.

    node scripts/technique-sprites.mjs --derive

The bar for this is deliberately high, and it is not "the technique is similar". The
derived sheet must contain **no pose the source does not**, or it stops being a
rearrangement of real footage and becomes a fabrication of technique — which is the
thing *Why we film rather than generate* exists to prevent. A jab-cross is two different
punches. A jab to the body is a level change the jab clip never makes. Neither qualifies.

What might: a triple jab, and `speed-kicks` off the round kick, if the intent is the same
kick repeated. Both need a look at the source cells before committing.

## Open decisions

1. **`body-punching` covers four callouts** — *Jab / Cross / Left Hook / Right Hook to
   the Body*. One sprite has to represent all four. Options: shoot the lead hook to the
   body as the representative, shoot a four-punch body sequence as the loop, or split the
   lesson into separate entries in the library. Cheapest is the representative shot.
2. **Static holds** (`high-guard`, `long-guard`) have no motion to loop. A single frame
   in the same treatment is probably better than a 6-frame sprite of someone standing
   still.
3. **Mobile layout.** At phone width, a 150px visual beside the text leaves roughly a
   190px copy column, which reads badly. Below ~600px the visual should go full width
   above the bullets rather than floating beside them.
4. **Who throws.** The form in these is the app teaching form. Worth using a coach rather
   than shooting it solo.
