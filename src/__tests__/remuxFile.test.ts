import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ name: "android" }));
const native = vi.hoisted(() => ({ remuxToMp4: vi.fn() }));

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => platform.name },
  registerPlugin: () => native,
}));

import { remuxFileToMp4 } from "@/features/session-video/remux";

describe("remuxFileToMp4 (the full session, made scrubbable)", () => {
  beforeEach(() => {
    platform.name = "android";
    native.remuxToMp4.mockReset();
  });

  it("hands both files to the native remuxer and returns the new one", async () => {
    native.remuxToMp4.mockResolvedValue({ uri: "file:///cache/a_indexed.mp4" });
    await expect(
      remuxFileToMp4("file:///cache/a.mp4", "file:///cache/a_indexed.mp4")
    ).resolves.toBe("file:///cache/a_indexed.mp4");
    expect(native.remuxToMp4).toHaveBeenCalledWith({
      from: "file:///cache/a.mp4",
      to: "file:///cache/a_indexed.mp4",
    });
  });

  it("returns null when the remux fails, so the original is kept", async () => {
    native.remuxToMp4.mockRejectedValue(new Error("remux failed"));
    const log = vi.fn();
    await expect(remuxFileToMp4("a", "b", log)).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("left as recorded"));
  });

  it("does nothing off Android", async () => {
    platform.name = "ios";
    await expect(remuxFileToMp4("a", "b")).resolves.toBeNull();
    expect(native.remuxToMp4).not.toHaveBeenCalled();
  });
});
