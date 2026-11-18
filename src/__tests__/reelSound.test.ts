import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ name: "ios" }));
const native = vi.hoisted(() => ({ laySound: vi.fn(), remuxToMp4: vi.fn() }));
const fs = vi.hoisted(() => ({
  writeFile: vi.fn(async () => ({ uri: "file:///cache/reel-silent.mp4" })),
  appendFile: vi.fn(),
  getUri: vi.fn(async () => ({ uri: "file:///cache/reel-silent-sound.mp4" })),
  deleteFile: vi.fn(async () => undefined),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => platform.name,
    convertFileSrc: (u: string) => u.replace("file://", "capacitor://localhost/_capacitor_file_"),
  },
  registerPlugin: () => native,
}));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Filesystem: fs,
}));

vi.mock("@/features/session-video/reelFile", () => ({
  writeBlobInPieces: vi.fn(async () => "file:///cache/reel-silent.mp4"),
}));

import { laySoundUnderReel } from "@/features/session-video/remux";

describe("laySoundUnderReel (iOS: the session's sound under a silent reel)", () => {
  beforeEach(() => {
    platform.name = "ios";
    native.laySound.mockReset();
    fs.deleteFile.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ blob: async () => new Blob(["with sound"]) }))
    );
  });

  const parts = [{ durMs: 2500, soundFromMs: 12000 }, { durMs: 2500 }];

  it("hands the reel, the sound and the parts over, and reads the result back", async () => {
    native.laySound.mockResolvedValue({ uri: "file:///cache/out.mp4", summary: "1 of 2 parts" });
    const log = vi.fn();
    const out = await laySoundUnderReel(new Blob(["silent"]), "file:///tmp/a.m4a", parts, log);
    expect(log.mock.calls.flat().join("\n")).toContain("reel sound laid");
    expect(out?.type).toBe("video/mp4");
    expect(native.laySound).toHaveBeenCalledWith(
      expect.objectContaining({ sound: "file:///tmp/a.m4a", parts })
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("reel sound laid"));
    expect(fs.deleteFile).toHaveBeenCalledTimes(2);
  });

  it("keeps the reel silent, rather than losing it, when laying fails", async () => {
    native.laySound.mockRejectedValue(new Error("lay sound: AVFoundationErrorDomain -11800"));
    const log = vi.fn();
    await expect(laySoundUnderReel(new Blob(["silent"]), "s", parts, log)).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("reel left silent"));
  });

  it("does nothing off iOS", async () => {
    platform.name = "android";
    await expect(laySoundUnderReel(new Blob(["x"]), "s", parts)).resolves.toBeNull();
    expect(native.laySound).not.toHaveBeenCalled();
  });
});
