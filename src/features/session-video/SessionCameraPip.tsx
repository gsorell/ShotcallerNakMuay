import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { trackEvent } from "@/utils/analytics";
import { onCalloutEvent } from "./calloutSignal";
import { useRecordSession } from "./recordPreference";
import { ReelRecorder } from "./reelRecorder";
import {
  clearSessionReel,
  patchSessionReel,
  setReelBuilding,
  setSessionReel,
} from "./reelStore";
import { buildShortCut } from "./shortCut";
import { autoSaveReel } from "./saveToGallery";
import "./SessionCameraPip.css";

interface SessionCameraPipProps {
  /** A session is under way (pre-round countdown included). */
  active: boolean;
  /** Paused, resting or counting down: nothing is filmed. */
  holding: boolean;
  /** Between rounds: the round just ended is picked from and assembled. */
  resting: boolean;
  /** Rounds in the session, for each round's share of the reel. */
  rounds: number;
  /** One round's length: with the rounds, how long the reel runs. */
  roundMs: number;
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
  resting,
  rounds,
  roundMs,
}: SessionCameraPipProps) {
  const enabled = useRecordSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<ReelRecorder | null>(null);
  const [shown, setShown] = useState(false);
  const [recording, setRecording] = useState(false);
  const [lowBattery, setLowBattery] = useState(false);
  const planRef = useRef({ rounds, roundMs });
  useEffect(() => {
    planRef.current = { rounds, roundMs };
  }, [rounds, roundMs]);

  // Session lifecycle: open the camera at the start, hand over the reel at
  // the end. Keyed on `active` alone so nothing mid-session restarts it.
  useEffect(() => {
    if (!active || !enabled) return;
    clearSessionReel();
    let cancelled = false;
    const rec = new ReelRecorder(planRef.current.rounds, planRef.current.roundMs);
    rec.onRecordingChange = setRecording;
    recorderRef.current = rec;

    const video = videoRef.current;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const begin = async () => {
      if (!video) return;
      // A nearly flat phone is asked to call the session, not to film it:
      // recording is the heaviest thing it does.
      if (await batteryTooLow()) {
        if (cancelled || recorderRef.current !== rec) return;
        recorderRef.current = null;
        rec.release();
        setLowBattery(true);
        noticeTimer = setTimeout(() => setLowBattery(false), 6000);
        try {
          trackEvent("session_reel_error", { stage: "battery", error: "low" });
        } catch { /* analytics must never break the session */ }
        return;
      }
      if (cancelled) return;
      return rec.start(video).then(() => {
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
    };
    void begin();

    const off = onCalloutEvent((e) => recorderRef.current?.event(e));

    return () => {
      cancelled = true;
      if (noticeTimer) clearTimeout(noticeTimer);
      setLowBattery(false);
      off();
      setShown(false);
      setRecording(false);
      if (recorderRef.current !== rec) return; // closed early with the ×
      recorderRef.current = null;
      void handOver(rec);
    };
  }, [active, enabled]);

  useEffect(() => {
    if (holding) recorderRef.current?.hold();
  }, [holding]);

  // The rest is when a round's best clips are picked and assembled, so by
  // the final bell only the last round is left to do.
  useEffect(() => {
    if (resting) recorderRef.current?.roundOver();
  }, [resting]);

  const closeEarly = () => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    setShown(false);
    setRecording(false);
    if (rec) void handOver(rec);
  };

  if (!active || !enabled) return null;

  return createPortal(
    <>
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
      </div>
      {lowBattery && (
        <div className="session-pip-notice" role="status">
          Battery low: not recording this session
        </div>
      )}
    </>,
    document.body
  );
}

/** Recording on a battery this low is how a session ends in crackle. */
const LOW_BATTERY = 0.15;

/**
 * Below LOW_BATTERY and not charging. False wherever the battery can't be
 * read (iOS has no Battery API): film rather than guess.
 */
async function batteryTooLow(): Promise<boolean> {
  try {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
    };
    if (typeof nav.getBattery !== "function") return false;
    const b = await nav.getBattery();
    return !b.charging && b.level <= LOW_BATTERY;
  } catch {
    return false;
  }
}

async function handOver(rec: ReelRecorder): Promise<void> {
  // The completion screen says "Cutting your reel…" until it is ready.
  setReelBuilding(true);
  try {
    const reel = await rec.finish();
    if (reel) {
      setSessionReel(reel);
      // Kept without anyone having to remember to: straight to the gallery.
      void autoSaveReel(reel);
      trackEvent("session_reel_created", {
        clips: reel.clips,
        seconds: Math.round(reel.durationMs / 1000),
        format: reel.ext,
      });
      // Then the short version, while the result screen is being read.
      void buildShortCut(reel).then((short) => {
        if (!short) return;
        if (!patchSessionReel(reel, { short })) {
          URL.revokeObjectURL(short.url); // a newer session took over
          return;
        }
        void autoSaveReel(short, "_short");
        try {
          trackEvent("session_reel_short_created", {
            clips: short.clips,
            seconds: Math.round(short.durationMs / 1000),
          });
        } catch { /* analytics must never break the reel */ }
      });
    }
  } catch (e) {
    console.warn("Reel could not be finished:", e);
    rec.release();
  } finally {
    setReelBuilding(false);
  }
}
