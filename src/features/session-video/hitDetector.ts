/**
 * Listens for strikes landing: the crack of a pad, a bag, a glove.
 *
 * Movement alone couldn't tell a four-strike combination from a check — a
 * raised leg near the lens changes more pixels than a crisp jab–cross across
 * the room. A strike that lands makes a sound nothing else in a session
 * does: a broadband crack that goes from nothing to loud in a few
 * milliseconds. Speech, including the app's own callouts, rises over tens of
 * milliseconds and sits lower in pitch. So the detector works on the
 * signal's first difference (which favours high frequencies) in 5ms frames,
 * and counts a hit when a frame jumps far above the 50ms before it.
 *
 * It runs in an AudioWorklet, off the main thread. Shadowboxing makes no
 * hits; the reel falls back to movement then.
 */

const WORKLET = `
class HitWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = 256;
    this.buf = 0; this.n = 0; this.prev = 0;
    this.hist = new Float32Array(10); this.h = 0; this.filled = 0;
    this.quietUntil = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const d = ch[i] - this.prev; this.prev = ch[i];
      this.buf += d * d; this.n++;
      if (this.n < this.frame) continue;
      const e = this.buf / this.n; this.buf = 0; this.n = 0;
      let mean = 0;
      for (let k = 0; k < this.hist.length; k++) mean += this.hist[k];
      mean /= this.hist.length;
      const t = currentTime + i / sampleRate;
      if (this.filled >= this.hist.length && t >= this.quietUntil &&
          e > 1e-6 && e > mean * 12) {
        this.port.postMessage({ t, e });
        this.quietUntil = t + 0.12;
      }
      this.hist[this.h] = e; this.h = (this.h + 1) % this.hist.length;
      if (this.filled < this.hist.length) this.filled++;
    }
    return true;
  }
}
registerProcessor("shotcaller-hits", HitWorklet);
`;

export class HitDetector {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  /** performance.now() of each hit heard. */
  private hits: number[] = [];

  /** Starts listening to the stream's audio. Resolves false if it can't. */
  async start(stream: MediaStream): Promise<boolean> {
    if (!stream.getAudioTracks().length) return false;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      // "playback": the default low-latency output fights the phone's
      // Bluetooth mixer (it crackled a Bluetooth speaker), and listening
      // doesn't need low latency; hit times are corrected for the lag.
      const ctx = new Ctx({ latencyHint: "playback" });
      this.ctx = ctx;
      const url = URL.createObjectURL(
        new Blob([WORKLET], { type: "application/javascript" })
      );
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      this.source = ctx.createMediaStreamSource(stream);
      this.node = new AudioWorkletNode(ctx, "shotcaller-hits");
      // AudioContext time → performance.now(), measured when each hit lands.
      this.node.port.onmessage = (ev: MessageEvent<{ t: number }>) => {
        const lagS = Math.max(0, ctx.currentTime - ev.data.t);
        this.hits.push(performance.now() - lagS * 1000);
        if (this.hits.length > 5000) this.hits = this.hits.slice(-2500);
      };
      this.source.connect(this.node);
      // Never connected to the speakers: listening only.
      await ctx.resume().catch(() => undefined);
      return true;
    } catch (e) {
      console.warn("Hit detection unavailable:", e);
      this.stop();
      return false;
    }
  }

  /** Hits between two moments (performance.now()), oldest first. */
  between(from: number, to: number): number[] {
    return this.hits.filter((t) => t >= from && t <= to);
  }

  stop(): void {
    try {
      this.source?.disconnect();
      this.node?.disconnect();
      void this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.source = null;
    this.node = null;
    this.ctx = null;
  }
}
