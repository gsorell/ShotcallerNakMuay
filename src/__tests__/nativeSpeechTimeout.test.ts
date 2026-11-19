import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => {
  // What the speech service reads of the page as it's built.
  const g = globalThis as Record<string, unknown>;
  g.document ??= { visibilityState: "visible", hidden: false, addEventListener: () => {} };
  g.window ??= globalThis;
  if (!("userAgent" in ((g.navigator as object) ?? {}))) {
    Object.defineProperty(globalThis, "navigator", { value: { userAgent: "test" }, configurable: true });
  }
  return { name: "ios" };
});
const tts = vi.hoisted(() => ({
  speak: vi.fn(),
  stop: vi.fn(async () => undefined),
  getSupportedVoices: vi.fn(async () => ({ voices: [] })),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => platform.name,
    isNativePlatform: () => platform.name !== "web",
  },
  registerPlugin: () => ({}),
}));
vi.mock("@capacitor-community/text-to-speech", () => ({ TextToSpeech: tts }));

import TTSService, { NATIVE_SPEAK_TIMEOUT_MS } from "@/utils/ttsService";
import { fullSessionWanted } from "@/features/session-video/fullSession";
import { reelWanted } from "@/features/session-video/recordPreference";

describe("native speech that never finishes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tts.speak.mockReset();
    tts.stop.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("is given up on, so the calls after it are still said", async () => {
    // The first phrase hangs (iOS, second session after a launch); the next answers.
    tts.speak.mockImplementationOnce(() => new Promise(() => {}));
    tts.speak.mockImplementation(async () => undefined);
    const service = new TTSService();
    const onError = vi.fn();
    const onDone = vi.fn();

    const first = service.speak("Jab", { onError });
    const second = service.speak("Cross", { onDone });
    await vi.advanceTimersByTimeAsync(NATIVE_SPEAK_TIMEOUT_MS + 1000);
    await first;
    await second;

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(tts.stop).toHaveBeenCalled();
    expect(tts.speak).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("iPhone: a reel, cut natively after the session", () => {
  it("cuts a reel on iOS, the full session kept as the setting says", () => {
    platform.name = "ios";
    expect(reelWanted()).toBe(true);
    // On by default: kept beside the reel unless turned off.
    expect(fullSessionWanted()).toBe(true);
  });

  it("still cuts a reel on Android", () => {
    platform.name = "android";
    expect(reelWanted()).toBe(true);
  });
});
