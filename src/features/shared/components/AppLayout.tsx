import type { Page } from "@/types";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import {
  consumePageRestore,
  pageScrollKey,
  rememberScroll,
  restoreScroll,
  scrollContentToTop,
} from "@/utils/scroll";

import { Footer } from "./Footer";
import Header from "./Header";
import { HeroBackground } from "./HeroBackground";
import "./AppLayout.css";

interface AppLayoutProps {
  children: React.ReactNode;
  isActive: boolean; // running or pre-round
  page: Page;
  onHelp: () => void;
  onLogoClick: () => void;
  // Footer props
  hasSelectedEmphasis: boolean;
  linkButtonStyle: React.CSSProperties;
  setPage: (p: Page) => void;
  // In-flow bottom bar (e.g. the Start controls). Kept out of the scroll
  // region so the scrollbar stays within the main content only.
  bottomBar?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  isActive,
  page,
  onHelp,
  onLogoClick,
  hasSelectedEmphasis,
  linkButtonStyle,
  setPage,
  bottomBar,
}) => {
  // Which page the live scroll position belongs to. A ref because the listener
  // below is installed once and must always write against the CURRENT page.
  const scrolledPage = useRef(page);

  // Record where each page is left, continuously. Reading it on the way out
  // instead would be too late: by the time a page-change effect runs, the new
  // page is already rendered and the container's scrollTop has moved with it.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".app-scroll");
    if (!el) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        rememberScroll(pageScrollKey(scrolledPage.current), el.scrollTop);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // The content region scrolls (not the document), so navigation has to move it
  // by hand. Arriving means arriving at the top — except when a back button has
  // asked for the position it left, which is the one case where the previous
  // offset is what the user is looking for.
  //
  // A layout effect so the restore happens before paint; as a passive effect
  // the top of the page shows for a frame first and the screen visibly jumps.
  useLayoutEffect(() => {
    scrolledPage.current = page;
    const restoreKey = consumePageRestore();
    if (restoreKey) restoreScroll(restoreKey);
    else scrollContentToTop("auto");
  }, [page]);

  return (
    <div className="app-shell">
      <HeroBackground />

      <Header onHelp={onHelp} onLogoClick={onLogoClick} />

      <div className="app-layout-wrapper app-scroll">
        <main className="app-layout-main">{children}</main>

        <Footer
          isActive={isActive}
          hasSelectedEmphasis={hasSelectedEmphasis}
          linkButtonStyle={linkButtonStyle}
          setPage={setPage}
          onHelp={onHelp}
        />
      </div>

      {bottomBar}
    </div>
  );
};
