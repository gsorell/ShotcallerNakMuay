import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ name: "ios" }));
const native = vi.hoisted(() => ({
  requestMicrophone: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  status: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => platform.name },
  registerPlugin: () => native,
}));

import {
  logAudioSession,
  recordsSoundNatively,
  requestNativeMicrophone,
  startNativeSound,
  stopNativeSound,
} from "@/features/session-video/micChoice";

describe("the full session's sound on iOS (RecordingAudioPlugin)", () => {
  beforeEach(() => {
    platform.name = "ios";
    Object.values(native).forEach((f) => f.mockReset());
  });

  it("is recorded natively on iOS only", () => {
    expect(recordsSoundNatively()).toBe(true);
    platform.name = "android";
    expect(recordsSoundNatively()).toBe(false);
  });

  it("starts, says when, and stops with the file", async () => {
    native.startRecording.mockResolvedValue({ startedAtMs: 1234, status: "PlayAndRecord" });
    native.stopRecording.mockResolvedValue({ uri: "file:///tmp/a.m4a", durationMs: 30000 });
    const log = vi.fn();
    await expect(startNativeSound(log)).resolves.toBe(1234);
    await expect(stopNativeSound(log)).resolves.toBe("file:///tmp/a.m4a");
    expect(log).toHaveBeenCalledWith("native sound stopped: 30s");
  });

  it("films silent rather than failing when the recorder won't start", async () => {
    native.startRecording.mockRejectedValue(new Error("microphone not granted"));
    const log = vi.fn();
    await expect(startNativeSound(log)).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("not recorded"));
  });

  it("asks for the microphone natively, false if it can't", async () => {
    native.requestMicrophone.mockResolvedValue({ granted: true });
    await expect(requestNativeMicrophone()).resolves.toBe(true);
    native.requestMicrophone.mockRejectedValue(new Error("no plugin"));
    await expect(requestNativeMicrophone()).resolves.toBe(false);
  });

  it("logs what happened to the session, for the trace", async () => {
    native.status.mockResolvedValue({ status: "now", events: ["3s route change 3"] });
    const log = vi.fn();
    await logAudioSession(log, "after 8s");
    expect(log.mock.calls.map((c) => c[0])).toEqual(["audio: 3s route change 3", "audio after 8s: now"]);
  });

  it("does nothing off iOS", async () => {
    platform.name = "android";
    await expect(startNativeSound(() => {})).resolves.toBeNull();
    await expect(stopNativeSound(() => {})).resolves.toBeUndefined();
    expect(native.startRecording).not.toHaveBeenCalled();
    expect(native.stopRecording).not.toHaveBeenCalled();
  });
});
