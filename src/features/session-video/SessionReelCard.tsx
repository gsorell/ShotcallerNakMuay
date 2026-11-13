import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";

import { trackEvent } from "@/utils/analytics";
import {
  closeReelViewer,
  openReelViewer,
  useReelBuilding,
  useReelFailure,
  useReelViewerOpen,
  useSessionReel,
  type ReelFailure,
  type SessionReel,
} from "./reelStore";
import { shareReel } from "./shareReel";
import "./SessionReelCard.css";

/**
 * "Your reel is ready" — a single row on the completion screen, under the
 * result. The result comes first; the reel is an offer, not a takeover, so
 * the card and its Share / Train again keep the screen. Tapping the row opens
 * the reel full screen.
 */
export default function SessionReelCard() {
  const reel = useSessionReel();
  const viewerOpen = useReelViewerOpen();
  const building = useReelBuilding();
  const failure = useReelFailure();

  // Leaving the completion screen leaves the player shut, so coming back to
  // the screen later doesn't land in it.
  useEffect(() => () => void closeReelViewer(), []);

  // The last round's best moments are still being cut in: a few seconds.
  if (!reel && building) {
    return (
      <div className="reel-ready is-building" role="status" aria-live="polite">
        <span className="reel-ready-thumb reel-ready-spinner" aria-hidden="true" />
        <span className="reel-ready-text">
          <span className="reel-ready-title">Cutting your reel…</span>
          <span className="reel-ready-sub">Picking your best moments</span>
        </span>
      </div>
    );
  }

  if (!reel && failure) return <ReelFailed failure={failure} />;

  if (!reel) return null;

  const seconds = Math.max(1, Math.round(reel.durationMs / 1000));
  const galleryName = Capacitor.getPlatform() === "ios" ? "Photos" : "your gallery";
  const status =
    reel.gallery === "saving"
      ? `Saving to ${galleryName}…`
      : reel.gallery === "saved"
      ? `${seconds}s · saved to ${galleryName}`
      : reel.gallery === "failed"
      ? `${seconds}s · not saved, tap to share it instead`
      : `${seconds}s of today's rounds · tap to watch`;

  return (
    <>
      <button
        type="button"
        className="reel-ready"
        onClick={() => {
          openReelViewer();
          try {
            trackEvent("session_reel_open", { clips: reel.clips });
          } catch { /* analytics must never break the tap it measures */ }
        }}
      >
        <span className="reel-ready-thumb" aria-hidden="true">
          {/* The first frame, as a poster. #t nudges Safari into drawing it. */}
          <video src={`${reel.url}#t=0.1`} muted playsInline preload="metadata" />
          <span className="reel-ready-play">
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
        <span className="reel-ready-text">
          <span className="reel-ready-title">Your reel is ready</span>
          <span
            className={`reel-ready-sub ${
              reel.gallery === "saved" ? "is-saved" : ""
            }`}
          >
            {status}
          </span>
        </span>
        <span className="reel-ready-chevron" aria-hidden="true">
          ›
        </span>
      </button>

      {viewerOpen && <ReelViewer reel={reel} />}
    </>
  );
}

/**
 * The session was filmed but no reel came out. Said plainly rather than the
 * row just vanishing, with what happened behind "Details" — on an iPhone
 * there is no other way to see why.
 */
function ReelFailed({ failure }: { failure: ReelFailure }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="reel-failed">
      <button
        type="button"
        className="reel-ready is-failed"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="reel-ready-thumb reel-failed-mark" aria-hidden="true">
          !
        </span>
        <span className="reel-ready-text">
          <span className="reel-ready-title">Couldn't make your reel this time</span>
          <span className="reel-ready-sub">
            {open ? "Hide details" : "Tap for details"}
          </span>
        </span>
      </button>
      {open && (
        <pre className="reel-failed-details">
          {`${failure.reason}\n\n${failure.trace}`}
        </pre>
      )}
    </div>
  );
}

/** The reel, full screen, with Share / Save and Watch again. */
function ReelViewer({ reel }: { reel: SessionReel }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Escape closes the player and nothing else: caught on the way down,
  // before the app's own Escape-means-back hears it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      closeReelViewer();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // With its sound: the reel was recorded with it. Opened by a tap, so the
  // apps allow it; where a browser won't, it starts muted and a tap on the
  // picture turns the sound on.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      void v.play().catch(() => undefined);
    });
  }, [reel.url]);

  const replay = () => {
    const v = videoRef.current;
    if (!v) return;
    setEnded(false);
    v.currentTime = 0;
    void v.play().catch(() => undefined);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (ended) return replay();
    if (v.muted) {
      v.muted = false;
      if (v.paused) void v.play().catch(() => undefined);
      return;
    }
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  };

  const onShare = async () => {
    setBusy(true);
    setFailed(false);
    videoRef.current?.pause();
    const outcome = await shareReel(reel);
    setBusy(false);
    if (outcome === "failed") setFailed(true);
    try {
      trackEvent("session_reel_share", { outcome, format: reel.ext });
    } catch { /* analytics must never break the tap it measures */ }
  };

  return createPortal(
    <div className="reel-viewer" role="dialog" aria-modal="true" aria-label="Your reel">
      <video
        ref={videoRef}
        className="reel-viewer-video"
        src={reel.url}
        playsInline
        onEnded={() => setEnded(true)}
        onClick={togglePlay}
      />

      <button
        type="button"
        className="reel-viewer-close"
        aria-label="Close"
        onClick={() => closeReelViewer()}
      >
        ×
      </button>

      {ended && (
        <button
          type="button"
          className="reel-viewer-replay-big"
          aria-label="Watch again"
          onClick={replay}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
          </svg>
        </button>
      )}

      <div className="reel-viewer-bar">
        {failed && (
          <p className="reel-viewer-error" role="alert">
            Couldn't open sharing. Try again in a moment.
          </p>
        )}
        <button
          type="button"
          className="reel-viewer-share"
          onClick={onShare}
          disabled={busy}
        >
          {busy ? "Preparing…" : "Share"}
        </button>
        <button type="button" className="reel-viewer-again" onClick={replay}>
          Watch again
        </button>
      </div>
    </div>,
    document.body
  );
}
