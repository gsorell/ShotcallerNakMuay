import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  captureAndDownloadElement,
  captureElementAsBlob,
  shareCharmImage,
} from "@/utils/imageUtils";
import type { CharmVisual } from "../constants/charms";

interface CharmCelebrationModalProps {
  charm: CharmVisual;
  /** Optional highlight line, e.g. "7-Day Streak 🔥" for streak charms. */
  subtitle?: string;
  /** Small uppercase eyebrow above the badge. */
  eyebrow?: string;
  onClose: () => void;
}

export default function CharmCelebrationModal({
  charm,
  subtitle,
  eyebrow = "New Charm Earned",
  onClose,
}: CharmCelebrationModalProps) {
  const [visible, setVisible] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filenameBase = `shotcaller-charm-${charm.name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toLowerCase()}`;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsCapturing(true);
    try {
      await captureAndDownloadElement(cardRef.current, filenameBase);
    } catch {
      alert("Failed to save charm image. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    setIsCapturing(true);
    try {
      const blob = await captureElementAsBlob(cardRef.current);
      await shareCharmImage(blob, charm);
    } catch {
      alert("Unable to share. Try the Download button instead.");
    } finally {
      setIsCapturing(false);
    }
  };

  // Portal to <body> so position:fixed resolves against the viewport. Rendered
  // in place, the modal lives inside the .app-scroll container, and iOS WebKit
  // positions fixed descendants of an overflow scroll container relative to
  // that container (below the header) instead of the viewport.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="charm-celebration-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
        background: "rgba(8, 10, 24, 0.78)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 320ms ease-out",
      }}
      onClick={onClose}
    >
      <SparkleField color={charm.glowColor} />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          maxWidth: 360,
          width: "100%",
          transform: visible
            ? "scale(1) translateY(0)"
            : "scale(0.85) translateY(20px)",
          transition: "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Capturable card — this is what gets shared/downloaded */}
        <div
          ref={cardRef}
          style={{
            background:
              "linear-gradient(160deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)",
            borderRadius: 24,
            padding: "2rem 1.5rem 1.75rem",
            color: "white",
            textAlign: "center",
            border: `1px solid ${charm.accentColor}40`,
            boxShadow: `0 18px 60px ${charm.glowColor}, 0 0 0 1px rgba(255,255,255,0.06) inset`,
          }}
        >
          <div
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: charm.accentColor,
              marginBottom: "0.5rem",
              fontWeight: 700,
            }}
          >
            {eyebrow}
          </div>

          <CharmBadge charm={charm} large />

          <h2
            id="charm-celebration-title"
            style={{
              margin: "1rem 0 0.25rem",
              fontSize: "1.75rem",
              fontWeight: 800,
              color: charm.accentColor,
              letterSpacing: "0.01em",
            }}
          >
            {charm.name}
          </h2>
          <div
            style={{
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.55)",
              marginBottom: subtitle ? "1rem" : "0.75rem",
              fontStyle: "italic",
            }}
          >
            {charm.thaiName}
          </div>

          {subtitle && (
            <div
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                marginBottom: "0.75rem",
                color: "white",
              }}
            >
              {subtitle}
            </div>
          )}

          <p
            style={{
              margin: "0 0 1.25rem",
              fontSize: "0.9rem",
              color: "rgba(255,255,255,0.78)",
              lineHeight: 1.5,
            }}
          >
            {charm.description}
          </p>

          {/* Branding footer — included in the shared image */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingTop: 14,
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <img
              src="/assets/logo_icon.png"
              alt=""
              style={{ width: 16, height: 16, opacity: 0.7 }}
            />
            <span
              style={{
                fontSize: "0.7rem",
                color: "#94a3b8",
                fontWeight: 600,
                letterSpacing: "0.08em",
              }}
            >
              NAK MUAY SHOT CALLER
            </span>
          </div>
        </div>

        {/* Action row — outside the capture area */}
        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            alignItems: "center",
            marginTop: "1.25rem",
          }}
        >
          <img
            src="/assets/icon_download_updated.png"
            alt="Save"
            title="Save"
            onClick={isCapturing ? undefined : handleDownload}
            style={iconBtnStyle(isCapturing)}
            onMouseEnter={(e) => {
              if (!isCapturing) {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.filter = "brightness(1.2)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isCapturing) {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.filter = "brightness(1)";
              }
            }}
          />

          <img
            src="/assets/icon_share.png"
            alt="Share"
            title="Share"
            onClick={isCapturing ? undefined : handleShare}
            style={iconBtnStyle(isCapturing)}
            onMouseEnter={(e) => {
              if (!isCapturing) {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.filter = "brightness(1.2)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isCapturing) {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.filter = "brightness(1)";
              }
            }}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "block",
            margin: "1rem auto 0",
            padding: "0.75rem 2rem",
            borderRadius: 12,
            background: `linear-gradient(135deg, ${charm.accentColor} 0%, ${charm.accentColor}cc 100%)`,
            color: "#1a1a2e",
            fontWeight: 700,
            fontSize: "0.95rem",
            letterSpacing: "0.05em",
            boxShadow: `0 6px 18px ${charm.glowColor}`,
            transition: "transform 0.15s ease",
            textAlign: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Continue
        </button>
      </div>
    </div>,
    document.body
  );
}

// Mirrors the icon-button styling used on the WorkoutCompleted share row.
function iconBtnStyle(isCapturing: boolean): React.CSSProperties {
  return {
    width: 48,
    height: 48,
    cursor: isCapturing ? "not-allowed" : "pointer",
    transition: "all 0.2s",
    borderRadius: 12,
    opacity: isCapturing ? 0.5 : 1,
    padding: 4,
    boxSizing: "border-box",
  };
}

interface CharmBadgeProps {
  charm: CharmVisual;
  large?: boolean;
  size?: number;
}

export function CharmBadge({ charm, large, size: sizeProp }: CharmBadgeProps) {
  const size = sizeProp ?? (large ? 120 : 56);
  const fontSize = large ? "3.5rem" : `${size * 0.5}px`;
  return (
    <div
      style={{
        width: size,
        height: size,
        margin: "0 auto",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        background: `radial-gradient(circle at 30% 30%, ${charm.accentColor}55, ${charm.accentColor}15 60%, transparent 75%)`,
        border: `2px solid ${charm.accentColor}80`,
        boxShadow: `0 0 ${size * 0.4}px ${charm.glowColor}, 0 0 0 4px rgba(255,255,255,0.04) inset`,
        animation: large ? "charmPulse 2.4s ease-in-out infinite" : "none",
      }}
    >
      <style>{`
        @keyframes charmPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes sparkleFloat {
          0% { transform: translateY(0) scale(0.9); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-80px) scale(1.2); opacity: 0; }
        }
      `}</style>
      <span aria-hidden>{charm.emoji}</span>
    </div>
  );
}

export function SparkleField({ color }: { color: string }) {
  const sparkles = Array.from({ length: 14 });
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {sparkles.map((_, i) => {
        const left = (i * 7.3) % 100;
        const delay = (i * 0.18) % 2.4;
        const size = 6 + ((i * 3) % 8);
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              bottom: `${(i * 11) % 40}%`,
              left: `${left}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 ${size * 2}px ${color}`,
              animation: `sparkleFloat 2.6s ${delay}s ease-out infinite`,
              opacity: 0,
            }}
          />
        );
      })}
    </div>
  );
}
