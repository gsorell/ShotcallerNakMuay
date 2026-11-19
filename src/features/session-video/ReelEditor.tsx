import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";

import { trackEvent } from "@/utils/analytics";
import { cachedThumb, drawClipThumbs } from "./clipThumbs";
import { HAND_PICKED_MAX_MS, chosenClips, clipsMs, rebuildReel } from "./reelEdit";
import type { ReelCandidate } from "./reelPlan";
import { closeReelEditor, closeReelViewer, setReelEdit, setSessionReel, type ReelEdit } from "./reelStore";
import { autoSaveReel } from "./saveToGallery";
import "./ReelEditor.css";

const clipLabel = (c: ReelCandidate): string =>
  c.calls.map((x) => x.text).join(" · ") || "Free movement";

const secs = (ms: number): string => `${Math.max(1, Math.round(ms / 1000))}s`;

/**
 * The clip picker, over the reel's player: every clip the session offered,
 * round by round, the reel's own ticked in order. Tap a clip to watch it at
 * the top; tick or untick it; "Rebuild reel" cuts the reel again from the
 * recording with exactly those clips, in filmed order. What someone picks
 * wins over the automatic reel's variety rules.
 */
export default function ReelEditor({ edit }: { edit: ReelEdit }) {
  const src = useMemo(() => Capacitor.convertFileSrc(edit.source), [edit.source]);
  const [picked, setPicked] = useState<number[]>(edit.picked);
  const [focus, setFocus] = useState<ReelCandidate | null>(
    () => edit.candidates.find((c) => c.seq === edit.picked[0]) ?? edit.candidates[0] ?? null
  );
  const [thumbs, setThumbs] = useState<Record<number, string>>(() => {
    const out: Record<number, string> = {};
    for (const c of edit.candidates) {
      const t = cachedThumb(src, c.seq);
      if (t) out[c.seq] = t;
    }
    return out;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  // Stills for the grid, drawn in the background as the picker opens.
  useEffect(() => {
    const ac = new AbortController();
    void drawClipThumbs(
      src,
      edit.candidates,
      (seq, url) => setThumbs((t) => ({ ...t, [seq]: url })),
      ac.signal
    );
    return () => ac.abort();
  }, [src, edit.candidates]);

  // The focused clip plays on a loop at the top.
  useEffect(() => {
    const v = previewRef.current;
    if (!v || !focus) return;
    const from = focus.fromMs / 1000;
    const to = focus.toMs / 1000;
    const start = () => {
      v.currentTime = from;
      v.play().catch(() => {
        v.muted = true;
        void v.play().catch(() => undefined);
      });
    };
    const onTime = () => {
      if (v.currentTime >= to || v.currentTime < from - 0.5) v.currentTime = from;
    };
    if (v.readyState >= 1) start();
    else v.addEventListener("loadedmetadata", start, { once: true });
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("loadedmetadata", start);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [focus]);

  const chosen = useMemo(() => chosenClips(edit, picked), [edit, picked]);
  const totalMs = clipsMs(chosen);
  const order = new Map(chosen.map((c, i) => [c.seq, i + 1]));
  const changed =
    picked.length !== edit.picked.length || picked.some((s) => !edit.picked.includes(s));

  const rounds = useMemo(() => {
    const by = new Map<number, ReelCandidate[]>();
    for (const c of edit.candidates) by.set(c.round, [...(by.get(c.round) ?? []), c]);
    return [...by.entries()].sort((a, b) => a[0] - b[0]);
  }, [edit.candidates]);

  const isIn = (c: ReelCandidate) => order.has(c.seq);
  const fits = (c: ReelCandidate) => totalMs + c.toMs - c.fromMs <= HAND_PICKED_MAX_MS;

  const toggle = (c: ReelCandidate) => {
    setError(null);
    if (isIn(c)) {
      setPicked((p) => p.filter((s) => s !== c.seq));
    } else if (fits(c)) {
      setPicked((p) => [...p, c.seq]);
    } else {
      setError(`A reel tops out at ${secs(HAND_PICKED_MAX_MS)} of clips. Take one out first.`);
    }
  };

  const rebuild = async () => {
    setBusy(true);
    setError(null);
    previewRef.current?.pause();
    const reel = await rebuildReel(edit, picked, (line) => console.info(`[reel edit] ${line}`));
    setBusy(false);
    try {
      trackEvent("session_reel_edit", {
        clips: picked.length,
        seconds: Math.round(totalMs / 1000),
        outcome: reel ? "rebuilt" : "failed",
      });
    } catch { /* analytics must never break the tap it measures */ }
    if (!reel) {
      setError("Couldn't rebuild the reel. Your first one is still saved.");
      return;
    }
    setSessionReel(reel);
    setReelEdit({ ...edit, picked: chosen.map((c) => c.seq) });
    void autoSaveReel(reel, "_edit");
    closeReelEditor(); // the player, still up, shows the new reel
  };

  return createPortal(
    <div className="reel-editor" role="dialog" aria-modal="true" aria-label="Pick your clips">
      <div className="reel-editor-head">
        <button
          type="button"
          className="reel-editor-cancel"
          onClick={() => closeReelViewer()}
          disabled={busy}
        >
          Cancel
        </button>
        <span className="reel-editor-title">Pick your clips</span>
        <span className="reel-editor-cancel" aria-hidden="true" />
      </div>

      <div className="reel-editor-preview">
        <video ref={previewRef} src={src} playsInline muted={false} />
        {focus && (
          <div className="reel-editor-focus">
            <span className="reel-editor-focus-text">
              {`Round ${focus.round + 1} · ${clipLabel(focus)} · ${secs(focus.toMs - focus.fromMs)}`}
            </span>
            <button
              type="button"
              className={`reel-editor-focus-toggle ${isIn(focus) ? "is-in" : ""}`}
              onClick={() => toggle(focus)}
              disabled={busy}
            >
              {isIn(focus) ? "Remove" : "Add to reel"}
            </button>
          </div>
        )}
      </div>

      <div className="reel-editor-list">
        {rounds.map(([round, clips]) => (
          <section key={round}>
            <h3 className="reel-editor-round">Round {round + 1}</h3>
            <div className="reel-editor-grid">
              {clips.map((c) => {
                const n = order.get(c.seq);
                return (
                  <div
                    key={c.seq}
                    className={`reel-editor-clip ${n ? "is-in" : ""} ${focus?.seq === c.seq ? "is-focus" : ""}`}
                  >
                    <button
                      type="button"
                      className="reel-editor-clip-thumb"
                      onClick={() => setFocus(c)}
                      aria-label={`Watch ${clipLabel(c)}`}
                    >
                      {thumbs[c.seq] ? <img src={thumbs[c.seq]} alt="" /> : <span className="reel-editor-clip-wait" />}
                      <span className="reel-editor-clip-len">{secs(c.toMs - c.fromMs)}</span>
                    </button>
                    <button
                      type="button"
                      className="reel-editor-clip-check"
                      onClick={() => toggle(c)}
                      disabled={busy}
                      aria-pressed={!!n}
                      aria-label={n ? `Remove ${clipLabel(c)}` : `Add ${clipLabel(c)}`}
                    >
                      {n ?? ""}
                    </button>
                    <span className="reel-editor-clip-text">{clipLabel(c)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="reel-editor-bar">
        {error && (
          <p className="reel-editor-error" role="alert">
            {error}
          </p>
        )}
        <div className="reel-editor-bar-row">
          <span className="reel-editor-count">
            {chosen.length} {chosen.length === 1 ? "clip" : "clips"} · {secs(totalMs)}
          </span>
          <button
            type="button"
            className="reel-viewer-share reel-editor-rebuild"
            onClick={rebuild}
            disabled={busy || !chosen.length || !changed}
          >
            {busy ? "Building…" : "Rebuild reel"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
