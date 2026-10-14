import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trackEvent } from "@/utils/analytics";
import {
  captureAndDownloadElement,
  captureElementAsBlob,
  shareStreakImage,
} from "@/utils/imageUtils";
import { CARD_BRAND as BRAND, CARD_EXPORT_WIDTH } from "../constants/cardBrand";

interface StreakShareSheetProps {
  current: number;
  longest: number;
  onClose: () => void;
}

/**
 * The streak as a stranger meets it — the round's challenge card, retold for
 * a run of days.
 *
 * Same hierarchy: the number is the hero, a footnote says how it stands
 * against the best, and the card closes in reversed colour. But not on the
 * round card's "Your move." — a streak is not a setup anyone can match, it is
 * a habit, so the close says what the number is made of: showing up, again.
 * There is no score here either, only a count of days.
 */
function StreakCard({ current, longest }: { current: number; longest: number }) {
  return (
    <div style={{ textAlign: "center", background: BRAND.surface }}>
      <div style={{ padding: "40px 28px 32px" }}>
        <div
          style={{
            fontSize: "0.8rem",
            color: BRAND.muted,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            marginBottom: 20,
          }}
        >
          Training streak
        </div>

        <div
          style={{
            fontSize: "5.5rem",
            fontWeight: 800,
            lineHeight: 1,
            color: BRAND.heading,
            marginBottom: 10,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {current}
        </div>

        <div
          style={{
            fontSize: "1.3rem",
            fontWeight: 700,
            color: BRAND.accent,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 24,
          }}
        >
          {current === 1 ? "Day one" : "Days straight"}
        </div>

        <div style={{ fontSize: "0.9rem", color: BRAND.muted }}>
          {longest > current
            ? `Longest: ${longest} days`
            : current === 1
            ? "Day two is tomorrow"
            : "Longest yet"}
        </div>
      </div>

      <div style={{ background: BRAND.ramp, color: BRAND.bg, padding: "20px 16px" }}>
        <div
          style={{
            fontSize: "1.65rem",
            fontWeight: 800,
            letterSpacing: "0.04em",
            lineHeight: 1.1,
          }}
        >
          Show up. Repeat.
        </div>
      </div>

      {/* The domain rather than the wordmark, for the reason given on the
          round's card in WorkoutCompleted.tsx: Facebook and Instagram drop
          the caption, so the image has to say where to go. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          padding: "16px 0 20px",
          background: BRAND.bg,
        }}
      >
        <img src="/assets/logo_mark.webp" alt="" style={{ width: 26, height: 26 }} />
        <span
          style={{
            fontSize: "0.85rem",
            color: BRAND.heading,
            fontWeight: 600,
            letterSpacing: "0.01em",
          }}
        >
          shotcallermuaythai.app
        </span>
      </div>
    </div>
  );
}

/**
 * Opened from the streak on the Workout Logs fighter card: a preview of the
 * card, and the ways to send it.
 */
export default function StreakShareSheet({
  current,
  longest,
  onClose,
}: StreakShareSheetProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleShare = async () => {
    if (!exportRef.current) return;
    setIsCapturing(true);
    try {
      try {
        trackEvent("streak_share", { streak: current });
      } catch { /* analytics must never break the share it measures */ }
      const blob = await captureElementAsBlob(exportRef.current);
      await shareStreakImage(blob, current);
    } catch {
      alert("Unable to share. Try Save instead.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSave = async () => {
    if (!exportRef.current) return;
    setIsCapturing(true);
    try {
      await captureAndDownloadElement(
        exportRef.current,
        `shotcaller-streak-${current}-day${current === 1 ? "" : "s"}`
      );
    } catch {
      alert("Failed to save the card. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  // Portalled to <body>: inside the .app-scroll container, iOS WebKit places
  // a fixed overlay against the container rather than the viewport.
  return createPortal(
    <div
      className="streak-share-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Share your streak"
      onClick={onClose}
    >
      <div className="streak-share-panel" onClick={(e) => e.stopPropagation()}>
        {/* What you see is the card at the panel's width; what is captured
            is the same card at the export width, parked offscreen, so the
            image is the same size whatever screen it was shared from. */}
        <div className="streak-share-preview">
          <StreakCard current={current} longest={longest} />
        </div>

        <div
          aria-hidden
          style={{
            position: "fixed",
            top: 0,
            left: -10000,
            width: CARD_EXPORT_WIDTH,
            pointerEvents: "none",
          }}
        >
          <div ref={exportRef} style={{ width: CARD_EXPORT_WIDTH }}>
            <StreakCard current={current} longest={longest} />
          </div>
        </div>

        <button
          type="button"
          className="streak-share-primary"
          onClick={handleShare}
          disabled={isCapturing}
        >
          {isCapturing ? "Preparing…" : "Share your streak"}
        </button>
        <div className="streak-share-secondary">
          <button type="button" onClick={handleSave} disabled={isCapturing}>
            Save image
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
