import React from "react";

interface PWAStatusProps {
  isInstalled: boolean;
  className?: string;
}

const PWAStatus: React.FC<PWAStatusProps> = ({
  isInstalled,
  className = "",
}) => {
  if (!isInstalled) return null;

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.25rem 0.5rem",
        borderRadius: "6px",
        background: "rgba(34, 197, 94, 0.1)",
        border: "1px solid rgba(34, 197, 94, 0.2)",
        color: "#22c55e",
        fontSize: "0.75rem",
        fontWeight: 500,
      }}
      title="App is installed and running as PWA"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
      <span>App Installed</span>
    </div>
  );
};

export default PWAStatus;
