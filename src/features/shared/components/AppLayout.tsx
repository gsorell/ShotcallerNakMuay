import type { Page } from "@/types";
import React, { useEffect } from "react";
import { scrollContentToTop } from "@/utils/scroll";

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
  setShowOnboardingMsg: (show: boolean) => void;
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
  setShowOnboardingMsg,
  bottomBar,
}) => {
  // The content region scrolls (not the document), so reset it to the top on
  // navigation — keeps the "go home" behaviour the body scroll used to give.
  useEffect(() => {
    scrollContentToTop("auto");
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
          setShowOnboardingMsg={setShowOnboardingMsg}
        />
      </div>

      {bottomBar}
    </div>
  );
};
