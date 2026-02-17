import React, { useEffect, useState } from "react";

interface ClackDebugOverlayProps {
  lastClackTime: number;
  clackCount: number;
  isFreestyle: boolean;
  running: boolean;
  paused: boolean;
  isResting: boolean;
}

interface LogEntry {
  message: string;
  timestamp: number;
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Flash effect when clack fires
  useEffect(() => {
    if (lastClackTime > 0) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastClackTime]);

  // Intercept console.log for [SFX] and [ClackEngine] messages
  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (prefix: string, args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      // Only capture relevant debug messages
      if (message.includes('[SFX]') || message.includes('[ClackEngine]') || message.includes('[iOS]')) {
        setLogs(prev => [...prev.slice(-9), { message: `${prefix}${message}`, timestamp: Date.now() }]);
      }
    };

    console.log = (...args: any[]) => {
      originalLog.apply(console, args);
      addLog('', args);
    };

    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      addLog('⚠️ ', args);
    };

    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      addLog('❌ ', args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  if (!isFreestyle) return null;

  return (
    <>
      {/* Main debug panel */}
      <div
        onClick={() => setShowLogs(!showLogs)}
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
          cursor: "pointer",
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
        <div style={{ marginTop: "5px", fontSize: "10px", opacity: 0.7 }}>
          Tap to {showLogs ? "hide" : "show"} logs
        </div>
      </div>

      {/* Log panel */}
      {showLogs && (
        <div
          style={{
            position: "fixed",
            top: "200px",
            left: "10px",
            right: "10px",
            maxHeight: "300px",
            backgroundColor: "rgba(0, 0, 0, 0.95)",
            color: "#0f0",
            padding: "10px",
            borderRadius: "8px",
            fontSize: "10px",
            fontFamily: "monospace",
            zIndex: 9998,
            border: "2px solid #666",
            overflowY: "auto",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "10px", color: "#fff" }}>
            📋 CONSOLE LOGS
          </div>
          {logs.length === 0 ? (
            <div style={{ opacity: 0.5 }}>No logs yet...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{ marginBottom: "5px", wordBreak: "break-word" }}>
                {log.message}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
