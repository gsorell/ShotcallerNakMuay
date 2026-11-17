import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ name: "ios" }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => platform.name },
}));

import { allowRecordingAudio } from "@/features/session-video/micChoice";

type Nav = { audioSession?: { type: string } };

describe("allowRecordingAudio (iOS: the page's audio session can record)", () => {
  beforeEach(() => {
    platform.name = "ios";
    (navigator as unknown as Nav).audioSession = { type: "playback" };
  });
  afterEach(() => {
    delete (navigator as unknown as Nav).audioSession;
  });

  it("records while filming, then goes back to playback", () => {
    const restore = allowRecordingAudio();
    expect((navigator as unknown as Nav).audioSession?.type).toBe("play-and-record");
    restore();
    expect((navigator as unknown as Nav).audioSession?.type).toBe("playback");
  });

  it("puts back whatever it was, once only", () => {
    (navigator as unknown as Nav).audioSession = { type: "auto" };
    const restore = allowRecordingAudio();
    restore();
    expect((navigator as unknown as Nav).audioSession?.type).toBe("auto");
    (navigator as unknown as Nav).audioSession!.type = "playback";
    restore();
    expect((navigator as unknown as Nav).audioSession?.type).toBe("playback");
  });

  it("leaves Android alone", () => {
    platform.name = "android";
    allowRecordingAudio();
    expect((navigator as unknown as Nav).audioSession?.type).toBe("playback");
  });

  it("does nothing where there is no audio session (before iOS 16.4)", () => {
    delete (navigator as unknown as Nav).audioSession;
    const log = vi.fn();
    expect(() => allowRecordingAudio(log)()).not.toThrow();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("none"));
  });
});
