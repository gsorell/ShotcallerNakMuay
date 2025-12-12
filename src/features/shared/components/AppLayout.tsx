import type { Page } from "@/types";
import React from "react";

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
}) => {
  return (
    <>

      <Header onHelp={onHelp} onLogoClick={onLogoClick} />

      <div className="app-layout-wrapper">
        <HeroBackground />

        <main
          className="app-layout-main"
          style={{ minHeight: isActive ? "auto" : "100vh" }}
        >
          {children}
        </main>

        <Footer
          isActive={isActive}
          hasSelectedEmphasis={hasSelectedEmphasis}
          linkButtonStyle={linkButtonStyle}
          setPage={setPage}
          setShowOnboardingMsg={setShowOnboardingMsg}
        />
      </div>
    </>
  );
};
