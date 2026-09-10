# Release Notes — v1.18.1

**Date:** 2026-09-09
**versionCode:** 98
**Type:** Cosmetic. Header layout only, no behaviour change.

---

## Summary

The v1.18.0 lockup was too big for the space it sat in. On both platforms it
filled the header edge to edge with no margin on any side, which read as
cramped rather than confident. This release gives it a gutter.

---

## The cause

The old two-line logo got its breathing room by accident. It was 3.27:1, so
the `<img>`'s `max-height` capped it on any viewport wider than 392px and
`object-fit: contain` letterboxed the leftover width into margins nobody had
asked for. The rebrand lockup is **4.62:1** — the same cap does not bind on
any phone, so the image took the full width the 5% gutter allowed.

Vertically there was nothing at all. `.app-header` set `padding: 0 5%` and
then a separate `padding-top: env(safe-area-inset-top)` for the status bar,
which overrode the shorthand's top value. Zero top padding, zero bottom.

## The fix

| File | Change |
|---|---|
| `Header.css` | `padding: 0 5%` → `0.625rem 11%` |
| `Header.css` | `padding-top: calc(env(safe-area-inset-top) + 0.625rem)` — inset *plus* gutter, not instead of |
| `Header.css` | `.logo` gets `justify-content: center` |
| `Header.tsx` | img `maxHeight` 120px → 96px |

The gutter is explicit on all four sides now, so it does not depend on the
logo's aspect ratio and survives the next re-cut. The height cap stops the
logo ballooning on a tablet.

**Net on a 393pt phone:** logo 354pt wide with no margin → 306pt with 10pt
above and below. About 13% smaller. The black band grows 76pt → 86pt.
