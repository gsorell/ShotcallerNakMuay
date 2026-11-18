import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Which microphone a session films with: always the phone's own.
 *
 * Asking for "a microphone" lets the system choose, and with a Bluetooth
 * speaker or headphones connected Android chooses the headset's — which
 * switches it into hands-free call mode. The callouts then play over a
 * narrowband call link, a speaker feeds its own microphone back into a
 * whistle, and the reel records from whatever the user is wearing. Worse,
 * the web view never hands the call route back: the speaker stayed in call
 * mode after the session ended, and the next session crackled from the
 * first bell (found on a Pixel with an Ankon speaker, 2026-11-10).
 *
 * Asking for the phone's own microphone by its id keeps the headset in
 * ordinary playback and the call link closed. The labels below are what
 * Chrome on Android ("Speakerphone") and iOS ("iPhone Microphone") call it.
 */
const BUILT_IN = /speakerphone|built-in|iphone microphone|ipad microphone/i;

/**
 * The phone's microphone's id, remembered between launches. Labels are
 * hidden until a page has opened a microphone, so the first session after a
 * launch couldn't find the phone's by name: it opened the default, the
 * Bluetooth speaker dropped into call mode for a moment, and the moment ate
 * "Get ready". Ids last as long as the app's site data, so once known, the
 * first request of a launch goes straight to the phone's microphone.
 */
const ID_KEY = "shotcaller_builtin_mic";

const rememberedId = (): string | undefined => {
  try {
    return localStorage.getItem(ID_KEY) || undefined;
  } catch {
    return undefined;
  }
};

const remember = (id: string | undefined): void => {
  try {
    if (id) localStorage.setItem(ID_KEY, id);
    else localStorage.removeItem(ID_KEY);
  } catch {
    /* only a shortcut */
  }
};

/** The phone's own microphone's id, once labels are readable (after access). */
export const builtInMicId = async (): Promise<string | undefined> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const id = devices.find(
      (d) => d.kind === "audioinput" && BUILT_IN.test(d.label)
    )?.deviceId;
    if (id) remember(id);
    return id;
  } catch {
    return undefined;
  }
};

/**
 * Room sound with as little done to it as works. No echo cancellation (it
 * would take the callouts out of the reel) and no noise suppression (it
 * dulls the crack of a pad, which the hit detector listens for).
 *
 * But not *nothing*: with every kind of processing off, Android hands over
 * a raw low-latency capture path, and with a Bluetooth speaker playing, the
 * phone's Bluetooth mixer can't keep up with it. It resynced 1,400 times in
 * 8 seconds, heard as heavy crackle on the speaker. Any one processing
 * switch on avoids that path (measured on a Pixel 9 Pro XL with an Ankon
 * speaker, 2026-11-10); gain control is the one that costs the reel least,
 * and evens out a reel that otherwise clipped up close.
 */
const RAW: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: true,
};

/**
 * Opens the phone's own microphone, or resolves null if there's no access.
 * If the id isn't known yet (labels are hidden until access is granted), it
 * opens the default, then reopens by id if the default wasn't the phone's.
 */
export const openBuiltInMic = async (): Promise<MediaStream | null> => {
  const open = (deviceId?: string) =>
    navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { ...RAW, deviceId: { exact: deviceId } } : RAW,
    });
  try {
    const known = await builtInMicId();
    if (known) return await open(known);
    // Labels hidden (first request since launch): the id from last time.
    const saved = rememberedId();
    if (saved) {
      try {
        const s = await open(saved);
        if (BUILT_IN.test(s.getAudioTracks()[0]?.label ?? "")) return s;
        s.getTracks().forEach((t) => t.stop());
      } catch {
        /* gone (site data cleared, new phone): find it again below */
      }
      remember(undefined);
    }
    const first = await open();
    const label = first.getAudioTracks()[0]?.label ?? "";
    if (BUILT_IN.test(label)) return first;
    const id = await builtInMicId();
    if (!id) return first;
    first.getTracks().forEach((t) => t.stop());
    return await open(id);
  } catch {
    return null;
  }
};

/**
 * Points the call route back at the phone. Opening the phone's microphone
 * by id does that, and closes a headset's call link if one was opened.
 */
export const releaseHeadsetRoute = async (): Promise<void> => {
  const id = await builtInMicId();
  if (!id) return;
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: id } },
    });
    s.getTracks().forEach((t) => t.stop());
  } catch {
    /* nothing to release */
  }
};

type PageAudioSession = { type: string };

/**
 * iOS: lets the page record while a session is filmed, and hands back what
 * undoes it.
 *
 * The app sets the page's audio session to "playback" when its sounds first
 * start (useSoundEffects: it's what keeps the Ring/Silent switch from muting
 * the bell). WebKit holds to that type even with the microphone open, and
 * playback has no input: every reel and full session filmed on an iPhone
 * came out silent, the microphone track there but empty (TestFlight build 90,
 * 2026-11-17). "play-and-record" is the type that records, and the switch
 * doesn't mute it either. Put back to what it was once filming is over.
 *
 * Safari before 16.4 has no navigator.audioSession and needs none of this:
 * left on "auto", WebKit records while the microphone is open.
 */
export const allowRecordingAudio = (log: (line: string) => void = () => {}): (() => void) => {
  if (Capacitor.getPlatform() !== "ios") return () => {};
  const session = (navigator as Navigator & { audioSession?: PageAudioSession }).audioSession;
  if (!session) {
    log("audio session: none (before iOS 16.4)");
    return () => {};
  }
  const before = session.type;
  try {
    session.type = "play-and-record";
  } catch (e) {
    log(`audio session: could not record (${String(e)})`);
    return () => {};
  }
  log(`audio session ${before} -> ${session.type}`);
  let undone = false;
  return () => {
    if (undone) return;
    undone = true;
    try {
      if (session.type === "play-and-record") {
        session.type = before === "play-and-record" ? "playback" : before;
      }
    } catch {
      /* left recording-capable: still audible, still not muted by the switch */
    }
  };
};

interface RecordingAudioPlugin {
  allowRecording(): Promise<{ status: string }>;
  release(): Promise<{ status: string }>;
  status(): Promise<{ status: string; events: string[] }>;
}

/** RecordingAudioPlugin in ios/App/App/AppDelegate.swift. */
const RecordingAudio = registerPlugin<RecordingAudioPlugin>("RecordingAudio");

const onIOS = () => Capacitor.getPlatform() === "ios";

/**
 * iOS, once the microphone is open: the app's own audio session set to
 * record and play together, out of the loudspeaker and alongside music.
 * WebKit's own setting for a recording page left the callouts (native
 * speech) silent while the bell still played (TestFlight build 91).
 */
export const allowRecordingNatively = async (log: (line: string) => void): Promise<void> => {
  if (!onIOS()) return;
  try {
    const { status } = await RecordingAudio.allowRecording();
    log(`native audio: ${status}`);
  } catch (e) {
    log(`native audio could not be set: ${String(e)}`);
  }
};

/** Back to AppDelegate's playback + mix, once filming is over (iOS). */
export const releaseRecordingNatively = async (log: (line: string) => void): Promise<void> => {
  if (!onIOS()) return;
  try {
    const { status } = await RecordingAudio.release();
    log(`native audio released: ${status}`);
  } catch (e) {
    log(`native audio could not be released: ${String(e)}`);
  }
};

/** The iOS audio session now, and what happened to it since last asked. */
export const logAudioSession = async (log: (line: string) => void, when: string): Promise<void> => {
  if (!onIOS()) return;
  try {
    const { status, events } = await RecordingAudio.status();
    events.forEach((e) => log(`audio: ${e}`));
    log(`audio ${when}: ${status}`);
  } catch (e) {
    log(`audio ${when}: unknown (${String(e)})`);
  }
};
