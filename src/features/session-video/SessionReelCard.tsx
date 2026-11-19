import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";

import { trackEvent } from "@/utils/analytics";
import {
  closeReelViewer,
  openReelEditor,
  openReelViewer,
  showInReelViewer,
  useFullSession,
  useReelEdit,
  useReelEditorOpen,
  useReelBuilding,
  useReelFailure,
  useReelViewer,
  useSessionReel,
  fullSessionText,
} from "./reelStore";
import ReelEditor from "./ReelEditor";
import { shareReel, shareVideoFile } from "./shareReel";
import "./SessionReelCard.css";

/**
 * The session's video on the completion screen: the reel's row, and under
 * it a line saying the full session went to the gallery. The reel's player
 * switches between the two (Reel | Full session), and opens the clip picker.
 * With no reel, the full session gets the row instead.
 */
export default function SessionReelCard() {
  const viewing = useReelViewer();
  const reel = useSessionReel();
  const full = useFullSession();
  const edit = useReelEdit();
  const editing = useReelEditorOpen();
  const building = useReelBuilding();

  // Leaving the completion screen leaves the player shut, so coming back to
  // the screen later doesn't land in it.
  useEffect(() => () => void closeReelViewer(), []);

  const reelSrc = reel ? (reel.fileUri ? Capacitor.convertFileSrc(reel.fileUri) : reel.url) : null;
  const fullSrc = full?.uri ? Capacitor.convertFileSrc(full.uri) : null;
  // Both to switch between: the reel, and a full session (saved or on its way).
  const tabs = reel && full ? (
    <div className="reel-viewer-tabs" role="tablist">
      {(["reel", "full"] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={viewing === t}
          className={`reel-viewer-tab ${viewing === t ? "is-on" : ""}`}
          onClick={() => showInReelViewer(t)}
        >
          {t === "reel" ? "Reel" : "Full session"}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <ReelRow src={reelSrc} />
      {reel || building ? <FullSessionNote /> : <FullSessionLine />}
      {viewing === "reel" && reel && reelSrc && (
        <VideoViewer
          key={reelSrc}
          src={reelSrc}
          label="Your reel"
          share={() => shareReel(reel)}
          format={reel.ext}
          tabs={tabs}
          edit={edit ? () => openReelEditor() : undefined}
        />
      )}
      {viewing === "full" && (
        <VideoViewer
          key="full"
          src={fullSrc}
          label="Your session"
          share={() => (full?.uri ? shareVideoFile(full.uri) : Promise.resolve("failed" as const))}
          format="full"
          tabs={tabs}
          waiting={full ? fullSessionText(full, Capacitor.getPlatform()) : "No full session this time"}
        />
      )}
      {editing && edit && <ReelEditor edit={edit} />}
    </>
  );
}

/** With a reel: the full session is only said, "Full session · 14 min · saved to Photos". */
function FullSessionNote() {
  const full = useFullSession();
  if (!full) return null;
  return (
    <p className={`full-session-line is-${full.status}`} aria-live="polite">
      {fullSessionText(full, Capacitor.getPlatform())}
    </p>
  );
}

/**
 * "Saving your full session…", then, saved, a row to watch it: "Watch your
 * session · 14 min · saved to Photos". Said from the moment the session
 * ends, so nobody finds it in the gallery days later by surprise.
 */
function FullSessionLine() {
  const full = useFullSession();
  if (!full) return null;
  if (full.status === "saved" && full.uri) {
    const src = Capacitor.convertFileSrc(full.uri);
    const minutes = Math.max(1, Math.round(full.durationMs / 60000));
    const gallery = Capacitor.getPlatform() === "ios" ? "Photos" : "your gallery";
    return (
      <button
        type="button"
        className="reel-ready"
        onClick={() => {
          openReelViewer("full");
          try {
            trackEvent("session_full_video_open", { minutes });
          } catch { /* analytics must never break the tap it measures */ }
        }}
      >
        <span className="reel-ready-thumb" aria-hidden="true">
          <video src={`${src}#t=0.1`} muted playsInline preload="metadata" />
          <span className="reel-ready-play">
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
        <span className="reel-ready-text">
          <span className="reel-ready-title">Watch your session</span>
          <span className="reel-ready-sub is-saved">
            {`${minutes} min · saved to ${gallery}${full.silent ? ", without sound" : ""}`}
          </span>
        </span>
        <span className="reel-ready-chevron" aria-hidden="true">
          ›
        </span>
      </button>
    );
  }
  return (
    <p className={`full-session-line is-${full.status}`} aria-live="polite">
      {fullSessionText(full, Capacitor.getPlatform())}
    </p>
  );
}

/**
 * "Your reel is ready" — a single row on the completion screen, under the
 * result. The result comes first; the reel is an offer, not a takeover, so
 * the card and its Share / Train again keep the screen. Tapping the row opens
 * the reel full screen.
 */
function ReelRow({ src }: { src: string | null }) {
  const reel = useSessionReel();
  const building = useReelBuilding();
  const failure = useReelFailure();

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

  if (!reel && failure) return <ReelFailed />;

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
    <button
      type="button"
      className="reel-ready"
      onClick={() => {
        openReelViewer("reel");
        try {
          trackEvent("session_reel_open", { clips: reel.clips });
        } catch { /* analytics must never break the tap it measures */ }
      }}
    >
      <span className="reel-ready-thumb" aria-hidden="true">
        {/* The first frame, as a poster. #t nudges Safari into drawing it. */}
        <video src={`${src ?? reel.url}#t=0.1`} muted playsInline preload="metadata" />
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
  );
}

/**
 * The session was filmed but no reel came out. Said plainly rather than the
 * row just vanishing; what happened is in the session's saved trace.
 */
function ReelFailed() {
  return (
    <div className="reel-failed">
      <div className="reel-ready is-failed" role="status">
        <span className="reel-ready-thumb reel-failed-mark" aria-hidden="true">
          !
        </span>
        <span className="reel-ready-text">
          <span className="reel-ready-title">Couldn't make your reel this time</span>
        </span>
      </div>
    </div>
  );
}

/**
 * A video full screen (the reel, or the full session), with Share and Watch
 * again; the Reel | Full session switch over it, and for the reel, Edit clips.
 */
function VideoViewer({
  src,
  label,
  share,
  format,
  tabs,
  edit,
  waiting,
}: {
  /** Null while there's nothing to play yet: `waiting` says why. */
  src: string | null;
  label: string;
  share: () => Promise<"shared" | "dismissed" | "failed">;
  /** For the analytics event: the reel's file type, or "full". */
  format: string;
  tabs?: React.ReactNode;
  /** Opens the clip picker. */
  edit?: () => void;
  waiting?: string;
}) {
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
    if (!v || !src) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      void v.play().catch(() => undefined);
    });
  }, [src]);

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
    const outcome = await share();
    setBusy(false);
    if (outcome === "failed") setFailed(true);
    try {
      trackEvent("session_reel_share", { outcome, format });
    } catch { /* analytics must never break the tap it measures */ }
  };

  return createPortal(
    <div className="reel-viewer" role="dialog" aria-modal="true" aria-label={label}>
      {src ? (
        <video
          ref={videoRef}
          className="reel-viewer-video"
          src={src}
          playsInline
          onEnded={() => setEnded(true)}
          onClick={togglePlay}
        />
      ) : (
        <p className="reel-viewer-waiting">{waiting}</p>
      )}

      {tabs}

      <button
        type="button"
        className="reel-viewer-close"
        aria-label="Close"
        onClick={() => closeReelViewer()}
      >
        ×
      </button>

      {ended && src && (
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
          disabled={busy || !src}
        >
          {busy ? "Preparing…" : "Share"}
        </button>
        <div className="reel-viewer-row">
          <button type="button" className="reel-viewer-again" onClick={replay} disabled={!src}>
            Watch again
          </button>
          {edit && (
            <button
              type="button"
              className="reel-viewer-again"
              onClick={() => {
                videoRef.current?.pause();
                edit();
                try {
                  trackEvent("session_reel_edit_open", {});
                } catch { /* analytics must never break the tap it measures */ }
              }}
            >
              Edit clips
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
