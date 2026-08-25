// The app content scrolls inside the `.app-scroll` region (see AppLayout),
// not the document body, so `window.scrollTo` no longer reaches it. Use this
// to scroll the content region back to the top from anywhere.
export const scrollContentToTop = (
  behavior: ScrollBehavior = "smooth"
): void => {
  const el = document.querySelector<HTMLElement>(".app-scroll");
  (el ?? window).scrollTo({ top: 0, behavior });
};

// ===========================================================================
// Remembering where you were.
// ---------------------------------------------------------------------------
// Going back should put you where you left off, not at the top of a list you
// then have to scroll through again to find your place. That matters most on
// the long screens — the style grid, the technique shelf — where landing at the
// top after reading one lesson means losing your position entirely.
//
// Deliberately opt-in. Arriving somewhere still means arriving at the top,
// because that is right for every forward move: tapping the logo goes home to
// the top of home, and starting a session should show the timer rather than
// wherever the style grid happened to be left. Only a BACK button asks for a
// restore, which is the only case where the previous position is the thing the
// user is looking for.
//
// Positions live in memory rather than sessionStorage: a reload is a fresh
// start, and restoring a scroll offset into content that may have changed
// underneath is worse than starting at the top.
// ===========================================================================

const remembered = new Map<string, number>();

/**
 * Record where a keyed view is scrolled to. Pass `top` when the caller already
 * has it — AppLayout does, from its scroll listener.
 */
export const rememberScroll = (key: string, top?: number): void => {
  if (top !== undefined) {
    remembered.set(key, top);
    return;
  }
  const el = document.querySelector<HTMLElement>(".app-scroll");
  remembered.set(key, el?.scrollTop ?? 0);
};

/**
 * Put a keyed view back where it was, or at the top if it was never recorded.
 *
 * Set twice: once now, and again on the next frame. The first lands correctly
 * whenever the incoming content is already as tall as it was; the second
 * catches the case where it is not yet — the browser clamps a scroll past the
 * bottom, so an offset set against a half-built page silently becomes a
 * smaller one.
 */
export const restoreScroll = (key: string): void => {
  const top = remembered.get(key) ?? 0;
  const el = document.querySelector<HTMLElement>(".app-scroll");
  const target = el ?? window;
  target.scrollTo({ top, behavior: "auto" });
  requestAnimationFrame(() => target.scrollTo({ top, behavior: "auto" }));
};

/** Forget a position, for a view whose content is about to change wholesale. */
export const forgetScroll = (key: string): void => {
  remembered.delete(key);
};

// --- page-level handoff ----------------------------------------------------

let pendingPageKey: string | null = null;

/**
 * Ask the NEXT page change to restore instead of jumping to the top.
 *
 * Set by a back button immediately before it changes page, and read once by
 * AppLayout when the page actually changes. A one-shot rather than a flag on
 * the page itself, so an unconsumed request cannot leak into a later,
 * unrelated navigation.
 */
export const restoreOnNextPage = (key: string): void => {
  pendingPageKey = key;
};

/** Take the pending request, if there is one. */
export const consumePageRestore = (): string | null => {
  const key = pendingPageKey;
  pendingPageKey = null;
  return key;
};

/** The memory key for a page's own scroll position. */
export const pageScrollKey = (page: string): string => `page:${page}`;
