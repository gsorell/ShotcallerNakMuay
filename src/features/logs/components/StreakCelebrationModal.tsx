import { useEffect, useState } from "react";
import type { StreakMilestone } from "../constants/milestones";

interface StreakCelebrationModalProps {
  milestone: StreakMilestone;
  streak: number;
  onClose: () => void;
}

export default function StreakCelebrationModal({
  milestone,
  streak,
  onClose,
}: StreakCelebrationModalProps) {
  const [visible, setVisible] = useState(false);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-celebration-title"
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
      <SparkleField color={milestone.glowColor} />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          maxWidth: 360,
          width: "100%",
          background:
            "linear-gradient(160deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)",
          borderRadius: 24,
          padding: "2rem 1.5rem 1.5rem",
          color: "white",
          textAlign: "center",
          border: `1px solid ${milestone.accentColor}40`,
          boxShadow: `0 18px 60px ${milestone.glowColor}, 0 0 0 1px rgba(255,255,255,0.06) inset`,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.85) translateY(20px)",
          transition: "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: milestone.accentColor,
            marginBottom: "0.5rem",
            fontWeight: 700,
          }}
        >
          New Charm Earned
        </div>

        <CharmBadge milestone={milestone} large />

        <h2
          id="streak-celebration-title"
          style={{
            margin: "1rem 0 0.25rem",
            fontSize: "1.75rem",
            fontWeight: 800,
            color: milestone.accentColor,
            letterSpacing: "0.01em",
          }}
        >
          {milestone.name}
        </h2>
        <div
          style={{
            fontSize: "0.85rem",
            color: "rgba(255,255,255,0.55)",
            marginBottom: "1rem",
            fontStyle: "italic",
          }}
        >
          {milestone.thaiName}
        </div>

        <div
          style={{
            fontSize: "1.05rem",
            fontWeight: 700,
            marginBottom: "0.75rem",
            color: "white",
          }}
        >
          {streak}-Day Streak 🔥
        </div>

        <p
          style={{
            margin: 0,
            fontSize: "0.9rem",
            color: "rgba(255,255,255,0.78)",
            lineHeight: 1.5,
            marginBottom: "1.5rem",
          }}
        >
          {milestone.description}
        </p>

        <button
          type="button"
          onClick={onClose}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "inline-block",
            padding: "0.75rem 2rem",
            borderRadius: 12,
            background: `linear-gradient(135deg, ${milestone.accentColor} 0%, ${milestone.accentColor}cc 100%)`,
            color: "#1a1a2e",
            fontWeight: 700,
            fontSize: "0.95rem",
            letterSpacing: "0.05em",
            boxShadow: `0 6px 18px ${milestone.glowColor}`,
            transition: "transform 0.15s ease",
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
    </div>
  );
}

interface CharmBadgeProps {
  milestone: StreakMilestone;
  large?: boolean;
  size?: number;
}

export function CharmBadge({ milestone, large, size: sizeProp }: CharmBadgeProps) {
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
        background: `radial-gradient(circle at 30% 30%, ${milestone.accentColor}55, ${milestone.accentColor}15 60%, transparent 75%)`,
        border: `2px solid ${milestone.accentColor}80`,
        boxShadow: `0 0 ${size * 0.4}px ${milestone.glowColor}, 0 0 0 4px rgba(255,255,255,0.04) inset`,
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
      <span aria-hidden>{milestone.emoji}</span>
    </div>
  );
}

function SparkleField({ color }: { color: string }) {
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
