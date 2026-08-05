import React, { useState } from "react";

interface OnboardingFlowProps {
  /** Dismiss to the free app without opening the paywall ("Maybe later"). */
  onSkip: () => void;
  /** Dismiss and open the paywall (the paywall-forward primary action). */
  onUnlock: () => void;
}

interface Card {
  emoji: string;
  title: string;
  body: React.ReactNode;
}

const CARDS: Card[] = [
  {
    emoji: "🥊",
    title: "Your coach, in your ear",
    body: (
      <>
        Nak Muay Shot Caller turns shadowboxing and bagwork into guided sessions
        with <strong>spoken technique callouts</strong> and timed rounds — so you
        can keep your hands up and train without looking at the screen.
        <br />
        <br />
        <span style={{ opacity: 0.8 }}>
          It assumes you already know the form for each strike; it won't teach or
          correct technique. New to it? Learn the basics from a qualified coach
          first.
        </span>
      </>
    ),
  },
  {
    emoji: "🆓",
    title: "Start free, right now",
    body: (
      <>
        Jump in with <strong>Nak Muay Newb</strong> to learn the basic strikes,
        <strong> Freestyle</strong> to call your own shots, or a plain{" "}
        <strong>round Timer</strong>. No account, no cost.
      </>
    ),
  },
  {
    emoji: "🔓",
    title: "Go Pro when you're ready",
    body: (
      <>
        Unlock <strong>every fighting style</strong>, the{" "}
        <strong>technique editor</strong> to build your own combos, advanced
        training options, and the full <strong>charm progression</strong> that
        tracks your streaks and milestones.
      </>
    ),
  },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onSkip,
  onUnlock,
}) => {
  const [step, setStep] = useState(0);
  const isLast = step === CARDS.length - 1;
  const card = CARDS[step];
  if (!card) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome" style={styles.overlay}>
      <div style={styles.sheet}>
        <button type="button" onClick={onSkip} style={styles.skip}>
          Skip
        </button>

        <div style={styles.emoji}>{card.emoji}</div>
        <h2 style={styles.title}>{card.title}</h2>
        <p style={styles.body}>{card.body}</p>

        <div style={styles.dots}>
          {CARDS.map((_, i) => (
            <span
              key={i}
              style={{
                ...styles.dot,
                background:
                  i === step ? "#f9a8d4" : "rgba(255,255,255,0.25)",
                width: i === step ? 22 : 8,
              }}
            />
          ))}
        </div>

        {isLast ? (
          <div style={styles.actions}>
            <button type="button" onClick={onUnlock} style={styles.primary}>
              See Pro Plans
            </button>
            <button type="button" onClick={onSkip} style={styles.secondary}>
              Maybe later — start free
            </button>
          </div>
        ) : (
          <div style={styles.actions}>
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              style={styles.primary}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
    zIndex: 10000,
  },
  sheet: {
    position: "relative",
    width: "100%",
    maxWidth: "24rem",
    background: "rgba(31, 41, 55, 0.85)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "1.25rem",
    padding: "2.5rem 1.5rem 1.5rem",
    color: "white",
    textAlign: "center",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  skip: {
    position: "absolute",
    top: "0.75rem",
    right: "1rem",
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.55)",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  emoji: { fontSize: "3rem", lineHeight: 1, marginBottom: "0.75rem" },
  title: { fontSize: "1.4rem", fontWeight: 800, margin: "0 0 0.75rem" },
  body: {
    color: "#e5e7eb",
    fontSize: "0.95rem",
    lineHeight: 1.5,
    margin: "0 0 1.5rem",
  },
  dots: {
    display: "flex",
    gap: "0.4rem",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  dot: { height: 8, borderRadius: 999, transition: "all 0.2s" },
  actions: { display: "flex", flexDirection: "column", gap: "0.6rem" },
  primary: {
    padding: "0.9rem 1rem",
    borderRadius: "0.875rem",
    border: "none",
    background: "linear-gradient(90deg, #60a5fa 0%, #818cf8 100%)",
    color: "white",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
  },
  secondary: {
    padding: "0.6rem",
    borderRadius: "0.875rem",
    border: "none",
    background: "transparent",
    color: "#93c5fd",
    fontSize: "0.9rem",
    cursor: "pointer",
  },
} satisfies Record<string, React.CSSProperties>;
