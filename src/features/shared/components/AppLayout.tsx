import type { Page } from "@/types";
import React from "react";

import { Footer } from "./Footer";
import Header from "./Header";
import { HeroBackground } from "./HeroBackground";

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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        body { background: linear-gradient(135deg, #831843 0%, #581c87 50%, #155e75 100%); background-attachment: fixed; }
        .main-timer {
          font-size: 8vw;
          font-weight: 900;
          color: white;
          letter-spacing: 0.05em;
          text-shadow: 0 4px 8px rgba(0,0,0,0.3);
          font-family: "system-ui, -apple-system, 'Segoe UI', sans-serif";
          text-align: center;
          width: 100%;
          margin: 0 auto;
          line-height: 1.1;
        }
        @media (max-width: 768px) {
          .main-timer { font-size: 12vw !important; }
        }
        @media (max-width: 480px) {
          .main-timer { font-size: 16vw !important; }
        }
        .hero-bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
        }
        .emphasis-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          max-width: 60rem;
          margin: 0 auto;
          width: 100%;
        }
        @media (max-width: 900px) {
          .emphasis-grid {
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 0.75rem;
          }
        }
        @media (max-width: 600px) {
          .emphasis-grid {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
        }
        .emphasis-grid > button,
        .manage-techniques-btn {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          max-width: 100%;
          word-break: break-word;
        }
        @media (max-width: 600px) {
          .emphasis-grid > button,
          .manage-techniques-btn {
            padding: 1.1rem !important;
            font-size: 1rem !important;
          }
        }
        html, body, #root {
          max-width: 100vw;
          overflow-x: hidden;
        }
        @media (max-width: 600px) {
          .settings-toggle-row {
            flex-direction: column !important;
            gap: 1.25rem !important;
            align-items: stretch !important;
          }
          .section-header-with-button {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            gap: 1rem !important;
          }
          .section-header-with-button h2 {
            text-align: center !important;
          }
          .section-header-with-button p {
            text-align: center !important;
          }
        }
      `}</style>

      <Header onHelp={onHelp} onLogoClick={onLogoClick} />

      <div style={{ position: "relative", zIndex: 0 }}>
        <HeroBackground />

        <main
          className="main-container"
          style={{
            minHeight: isActive ? "auto" : "100vh",
            color: "#fdf2f8",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
          }}
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
