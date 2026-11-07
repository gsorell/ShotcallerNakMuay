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

  clip(seq: number, calls: CallInfo[], cut: ClipCut, score: number): void {
    const what = calls
      .map((c) => (c.between ? `+${c.text}` : c.text))
      .join(" ");
    this.lines.push(
      `clip ${seq}\t${score.toFixed(2)}\thits=${cut.hits}\tmotion=${cut.motion.toFixed(3)}\t` +
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
