import { useSyncExternalStore } from "react";

const KEY = "shotcaller_record_session";

/**
 * Whether this device can record a reel at all: a camera API, a recorder, and
 * a canvas that can be recorded (the watermark is drawn on one). The menu
 * hides the switch where any is missing rather than offering a broken one.
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

export const useRecordSession = (): boolean =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getRecordSession,
    () => false
  );

/**
 * Asks for the camera now, while the user is looking at the switch, so the
 * system prompt never lands in the middle of a pre-round countdown. The
 * stream is closed straight away; the session opens its own.
 */
export const requestCameraAccess = async (): Promise<boolean> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
};
