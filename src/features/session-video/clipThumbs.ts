import type { ReelCandidate } from "./reelPlan";

/** Thumbnails already drawn, by source and clip: reopening the picker is instant. */
const drawn = new Map<string, string>();
const key = (src: string, seq: number) => `${src}#${seq}`;

export const cachedThumb = (src: string, seq: number): string | undefined => drawn.get(key(src, seq));

const settle = (v: HTMLVideoElement, event: string, ms: number) =>
  new Promise<boolean>((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      v.removeEventListener(event, onEvent);
      v.removeEventListener("error", onError);
      resolve(ok);
    };
    const onEvent = () => done(true);
    const onError = () => done(false);
    const timer = setTimeout(() => done(false), ms);
    v.addEventListener(event, onEvent, { once: true });
    v.addEventListener("error", onError, { once: true });
  });

/**
 * Draws a still for each clip, a little way into its action, one at a time
 * from a hidden player on the recording (`src`, a URL the web view can load:
 * same origin, so the canvas can be read). Each is handed to `onThumb` as it
 * lands. Stops when `signal` aborts.
 */
export const drawClipThumbs = async (
  src: string,
  clips: ReelCandidate[],
  onThumb: (seq: number, url: string) => void,
  signal: AbortSignal,
  width = 180
): Promise<void> => {
  const todo = clips.filter((c) => !drawn.has(key(src, c.seq)));
  if (!todo.length) return;
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = src;
  try {
    if (v.readyState < 1 && !(await settle(v, "loadedmetadata", 8000))) return;
    // Safari draws nothing from a player that has never played.
    await v.play().catch(() => undefined);
    v.pause();
    const w = width;
    const h = Math.round((width * (v.videoHeight || 16)) / (v.videoWidth || 9));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    for (const c of todo) {
      if (signal.aborted) return;
      const at = c.fromMs + (c.toMs - c.fromMs) * 0.4;
      v.currentTime = at / 1000;
      if (!(await settle(v, "seeked", 4000))) continue;
      if (signal.aborted) return;
      try {
        ctx.drawImage(v, 0, 0, w, h);
        const url = canvas.toDataURL("image/jpeg", 0.7);
        drawn.set(key(src, c.seq), url);
        onThumb(c.seq, url);
      } catch {
        return; // a canvas that can't be read won't start working
      }
    }
  } finally {
    v.removeAttribute("src");
    v.load();
  }
};

/** Lets go of a session's thumbnails (a new session's are drawn fresh). */
export const forgetThumbs = (): void => drawn.clear();
