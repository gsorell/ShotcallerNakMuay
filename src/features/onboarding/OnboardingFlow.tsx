import { Capacitor } from "@capacitor/core";
import React, { useState } from "react";

import { APP_STORE_URL, PLAY_STORE_URL } from "@/constants/storeLinks";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { TOTAL_LESSON_COUNT } from "@/features/learn";
import { FOUNDATIONS, coreLevels } from "@/features/roadmap/data/paths";
import { OnboardingModal } from "@/features/shared";

// Derived from the path itself so the pitch can't drift as levels are added.
const FOUNDATIONS_LEVEL_COUNT = coreLevels(FOUNDATIONS).length;

interface OnboardingFlowProps {
  /** Dismiss to the free app without opening the paywall ("Maybe later"). */
  onSkip: () => void;
  /**
   * Dismiss and open the paywall (the paywall-forward primary action). Safe on
   * every platform: the paywall itself explains the browser has no purchase
   * path and links to the apps.
   */
  onUnlock: () => void;
}

interface Item {
  iconPath: string;
  label: string;
  desc: string;
}

const CUSTOMIZE_ITEMS: { label: string; desc: string }[] = [
  {
    label: "Edit any style",
    desc: "Tweak the combos in any style — or build your own from scratch — in the Technique Editor.",
  },
  {
    label: "Dial in the session",
    desc: "Set rounds, rest, difficulty, and callout speed to match your level.",
  },
  {
    label: "Train your way",
    desc: "Southpaw mirroring, calisthenics between rounds, and voice options.",
  },
];

const PRO_ITEMS: Item[] = [
  {
    iconPath: "/assets/icon_newb.png",
    label: "The Start Here path",
    // Level 1 is free on purpose — say so rather than overselling the lock.
    desc: `${FOUNDATIONS_LEVEL_COUNT} guided levels that teach the strikes a few at a time. First level free.`,
  },
  {
    iconPath: "/assets/icon_mat.png",
    label: "Every fighting style",
    desc: "Mat, Tae, Khao, Sok, Femur, Boxing, and the whole roster.",
  },
  {
    iconPath: "/assets/icon.muaytech.png",
    label: "Learn the Techniques",
    // Count comes from the library itself so this can't drift as lessons are
    // added — see features/learn/data/techniqueLibrary.
    desc: `How to throw all ${TOTAL_LESSON_COUNT} techniques the app calls out.`,
  },
  {
    iconPath: "/assets/icon_edit.png",
    label: "Technique Editor",
    desc: "Build your own combos and custom styles.",
  },
  {
    iconPath: "/assets/icon_trophy1.png",
    label: "Charm progression",
    desc: "Earn charms for streaks and milestones as you train.",
  },
];

const HOWTO_STEPS = [
  {
    n: "1",
    title: "Pick your style & rounds",
    desc: "Choose one or more emphases, then set round length, rest, and difficulty.",
  },
  {
    n: "2",
    title: "Press start, hands up",
    desc: "The app calls the strikes out loud — you react and flow, eyes off the screen.",
  },
  {
    n: "3",
    title: "The screen is just a backup",
    desc: "Glance only if you miss a cue. The goal is to train without looking down.",
  },
];

const TOTAL_STEPS = 5;

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onSkip,
  onUnlock,
}) => {
  const [step, setStep] = useState(0);
  const [showGlossary, setShowGlossary] = useState(false);
  const isLast = step === TOTAL_STEPS - 1;

  const isWeb = !Capacitor.isNativePlatform();
  const openStore = () => {
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    const url = /iPad|iPhone|iPod/.test(ua) ? APP_STORE_URL : PLAY_STORE_URL;
    trackEvent(AnalyticsEvents.PWAInstallAccept, { source: "onboarding" });
    window.open(url, "_blank");
    onSkip();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome" style={styles.backdrop}>
      <div style={styles.card}>
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            style={{ ...styles.navText, left: "1rem" }}
          >
            ‹ Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onSkip}
          style={{ ...styles.navText, right: "1rem" }}
        >
          Skip
        </button>

        <div style={styles.logoFrame}>
          <img
            src="/assets/Logo_Header_Banner_Smooth1.png"
            alt="Nak Muay Shot Caller"
            style={styles.banner}
          />
        </div>

        {step === 0 && (
          <>
            <h2 style={styles.title}>Meet your new padholder</h2>
            <p style={styles.body}>
              Nak Muay Shot Caller turns shadowboxing, bagwork, and pad or
              partner drills into guided sessions — <strong>spoken technique
              callouts</strong> over timed rounds, so you can drill reaction and
              flow anytime.
            </p>
            <p style={styles.note}>
              It assumes you already know the form for each strike; it won't
              teach or correct technique. New to it? Learn the basics from a
              qualified coach first.
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <h2 style={styles.title}>How it works</h2>
            <div style={styles.list}>
              {HOWTO_STEPS.map((s) => (
                <div key={s.n} style={styles.row}>
                  <span style={styles.numBadge}>{s.n}</span>
                  <div style={{ minWidth: 0, textAlign: "left" }}>
                    <div style={styles.rowLabel}>{s.title}</div>
                    <div style={styles.rowDesc}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={styles.title}>Speak the language</h2>
            <p style={styles.body}>
              Muay Thai combos use a <strong>number system</strong> — Jab = 1,
              Cross = 2, hooks 3 &amp; 4, uppercuts 5 &amp; 6 — plus kicks,
              knees, and elbows called by name.
            </p>
            <p style={styles.note}>
              New to the numbers? A full glossary of every strike and defense is
              built in.{" "}
              <button
                type="button"
                onClick={() => setShowGlossary(true)}
                style={styles.link}
              >
                Open the glossary
              </button>
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={styles.title}>Make it your own</h2>
            <ul style={styles.bullets}>
              {CUSTOMIZE_ITEMS.map((it) => (
                <li key={it.label} style={styles.bullet}>
                  <strong style={styles.bulletLabel}>{it.label}.</strong>{" "}
                  {it.desc}
                </li>
              ))}
            </ul>
          </>
        )}

        {step === 4 && (
          <>
            <h2 style={styles.title}>
              {isWeb ? "Everything is in the app" : "Start free — or go Pro"}
            </h2>
            <p style={{ ...styles.note, marginBottom: "0.9rem" }}>
              Free forever: <strong style={{ color: "#f9a8d4" }}>Nak Muay
              Newb</strong>, <strong style={{ color: "#f9a8d4" }}>Freestyle</strong>,
              and the round <strong style={{ color: "#f9a8d4" }}>Timer</strong>
              {isWeb
                ? " — here or in the app. Pro can only be bought in the app, and unlocks:"
                : ". Go Pro to unlock:"}
            </p>
            <div style={styles.list}>
              {PRO_ITEMS.map((it) => (
                <div key={it.label} style={styles.row}>
                  <img
                    src={it.iconPath}
                    alt=""
                    style={styles.rowIcon}
                    aria-hidden="true"
                  />
                  <div style={{ minWidth: 0, textAlign: "left" }}>
                    <div style={styles.rowLabel}>{it.label}</div>
                    <div style={styles.rowDesc}>{it.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              style={{
                ...styles.dot,
                background: i === step ? "#ec4899" : "rgba(255,255,255,0.22)",
                width: i === step ? 22 : 8,
              }}
            />
          ))}
        </div>

        {isLast ? (
          <div style={styles.actions}>
            {/* In a browser, Pro cannot be bought — "See Pro Plans" leads to a
                paywall whose entire job is to explain that and point at the
                stores. So on web the ask is the store directly. This also
                absorbs the standalone install prompt, which used to fire at a
                first-time visitor seconds after they closed this. */}
            {isWeb ? (
              <>
                <button
                  type="button"
                  onClick={openStore}
                  style={styles.primary}
                >
                  Get the app
                </button>
                <button type="button" onClick={onSkip} style={styles.secondary}>
                  Keep going in the browser
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={onUnlock} style={styles.primary}>
                  See Pro Plans
                </button>
                <button type="button" onClick={onSkip} style={styles.secondary}>
                  Maybe later — start free
                </button>
              </>
            )}
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

      <OnboardingModal
        open={showGlossary}
        modalScrollPosition={0}
        linkButtonStyle={{}}
        setPage={() => {}}
        onClose={() => setShowGlossary(false)}
      />
    </div>
  );
};

// --- Type scale (kept deliberately small for a consistent look) ---
//   title  1.25rem / 800    heading  0.9rem / 700 (row + bold labels)
//   body   0.9rem  / 400    small    0.85rem / 400 (descriptions)
//   button 0.95rem / 700
const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9990,
    padding: "1rem",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: "380px",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#1a1a2e",
    color: "white",
    borderRadius: "16px",
    padding: "3.6rem 1.5rem 1.5rem",
    boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
    textAlign: "center",
  },
  navText: {
    position: "absolute",
    top: "0.9rem",
    background: "transparent",
    border: "none",
    color: "#9ca3af",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
    padding: "0.25rem 0.4rem",
  },
  logoFrame: {
    margin: "0 auto 1.4rem",
    maxWidth: "290px",
    padding: "10px",
    borderRadius: "16px",
    background: "rgba(249, 168, 212, 0.1)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  banner: {
    display: "block",
    width: "100%",
    height: "auto",
    borderRadius: "10px",
  },
  title: {
    fontSize: "1.25rem",
    fontWeight: 800,
    margin: "0 0 0.75rem",
    color: "white",
  },
  body: {
    fontSize: "0.9rem",
    fontWeight: 400,
    lineHeight: 1.5,
    color: "#cbd5e1",
    margin: "0 0 0.75rem",
  },
  note: {
    fontSize: "0.9rem",
    fontWeight: 400,
    lineHeight: 1.5,
    color: "#9ca3af",
    margin: 0,
  },
  link: {
    background: "transparent",
    border: "none",
    padding: 0,
    font: "inherit",
    fontWeight: 600,
    color: "#f9a8d4",
    textDecoration: "underline",
    cursor: "pointer",
  },
  list: { display: "flex", flexDirection: "column", gap: "0.9rem" },
  row: { display: "flex", alignItems: "center", gap: "0.8rem" },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    objectFit: "cover",
    flexShrink: 0,
  },
  numBadge: {
    width: 30,
    height: 30,
    flexShrink: 0,
    borderRadius: 999,
    background: "#ec4899",
    color: "white",
    fontWeight: 800,
    fontSize: "0.9rem",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: "0.9rem", fontWeight: 700, color: "white" },
  rowDesc: {
    fontSize: "0.85rem",
    lineHeight: 1.4,
    color: "#9ca3af",
    marginTop: "0.12rem",
  },
  bullets: {
    textAlign: "left",
    margin: 0,
    padding: "0 0 0 1.1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.7rem",
  },
  bullet: { fontSize: "0.9rem", lineHeight: 1.45, color: "#9ca3af" },
  bulletLabel: { color: "white", fontWeight: 700 },
  dots: {
    display: "flex",
    gap: "0.4rem",
    justifyContent: "center",
    alignItems: "center",
    margin: "1.4rem 0",
  },
  dot: { height: 8, borderRadius: 999, transition: "all 0.2s" },
  actions: { display: "flex", flexDirection: "column", gap: "0.55rem" },
  primary: {
    padding: "0.85rem 1rem",
    borderRadius: "10px",
    border: "none",
    background: "#ec4899",
    color: "white",
    fontWeight: 700,
    fontSize: "0.95rem",
    cursor: "pointer",
  },
  secondary: {
    padding: "0.55rem",
    borderRadius: "10px",
    border: "none",
    background: "transparent",
    color: "#9ca3af",
    fontWeight: 600,
    fontSize: "0.9rem",
    cursor: "pointer",
  },
} satisfies Record<string, React.CSSProperties>;
