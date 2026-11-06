import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { trackEvent } from "@/utils/analytics";
import { onCallout } from "./calloutSignal";
import { useRecordSession } from "./recordPreference";
import { ReelRecorder } from "./reelRecorder";
import { clearSessionReel, setSessionReel } from "./reelStore";
import "./SessionCameraPip.css";

interface SessionCameraPipProps {
  /** A session is under way (pre-round countdown included). */
  active: boolean;
  /** Paused or resting: no clip should run through either. */
  holding: boolean;
  /** Rounds × round length, for spreading clips across the whole session. */
  plannedWorkMs: number;
}

/**
 * The camera in the corner of the session screen, and the recorder behind it.
 *
 * Shown only while a session runs and "Record my session" is on in the menu.
 * The reel it builds is handed to the reel store when the session ends, for
 * the completion screen to play.
 */
export default function SessionCameraPip({
  active,
  holding,
  plannedWorkMs,
}: SessionCameraPipProps) {
  const enabled = useRecordSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<ReelRecorder | null>(null);
  const [shown, setShown] = useState(false);
  const [recording, setRecording] = useState(false);
  const plannedRef = useRef(plannedWorkMs);
  useEffect(() => {
    plannedRef.current = plannedWorkMs;
  }, [plannedWorkMs]);

  // Session lifecycle: open the camera at the start, hand over the reel at
  // the end. Keyed on `active` alone so nothing mid-session restarts it.
  useEffect(() => {
    if (!active || !enabled) return;
    clearSessionReel();
    let cancelled = false;
    const rec = new ReelRecorder(plannedRef.current);
    rec.onRecordingChange = setRecording;
    recorderRef.current = rec;

    const video = videoRef.current;
    if (video) {
      rec.start(video).then(() => {
        // Seen once there is a picture, and not if the × already closed it.
        if (!cancelled && recorderRef.current === rec) setShown(true);
      }).catch((e) => {
        console.warn("Session camera unavailable:", e);
        try {
          trackEvent("session_reel_error", {
            stage: "camera",
            error: String((e as Error)?.name ?? e),
          });
        } catch { /* analytics must never break the session */ }
        if (recorderRef.current === rec) recorderRef.current = null;
        rec.release();
        if (!cancelled) setShown(false);
      });
    }

    const off = onCallout(() => recorderRef.current?.callout());

    return () => {
      cancelled = true;
      off();
      setShown(false);
      setRecording(false);
      if (recorderRef.current !== rec) return; // closed early with the ×
      recorderRef.current = null;
      void handOver(rec);
    };
  }, [active, enabled]);

  useEffect(() => {
    if (holding) recorderRef.current?.endClip();
  }, [holding]);

  const closeEarly = () => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    setShown(false);
    setRecording(false);
    if (rec) void handOver(rec);
  };

  if (!active || !enabled) return null;

  return createPortal(
    <div
      className={`session-pip ${shown ? "is-on" : ""} ${
        recording ? "is-recording" : ""
      }`}
      aria-label={recording ? "Camera, recording" : "Camera"}
    >
      <video ref={videoRef} muted playsInline autoPlay />
      <span className="session-pip-dot" aria-hidden="true" />
      <button
        type="button"
        className="session-pip-close"
        aria-label="Turn off the camera for this session"
        onClick={closeEarly}
      >
        ×
      </button>
    </div>,
    document.body
  );
}

async function handOver(rec: ReelRecorder): Promise<void> {
  try {
    const reel = await rec.finish();
    if (reel) {
      setSessionReel(reel);
      trackEvent("session_reel_created", {
        clips: reel.clips,
        seconds: Math.round(reel.durationMs / 1000),
        format: reel.ext,
      });
    }
  } catch (e) {
    console.warn("Reel could not be finished:", e);
    rec.release();
  }
}
