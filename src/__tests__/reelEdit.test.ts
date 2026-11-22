import { describe, expect, it } from "vitest";

import { chosenClips, clipsMs } from "@/features/session-video/reelEdit";
import type { ReelCandidate } from "@/features/session-video/reelPlan";
import {
  closeReelViewer,
  openReelEditor,
  openReelViewer,
  setReelEdit,
  setSessionReel,
  showInReelViewer,
  setFullSession,
  type ReelEdit,
} from "@/features/session-video/reelStore";

const cand = (seq: number, round: number, fromMs: number): ReelCandidate => ({
  seq,
  round,
  fromMs,
  toMs: fromMs + 2000,
  calls: [],
  family: `f${seq}`,
  score: 1,
});

const edit = (): ReelEdit => ({
  source: "file:///cache/x_reelsrc.mp4",
  timeline: { calls: [], speech: [], hits: [], motion: [], work: [], roundEnds: [] },
  candidates: [cand(1, 0, 5000), cand(2, 0, 9000), cand(3, 1, 80000)],
  picked: [1, 3],
});

describe("the clips someone picks", () => {
  it("go in filmed order, whatever order they were ticked in", () => {
    expect(chosenClips(edit(), [3, 1, 2]).map((c) => c.seq)).toEqual([1, 2, 3]);
  });

  it("ignore anything that isn't on offer, and add up their length", () => {
    const clips = chosenClips(edit(), [2, 99]);
    expect(clips.map((c) => c.seq)).toEqual([2]);
    expect(clipsMs(clips)).toBe(2000);
  });
});

describe("the player", () => {
  const reel = () => ({ blob: new Blob(["x"]), url: "blob:r", ext: "mp4", durationMs: 1000, clips: 2 });

  it("switches between the reel and the full session, and the back button shuts the picker first", () => {
    setSessionReel(reel());
    setFullSession({ id: "a", status: "saving", durationMs: 60000 });
    setReelEdit({ ...edit(), source: "memory://nowhere" });
    openReelViewer("reel");
    openReelEditor();
    expect(closeReelViewer()).toBe(true); // the picker
    showInReelViewer("full");
    expect(closeReelViewer()).toBe(true); // the player
    expect(closeReelViewer()).toBe(false);
    setReelEdit(null);
    setSessionReel(null);
  });
});
