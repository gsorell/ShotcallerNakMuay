import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ name: "ios" }));
const native = vi.hoisted(() => ({
  allowRecording: vi.fn(),
  release: vi.fn(),
  status: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => platform.name },
  registerPlugin: () => native,
}));

import {
  allowRecordingAudio,
  allowRecordingNatively,
  logAudioSession,
  releaseRecordingNatively,
} from "@/features/session-video/micChoice";

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

describe("the app's audio session while filming (iOS, RecordingAudioPlugin)", () => {
  beforeEach(() => {
    platform.name = "ios";
    Object.values(native).forEach((f) => f.mockReset());
  });

  it("is set to record once the microphone is open, and released after", async () => {
    native.allowRecording.mockResolvedValue({ status: "PlayAndRecord/Default [mix,speaker]" });
    native.release.mockResolvedValue({ status: "Playback/Default [mix]" });
    const log = vi.fn();
    await allowRecordingNatively(log);
    await releaseRecordingNatively(log);
    expect(log).toHaveBeenCalledWith("native audio: PlayAndRecord/Default [mix,speaker]");
    expect(log).toHaveBeenCalledWith("native audio released: Playback/Default [mix]");
  });

  it("logs what happened to the session, for the trace", async () => {
    native.status.mockResolvedValue({ status: "now", events: ["3s route change 3"] });
    const log = vi.fn();
    await logAudioSession(log, "after 8s");
    expect(log.mock.calls.map((c) => c[0])).toEqual(["audio: 3s route change 3", "audio after 8s: now"]);
  });

  it("never throws if the plugin is missing", async () => {
    native.allowRecording.mockRejectedValue(new Error("not implemented"));
    const log = vi.fn();
    await expect(allowRecordingNatively(log)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("could not be set"));
  });

  it("does nothing off iOS", async () => {
    platform.name = "android";
    await allowRecordingNatively(() => {});
    await logAudioSession(() => {}, "x");
    expect(native.allowRecording).not.toHaveBeenCalled();
    expect(native.status).not.toHaveBeenCalled();
  });
});
