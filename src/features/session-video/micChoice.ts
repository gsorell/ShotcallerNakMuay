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
