import { useState, useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";

import { trackEvent } from "@/utils/analytics";

import { recordsSoundNatively, releaseHeadsetRoute, requestNativeMicrophone } from "./micChoice";

const KEY = "shotcaller_record_session";
/** Absent means on: the full session is kept unless someone says not to. */
const FULL_KEY = "shotcaller_keep_full_session";

/**
 * Whether this device can record a reel at all: a camera API, a recorder, and
 * a canvas that can be recorded (the watermark is drawn on one). The setup
 * screen hides the switch where any is missing rather than offering a broken one.
 */
export const isReelRecordingSupported = (): boolean => {
  try {
    return (
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined" &&
      typeof HTMLCanvasElement !== "undefined" &&
      typeof HTMLCanvasElement.prototype.captureStream === "function"
    );
  } catch {
    return false;
  }
};

const listeners = new Set<() => void>();

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export const setRecordSession = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* falls back to off next launch; nothing worse */
  }
  listeners.forEach((l) => l());
};

export const getRecordSession = (): boolean =>
  isReelRecordingSupported() && read();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const useRecordSession = (): boolean =>
  useSyncExternalStore(subscribe, getRecordSession, () => false);

/**
 * iPhone: no reel, the full session only (2026-11-18). Re-filming the clips
 * in the web view froze for up to a second at a time (TestFlight builds
 * 100-104), so for now an iPhone saves the session as it was filmed.
 */
export const REEL_ON_IOS = false;

/** Whether a highlight reel is cut on this platform. */
export const reelWanted = (): boolean => Capacitor.getPlatform() !== "ios" || REEL_ON_IOS;

/**
 * Whether the whole session, uncut, is saved to the gallery beside the reel.
 * On unless turned off: it is hundreds of MB, so it can be.
 */
export const getKeepFullSession = (): boolean => {
  try {
    return localStorage.getItem(FULL_KEY) !== "0";
  } catch {
    return true;
  }
};

export const setKeepFullSession = (on: boolean): void => {
  try {
    if (on) localStorage.removeItem(FULL_KEY);
    else localStorage.setItem(FULL_KEY, "0");
  } catch {
    /* falls back to on next launch */
  }
  listeners.forEach((l) => l());
  try {
    trackEvent("session_full_video_toggle", { on });
  } catch { /* analytics must never break the tap it measures */ }
};

export const useKeepFullSession = (): boolean =>
  useSyncExternalStore(subscribe, getKeepFullSession, () => true);

/**
 * The "Record my session" switch, wherever it is shown. Turning it on asks
 * for the camera there and then, so the system prompt never lands in the
 * middle of a countdown.
 */
export const useRecordToggle = () => {
  const on = useRecordSession();
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);
  const toggle = async () => {
    if (asking) return;
    if (on) {
      setRecordSession(false);
      try {
        trackEvent("session_reel_toggle", { on: false });
      } catch { /* analytics must never break the tap it measures */ }
      return;
    }
    setAsking(true);
    const granted = await requestCameraAccess();
    setAsking(false);
    setDenied(!granted);
    if (granted) setRecordSession(true);
    try {
      trackEvent("session_reel_toggle", { on: granted, denied: !granted });
    } catch { /* analytics must never break the tap it measures */ }
  };
  return { supported: isReelRecordingSupported(), on, asking, denied, toggle };
};

/**
 * Asks for the camera and microphone now, while the user is looking at the
 * switch, so the system prompts never land in the middle of a pre-round
 * countdown. The stream is closed straight away; the session opens its own.
 *
 * The camera is what matters: refuse the microphone and the reel is filmed
 * silent, judged on movement alone.
 */
export const requestCameraAccess = async (): Promise<boolean> => {
  const tryOpen = async (audio: boolean) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio,
    });
    stream.getTracks().forEach((t) => t.stop());
  };
  if (recordsSoundNatively()) {
    // iOS: the camera here, the microphone natively (see micChoice.ts): a
    // microphone opened by the web view, even this briefly, stops music.
    try {
      await tryOpen(false);
    } catch {
      return false;
    }
    await requestNativeMicrophone();
    return true;
  }
  try {
    await tryOpen(true);
    // That asked for "a microphone", which may have put a Bluetooth speaker
    // or headphones into call mode and left them there (see micChoice.ts).
    await releaseHeadsetRoute();
    return true;
  } catch {
    try {
      await tryOpen(false);
      return true;
    } catch {
      return false;
    }
  }
};
