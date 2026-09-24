# Social Voice — how Shot Caller talks in a feed

**Status:** Active. This is the source of truth for captions, replies, and any
copy that leaves the repo for a social platform.
**Date:** 2026-09-10
**Companion:** `scripts/social-cards.mjs` generates the imagery this copy sits on.
**Account:** [@nakmuayshotcaller](https://www.instagram.com/nakmuayshotcaller) — linked from `Footer.tsx`.

---

## 1. Problem

The app does not have a voice problem. It has a *transplant* problem.

There are already two voices in this project, and they are not the same voice.

**Voice A — the store listing and the specs.** Short, declarative, allergic to
hype, willing to say what the product refuses to do:

> Someone in your corner, calling the shots.
> No counting reps in your head. No stopping to read a screen. Just the bell,
> the callout, and the work. — `STORE_LISTING.md`

> The app cannot see the user and should not pretend. — `ROADMAP_START_HERE_SPEC.md`

> That index is the feature. The camera is the plumbing. — `VIDEO_CAPTURE_SPEC.md`

**Voice B — the blog, bylined "Shotcaller Sam."** Warmer, rounder, and much
closer to every other fitness blog on the internet:

> One of the beautiful things about Muay Thai is that no two fighters look
> exactly the same. — `muay-thai-styles-explained.html`

Voice B is not bad writing. It is *unowned* writing — it would sit unchanged
under any brand. Voice A could only have come from the person who built this
app in a damp garage because every existing app called "One, Two, Three, Four,
Right Kick" and thought that was Muay Thai.

**Voice A is the voice. Social posts in Voice B are the failure mode.**

The blog stays as it is — it is written for search, and that is a different
job. This document governs the feed.

---

## 2. The voice in one line

> **A training partner who knows more than you and is not impressed by you.**

Not a coach barking. Not a brand cheering. Someone standing at the other end of
the bag who says the true thing in as few words as it takes, and then lets you
get back to work.

---

## 3. The rules

| # | Rule | Why |
|---|------|-----|
| 1 | **Lead with the correction, not the setup.** | "Your jab comes home slower than it goes out" beats "Today let's talk about the jab." A feed gives you one line before the fold. |
| 2 | **One idea per post.** | A carousel of six tips teaches nothing. One fixable thing gets tried tonight. |
| 3 | **Say the cost, not the benefit.** | "Drop the hand on the way back and the cross comes down the middle." A threat is more memorable than a promise, and it is how the sport actually teaches. |
| 4 | **Lead and rear, never left and right.** | The library is written this way on purpose — a southpaw reads the same sentence and it stays true. See the `displayName` note in `techniqueSprites.ts`. The *name* may carry a direction; the *instruction* may not. |
| 5 | **No exclamation marks. None.** | The voice is certain. Certainty does not shout. |
| 6 | **No emoji in the body.** | At most one at the very end, and usually not. The tags already carry the 🥊. |
| 7 | **Never call it a workout. It is training, or a round, or work.** | "Workout" is the fitness-app register. This is a combat sport. |
| 8 | **Name the app once, at the end, or not at all.** | A post that teaches is an ad. A post that advertises is scrolled. |
| 9 | **Admit what the app does not do.** | It cannot see you. It does not score you. Saying so out loud is the single most credible thing this account can do, and no competitor will copy it. |
| 10 | **Thai names get used, never explained twice.** | *Mat Na*, *Sok*, *Khao*. Respect for the sport is shown by usage, not by a glossary. |

---

## 4. Five posts that are right

Each pairs with a card from `scripts/social-cards.mjs`. The card carries the
technique; the caption carries the voice.

**① Technique card — Jab**
> The jab is not a knockout punch. It is a measuring tape.
>
> Fire it from where the hand already sits. No drawing it back first — that
> wind-up is the tell that gets you countered.
>
> It is judged on the way home, not the way out.
>
> *Mat Na*

**② Mistake card — Jab**
> Three ways people ruin a good jab:
>
> Dropping the hand coming back. Reaching with the shoulder until the weight is
> on the front foot. Throwing it lazily as a rhythm-filler until it stops
> threatening anything.
>
> The third one is the worst, because it feels like work.

**③ Honesty post — no card needed**
> Shot Caller will never tell you your technique was good.
>
> It cannot see you. Any app that claims otherwise from a phone propped against
> a water bottle is guessing, and a confident guess about your form is worse
> than no feedback at all.
>
> What it does know is exactly what it asked for, and exactly when.

**④ Style card — Muay Khao**
> Muay Khao does not out-strike you. It arrives.
>
> Pressure, clinch, knees. The whole style is a bet that you would rather be
> anywhere else, and it is usually right.
>
> One of eighteen callout vocabularies in the app.

**⑤ Build-in-public post**
> Shipped this week: the screen stays awake through a round natively now,
> instead of asking the browser nicely and losing the argument on iOS.
>
> Nobody will notice it. That is the point — the bell should be the only thing
> that interrupts you.

---

## 5. Three posts that are wrong

**✗ Generic fitness voice**
> 🔥 Ready to CRUSH your Muay Thai workout today?! 💪 Shot Caller has 18 amazing
> styles to keep your training fresh and fun! Download now! 🥊🔥

Wrong on rules 5, 6, 7, and 8 at once. Says nothing true about Muay Thai. Could
be any app.

**✗ Voice B — unowned blog prose**
> One of the beautiful things about Muay Thai is that every fighter develops
> their own unique style over time. In this post we'll explore the major styles
> and how you can train them.

Nothing false here, and nothing anyone will remember. "In this post we'll
explore" is not a sentence a training partner says.

**✗ Feature list as a post**
> Shot Caller features: ✅ 18 styles ✅ 63 technique lessons ✅ 11 guided levels
> ✅ Custom combos ✅ Workout logs ✅ Offline support

A changelog is not content. If a feature matters, teach the thing it makes
possible and let the feature be the reason the post exists.

---

## 6. Mechanics

- **Hashtags:** `#NakMuay #MuayThai #ShotcallerNakMuay` are the constants — the
  third is the one the app's own share cards already stamp onto user posts
  (`imageUtils.ts`), so it is where user-generated proof accumulates. **Never
  change it.** Add at most three situational tags (`#Sok`, `#Clinch`,
  `#Southpaw`, `#HeavyBag`).
- **The name is Shot Caller,** two words, in all copy. The one-word
  `shotcaller` survives only in the handle, the hashtag, and the domain. Do not
  "fix" those to match.
- **Never automate replies, comments, or DMs.** Generated captions are drafts to
  edit; a generated *reply* is how a small account loses the only advantage it
  has over a funded competitor.
- **Scheduling** goes through Meta Business Suite — free, native to Instagram,
  and this project already owns the Meta dataset. Do not buy a scheduler.

---

## 7. What never gets posted

- Anything claiming the app assesses, scores, or corrects form. It does not, by
  design, and saying so would make rule 9 a lie.
- Injury, weight-cut, or nutrition advice. Out of scope and out of competence.
- AI-generated technique imagery. The silhouettes come from real footage of a
  real person — see `TECHNIQUE_SHOT_LIST.md`. That provenance is the reason they
  are trustworthy, and it is not worth trading for volume.
- Anyone else's fight footage, gym footage, or photographs. No licence, and the
  Muay Thai community notices.
