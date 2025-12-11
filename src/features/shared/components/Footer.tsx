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
    style={{
      textAlign: "center",
      marginTop: "4rem",
      padding: "2rem",
      paddingBottom: !isActive && hasSelectedEmphasis ? "200px" : "2rem",
      borderTop: "1px solid rgba(255,255,255,0.1)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        flexWrap: "wrap",
        color: "#f9a8d4",
      }}
    >
      <img
        src="/assets/logo_icon.png"
        alt="Logo"
        style={{
          height: "32px",
          marginRight: "0.5rem",
          verticalAlign: "middle",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.04)",
          cursor: "pointer",
        }}
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
        style={{ ...linkButtonStyle, padding: "0.25rem 0.5rem" }}
      >
        Workout Logs
      </button>
      <button
        onClick={() => setShowOnboardingMsg(true)}
        style={{ ...linkButtonStyle, padding: "0.25rem 0.5rem" }}
      >
        Help
      </button>
      <a
        href="https://www.instagram.com/nakmuayshotcaller?igsh=dTh6cXE4YnZmNDc4"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          opacity: 1,
          transition: "opacity 0.2s",
          height: "32px",
          marginLeft: "0.5rem",
        }}
        aria-label="Instagram"
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <img
          src="/assets/icon.instagram.png"
          alt="Instagram"
          style={{
            height: "24px",
            width: "24px",
            objectFit: "contain",
            borderRadius: "6px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
        />
      </a>
    </div>
  </footer>
);
