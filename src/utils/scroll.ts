// The app content scrolls inside the `.app-scroll` region (see AppLayout),
// not the document body, so `window.scrollTo` no longer reaches it. Use this
// to scroll the content region back to the top from anywhere.
export const scrollContentToTop = (
  behavior: ScrollBehavior = "smooth"
): void => {
  const el = document.querySelector<HTMLElement>(".app-scroll");
  (el ?? window).scrollTo({ top: 0, behavior });
};
