import { describe, expect, it } from "vitest";

import { KeepSpans, roundTag } from "@/features/session-video/fullSession";
import {
  clearSessionReel,
  fullSessionText,
  getFullSession,
  patchFullSession,
  setFullSession,
} from "@/features/session-video/reelStore";

describe("KeepSpans", () => {
  it("keeps each stretch of work, from start to stop", () => {
    const k = new KeepSpans();
    k.open(5000);
    k.close(185000);
    k.open(245000);
    k.close(425000);
    expect(k.all(500000)).toEqual([
      { fromMs: 5000, toMs: 185000 },
      { fromMs: 245000, toMs: 425000 },
    ]);
  });

  it("ignores a second open or a close with nothing open", () => {
    const k = new KeepSpans();
    k.close(100);
    k.open(1000);
    k.open(2000);
    k.close(3000);
    k.close(4000);
    expect(k.all(5000)).toEqual([{ fromMs: 1000, toMs: 3000 }]);
  });

  it("closes a stretch still open when asked for everything", () => {
    const k = new KeepSpans();
    k.open(1000);
    expect(k.isOpen).toBe(true);
    expect(k.all(9000)).toEqual([{ fromMs: 1000, toMs: 9000 }]);
    expect(k.isOpen).toBe(false);
  });

  it("joins back-to-back stretches (the end card after the last round)", () => {
    const k = new KeepSpans();
    k.open(1000);
    k.close(60000);
    k.open(60000);
    k.close(62500);
    expect(k.all(70000)).toEqual([{ fromMs: 1000, toMs: 62500 }]);
  });

  it("drops a blip of a resume", () => {
    const k = new KeepSpans();
    k.open(1000);
    k.close(1100);
    expect(k.all(2000)).toEqual([]);
  });
});

describe("roundTag", () => {
  it("names the round being worked, or the next one during a rest", () => {
    expect(roundTag(0, 5)).toBe("ROUND 1 / 5");
    expect(roundTag(2, 5)).toBe("ROUND 3 / 5");
  });

  it("never counts past the last round", () => {
    expect(roundTag(5, 5)).toBe("ROUND 5 / 5");
  });
});

describe("the full session's line on the completion screen", () => {
  it("says it's saving, then where it went and how long it runs", () => {
    expect(fullSessionText({ status: "saving", durationMs: 0 }, "android")).toBe(
      "Saving your full session…"
    );
    expect(fullSessionText({ status: "saved", durationMs: 14.4 * 60000 }, "android")).toBe(
      "Full session · 14 min · saved to your gallery"
    );
    expect(fullSessionText({ status: "saved", durationMs: 50000 }, "ios")).toBe(
      "Full session · 1 min · saved to Photos"
    );
    expect(
      fullSessionText({ status: "saved", durationMs: 50000, silent: true }, "ios")
    ).toBe("Full session · 1 min · saved to Photos, without sound");
    expect(fullSessionText({ status: "failed", durationMs: 50000 }, "ios")).toBe(
      "Full session · couldn't save to Photos"
    );
  });

  it("ignores a late update from an earlier session's recording", () => {
    setFullSession({ id: "new", status: "saving", durationMs: 1000 });
    patchFullSession("old", "saved");
    expect(getFullSession()?.status).toBe("saving");
    patchFullSession("new", "saved");
    expect(getFullSession()?.status).toBe("saved");
    clearSessionReel();
    expect(getFullSession()).toBeNull();
  });
});
