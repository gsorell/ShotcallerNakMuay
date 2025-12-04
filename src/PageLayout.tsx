import React from "react";

const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#bfdbfe",
  textDecoration: "underline",
  cursor: "pointer",
  fontSize: "0.875rem",
};

export default function PageLayout({
  title,
  children,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        body { background: linear-gradient(135deg, #831843 0%, #581c87 50%, #155e75 100%); background-attachment: fixed; }
      `}</style>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#1e0b30",
          backdropFilter: "blur(10px)",
          padding: "1rem 2rem",
          borderBottom: "1px solid rgba(236,72,153,0.3)",
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* moved back button out of the header so it no longer overlaps on mobile */}
        <h1
          className="header-title"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "2.5rem",
            fontWeight: "normal",
            color: "white",
            letterSpacing: "0.1em",
            margin: 0,
            textShadow: "0 2px 8px rgba(236,72,153,0.6)",
          }}
        >
          {title}
        </h1>
      </header>

      {/* New row for the back link placed below the header so it doesn't overlap on small screens */}
      {onBack && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "0.75rem 1rem",
            borderBottom: "1px solid rgba(255,255,255,0.03)",
          }}
        >
          <button onClick={onBack} style={linkButtonStyle}>
            &larr; Back to Timer
          </button>
        </div>
      )}

      <div
        className="main-container"
        style={{
          minHeight: "100vh",
          color: "#fdf2f8",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div
          className="content-panel"
          style={{ maxWidth: "64rem", margin: "0 auto", padding: "2rem 0" }}
        >
          {children}
        </div>
      </div>

      <footer
        style={{
          textAlign: "center",
          padding: "2rem",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          color: "#fdf2f8",
        }}
      >
        <div
          style={{
            color: "#f9a8d4",
            fontSize: "0.875rem",
            margin: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          {/* The back button has been moved to its own row below the header */}
        </div>
      </footer>
    </>
  );
}
