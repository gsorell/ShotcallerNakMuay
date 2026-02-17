import React, { useEffect, useState } from "react";

interface ClackDebugOverlayProps {
  lastClackTime: number;
  clackCount: number;
  isFreestyle: boolean;
  running: boolean;
  paused: boolean;
  isResting: boolean;
}

export function ClackDebugOverlay({
  lastClackTime,
  clackCount,
  isFreestyle,
  running,
  paused,
  isResting,
}: ClackDebugOverlayProps) {
  const [flash, setFlash] = useState(false);

  // Flash effect when clack fires
  useEffect(() => {
    if (lastClackTime > 0) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastClackTime]);

  if (!isFreestyle) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        backgroundColor: flash ? "#00ff00" : "rgba(0, 0, 0, 0.8)",
        color: flash ? "#000" : "#fff",
        padding: "10px",
        borderRadius: "8px",
        fontSize: "12px",
        fontFamily: "monospace",
        zIndex: 9999,
        border: flash ? "3px solid #00ff00" : "2px solid #666",
        transition: "all 0.1s ease",
        minWidth: "150px",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
        🎬 CLACK DEBUG
      </div>
      <div>Count: {clackCount}</div>
      <div>
        Status:{" "}
        {!running
          ? "❌ Not Running"
          : paused
          ? "⏸️ Paused"
          : isResting
          ? "💤 Resting"
          : "✅ Active"}
      </div>
      {lastClackTime > 0 && (
        <div style={{ marginTop: "5px", color: flash ? "#000" : "#0f0" }}>
          ⚡ CLACK!
        </div>
      )}
    </div>
  );
}
