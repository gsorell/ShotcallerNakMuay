# Previewing onboarding's native last step in a browser

The last onboarding step has two branches. A browser only ever renders the web
one, so the native screen — what somebody who just installed from a store sees —
could not be looked at on a Windows machine without a device build. This is how
the nav-bar clipping bug survived in it.

Two things are needed to see that screen, and its bug, in Chrome.

## 1. Render the native branch

```
localStorage.setItem("nmsc-dev-respect-locks", "1")   // otherwise dev unlocks
```

then open:

```
http://localhost:5173/?native=1
```

`?native=1` persists (`?native=0` clears it) and is dead code in a production
build — see `src/features/onboarding/devPreview.ts`. Onboarding re-shows on
every dev reload, so just refresh and click **Next** four times.

The respect-locks flag is required because `devUnlockAll()` makes every dev
browser Pro, and `OnboardingProvider` deliberately never shows a paywall-forward
onboarding to somebody who already owns Pro — so without it onboarding simply
does not appear.

Set DevTools' device toolbar to **360 × 800**. That is the most common Android
CSS viewport (1080×2400 at DPR 3) and the one the bug appears on. At 384 wide and
above it does not reproduce, which is why a Pixel never showed it.

## 2. Simulate the system bars

A desktop browser has no system bars, so `env(safe-area-inset-*)` is `0` and the
screen looks fine no matter what. Paste this into the console once:

```js
(() => {
  const bd = [...document.querySelectorAll("div")]
    .find((d) => getComputedStyle(d).zIndex === "9990");
  if (!bd) return console.warn("Onboarding is not open — click Next to the last step first.");
  let card = bd.querySelector("div");
  while (card && getComputedStyle(card).overflowY !== "auto") card = card.querySelector("div");
  const NAV = 48, STATUS = 24;

  const bar = (side, px, label, color) => {
    const e = document.createElement("div");
    e.dataset.simBar = "1";
    e.style.cssText = `position:fixed;left:0;right:0;${side}:0;height:${px}px;z-index:99999;
      background:${color};color:#fff;font:700 10px system-ui;display:flex;
      align-items:center;justify-content:center;pointer-events:none;`;
    e.textContent = label;
    document.body.appendChild(e);
  };
  document.querySelectorAll("[data-sim-bar]").forEach((e) => e.remove());
  bar("top", STATUS, "24dp status bar", "rgba(0,120,255,.45)");
  bar("bottom", NAV, "48dp nav buttons", "repeating-linear-gradient(45deg,rgba(255,0,0,.55) 0 8px,rgba(0,0,0,.55) 8px 16px)");

  const report = (what) => {
    const sec = [...document.querySelectorAll("button")]
      .find((b) => /Maybe later|Keep going in the browser/.test(b.textContent));
    const gain = card.scrollHeight - card.clientHeight;
    // Scroll to the end the way a user would BEFORE measuring. Measuring
    // unscrolled just says "it is below the fold", which is not the question —
    // the question is whether it can be reached at all.
    const was = card.scrollTop;
    card.scrollTop = card.scrollHeight;
    const under = Math.max(
      0,
      sec.getBoundingClientRect().bottom - (window.innerHeight - NAV)
    );
    card.scrollTop = was;
    console.log(
      `%c${what}`, "font-weight:700",
      `\n  scroll available in the card : ${gain}px`,
      `\n  behind the nav bar, scrolled  : ${under.toFixed(1)}px`,
      `\n  => ${under > 0 ? "UNREACHABLE — no scroll can bring it out" : "reachable"}`
    );
  };

  // The shipped fix.
  window.__fixed = () => {
    bd.style.paddingTop = `calc(1rem + ${STATUS}px)`;
    bd.style.paddingBottom = `calc(1rem + ${NAV}px)`;
    card.style.boxSizing = "border-box";
    card.style.maxHeight = "100%";
    const sec = [...document.querySelectorAll("button")]
      .find((b) => /Maybe later|Keep going in the browser/.test(b.textContent));
    Object.assign(sec.style, {
      padding: "0.7rem 1rem", border: "1px solid rgba(255,255,255,0.22)",
      background: "rgba(255,255,255,0.08)", color: "#e5e7eb",
      fontWeight: "700", fontSize: "0.95rem",
    });
    card.scrollTop = 0;
    report("FIXED");
  };
  // Everything as it shipped: flat padding, content-box, 90vh, and the grey
  // transparent link — the styling matters, it is half of why the screen looked
  // like it offered one action.
  window.__bug = () => {
    bd.style.paddingTop = "1rem";
    bd.style.paddingBottom = "1rem";
    card.style.boxSizing = "content-box";
    card.style.maxHeight = "90vh";
    const sec = [...document.querySelectorAll("button")]
      .find((b) => /Maybe later|Keep going in the browser/.test(b.textContent));
    Object.assign(sec.style, {
      padding: "0.55rem", border: "none", background: "transparent",
      color: "#9ca3af", fontWeight: "600", fontSize: "0.9rem",
    });
    report("BUG");
  };

  console.log("Bars drawn. Call __bug() and __fixed() to flip between them.");
  window.__fixed();
})();
```

Then flip between the two:

```js
__bug()      // try to tap or scroll to "Maybe later — start free"
__fixed()
```

`__bug()` restores the flat `1rem` padding, `content-box` and `max-height: 90vh`
that shipped. At 360×800 it reports the link **21.1px behind the nav bar with
0px of scroll available** — nothing to scroll, nothing to tap. `__fixed()` puts
it back inside the safe area with real scroll.

Note that the simulated bars are `pointer-events:none` overlays: they show you
where the system bars *are*, but the mouse can still click through them. On a
real phone those 48dp belong to the navigation buttons and the tap never reaches
the page. That is the part a browser cannot imitate.

## Seeing it on the actual phone

The Pixel carries debug-signed builds, so a debug build installs straight over
the existing app without an uninstall (and without wiping workout logs or
roadmap progress — a *release* APK would require that uninstall):

```
npm run build
npm run cap:sync:android
cd android && ./gradlew installDebug
```

Switch the phone to three-button navigation (Settings → System → Gestures →
System navigation) if it is on gesture nav — the gesture pill is 24dp and the
button bar is 48dp, and the bug needs the taller one.
