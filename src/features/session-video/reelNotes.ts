import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";

import type { CallInfo } from "./calloutSignal";
import { mainCall } from "./highlights";
import type { ClipCut } from "./motion";

/**
 * Every clip's verdict from the last recorded session, saved as a small
 * text file in the app's private storage: what was called, how it was cut,
 * what it scored, and which made the reel.
 *
 * The picker can only be tuned against real sessions, and the app's console
 * doesn't reach the Android system log in these builds, so it is written
 * here instead. On a debug build it reads back with
 *   adb shell run-as com.shotcallernakmuay.app cat files/reel-notes.txt
 * Only the latest session is kept.
 */
export class ReelNotes {
  private lines: string[] = [];
  private readonly began = performance.now();

  /**
   * A step of the pipeline (what the phone offered, what failed), stamped
   * with seconds into the session. When no reel comes out, these lines are
   * what the completion screen shows: on iOS nothing else can be read.
   */
  log(line: string): void {
    const s = ((performance.now() - this.began) / 1000).toFixed(1);
    this.lines.push(`${s}s ${line}`);
    if (this.lines.length > 600) this.lines.splice(0, this.lines.length - 500);
  }

  /** The trace lines, without the per-clip verdicts. */
  trace(): string {
    return this.lines.filter((l) => /^\d+\.\ds /.test(l)).join("\n");
  }

  /** Clips judged so far, kept or not. */
  get judged(): number {
    return this.lines.filter((l) => l.startsWith("clip ")).length;
  }

  clip(
    seq: number,
    calls: CallInfo[],
    cut: ClipCut,
    score: number,
    heard = cut.hits
  ): void {
    const what = calls
      .map((c) => (c.between ? `+${c.text}` : c.text))
      .join(" ");
    this.lines.push(
      `clip ${seq}\t${score.toFixed(2)}\thits=${cut.hits}/${heard}\tmotion=${cut.motion.toFixed(3)}\t` +
        `${Math.round(cut.startMs)}-${Math.round(cut.endMs)}ms\t${what || mainCall(calls)?.text || "?"}`
    );
  }

  round(n: number, picked: number[]): void {
    this.lines.push(`round ${n} picked: ${picked.join(", ") || "none"}`);
  }

  async save(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Filesystem.writeFile({
        path: "reel-notes.txt",
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        data: `${new Date().toISOString()}\n${this.lines.join("\n")}\n`,
      });
    } catch {
      /* notes are for tuning; a session never fails over them */
    }
  }
}
