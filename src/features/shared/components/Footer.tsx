import "./Footer.css";

export type FooterProps = {
  isActive: boolean;
  hasSelectedEmphasis: boolean;
  linkButtonStyle: any;
  setPage: any;
  setShowOnboardingMsg: any;
};

export const Footer = ({
  isActive,
  hasSelectedEmphasis,
  linkButtonStyle,
  setPage,
  setShowOnboardingMsg,
}: FooterProps) => (
  <footer
    className="app-footer"
    style={{ 
      paddingBottom: !isActive && hasSelectedEmphasis ? "200px" : "2rem",
      marginBottom: hasSelectedEmphasis ? "32px" : "0"
    }}
  >
    <div className="app-footer-content">
      <img
        src="/assets/logo_icon.png"
        alt="Logo"
        className="app-footer-logo"
        onClick={() => {
          setPage("timer");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setPage("timer");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
        role="button"
        aria-label="Go to home"
      />
      <span>Train smart, fight smarter</span>
      <button
        onClick={() => setPage("logs")}
        className="app-footer-link"
      >
        Workout Logs
      </button>
      <button
        onClick={() => setShowOnboardingMsg(true)}
        className="app-footer-link"
      >
        Help
      </button>
      <a
        href="https://www.instagram.com/nakmuayshotcaller?igsh=dTh6cXE4YnZmNDc4"
        target="_blank"
        rel="noopener noreferrer"
        className="app-footer-social"
        aria-label="Instagram"
      >
        <img
          src="/assets/icon.instagram.png"
          alt="Instagram"
        />
      </a>
    </div>
  </footer>
);
