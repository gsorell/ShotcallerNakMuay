import { afterEach, describe, expect, it, vi } from "vitest";

import { openBuiltInMic } from "@/features/session-video/micChoice";
import { reelCandidates } from "@/features/session-video/reelPlan";
import { keepsReel } from "@/features/session-video/reelRecorder";

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

const track = (label: string) => ({ label, stop: vi.fn() });
const stream = (label: string) => {
  const t = track(label);
  return { getAudioTracks: () => [t], getTracks: () => [t], t };
};

const devices = (labels: string[]) =>
  labels.map((label, i) => ({ kind: "audioinput", label, deviceId: `id${i}` }));

const mockMedia = (
  listed: () => ReturnType<typeof devices>,
  open: (c: MediaStreamConstraints) => unknown
) => {
  const getUserMedia = vi.fn(async (c: MediaStreamConstraints) => open(c));
  vi.stubGlobal("navigator", {
    mediaDevices: { enumerateDevices: vi.fn(async () => listed()), getUserMedia },
  });
  return getUserMedia;
};

const askedFor = (c: MediaStreamConstraints) =>
  ((c.audio as MediaTrackConstraints).deviceId as { exact?: string } | undefined)
    ?.exact;

afterEach(() => vi.unstubAllGlobals());

describe("the session's microphone", () => {
  it("asks for the phone's own mic by id when a Bluetooth headset is listed", async () => {
    const gum = mockMedia(
      () => devices(["", "Speakerphone", "Headset earpiece", "Bluetooth headset"]),
      () => stream("Speakerphone")
    );
    await openBuiltInMic();
    expect(gum).toHaveBeenCalledTimes(1);
    expect(askedFor(gum.mock.calls[0]![0])).toBe("id1");
  });

  it("reopens by id when labels were hidden and the default was the headset", async () => {
    let granted = false;
    const first = stream("Bluetooth headset");
    const gum = mockMedia(
      () => devices(granted ? ["Speakerphone", "Bluetooth headset"] : ["", ""]),
      (c) => {
        if (!askedFor(c)) {
          granted = true;
          return first;
        }
        return stream("Speakerphone");
      }
    );
    await openBuiltInMic();
    expect(gum).toHaveBeenCalledTimes(2);
    expect(first.t.stop).toHaveBeenCalled();
    expect(askedFor(gum.mock.calls[1]![0])).toBe("id0");
  });

  it("keeps the callouts and the cracks: no echo cancelling or noise suppression", async () => {
    const gum = mockMedia(() => devices(["Speakerphone"]), () => stream("Speakerphone"));
    await openBuiltInMic();
    const audio = gum.mock.calls[0]![0].audio as MediaTrackConstraints;
    expect(audio.echoCancellation).toBe(false);
    expect(audio.noiseSuppression).toBe(false);
    // On: with every kind of processing off, Android crackles a Bluetooth speaker.
    expect(audio.autoGainControl).toBe(true);
  });

  it("films silent rather than failing when the mic is refused", async () => {
    mockMedia(
      () => devices(["Speakerphone"]),
      () => {
        throw new Error("NotAllowedError");
      }
    );
    expect(await openBuiltInMic()).toBeNull();
  });
});

describe("the first request after a launch", () => {
  it("goes straight to the remembered phone mic, never the default", async () => {
    vi.stubGlobal("localStorage", memory());
    // A session last launch, when the labels could be read: remembered.
    mockMedia(() => devices(["Speakerphone", "Bluetooth headset"]), () => stream("Speakerphone"));
    await openBuiltInMic();
    // This launch: labels hidden until a mic has been opened.
    const gum = mockMedia(() => devices(["", ""]), () => stream("Speakerphone"));
    await openBuiltInMic();
    expect(gum).toHaveBeenCalledTimes(1);
    expect(askedFor(gum.mock.calls[0]![0])).toBe("id0");
  });

  it("finds it again if the remembered id now opens something else", async () => {
    vi.stubGlobal("localStorage", memory());
    localStorage.setItem("shotcaller_builtin_mic", "stale");
    let granted = false;
    const gum = mockMedia(
      () => devices(granted ? ["Speakerphone", "Bluetooth headset"] : ["", ""]),
      (c) => {
        granted = true;
        return stream(askedFor(c) === "id0" ? "Speakerphone" : "Bluetooth headset");
      }
    );
    await openBuiltInMic();
    expect(askedFor(gum.mock.calls.at(-1)![0])).toBe("id0");
    expect(localStorage.getItem("shotcaller_builtin_mic")).toBe("id0");
  });
});

describe("a clip with sound but no movement", () => {
  it("is no clip: a bell heard as hits doesn't make one", () => {
    const motion = [];
    for (let at = 0; at <= 60000; at += 100) motion.push({ at, m: 0.005 + (at % 700 === 0 ? 0.001 : 0) });
    const cands = reelCandidates({
      calls: [{ t: 30000, text: "Jab, Cross", between: false, combo: true }],
      speech: [],
      hits: [30400, 30520, 30700],
      motion,
      work: [{ fromMs: 0, toMs: 60000 }],
      roundEnds: [60000],
    });
    expect(cands).toHaveLength(0);
  });
});

describe("whether a session ended with a reel", () => {
  const round = 180_000;
  it("drops a session stopped a minute in", () => {
    expect(keepsReel(60_000, round)).toBe(false);
  });
  it("keeps one with a round's work, callouts starting a moment in", () => {
    expect(keepsReel(round - 4000, round)).toBe(true);
  });
  it("works for short rounds", () => {
    expect(keepsReel(26_000, 30_000)).toBe(true);
    expect(keepsReel(10_000, 30_000)).toBe(false);
  });
});
