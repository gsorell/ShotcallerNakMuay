import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { useEffect, useRef } from "react";

export type CallState = "ringing" | "inCall" | "idle";

interface CallWatchPlugin {
  startCallWatch(): Promise<void>;
  stopCallWatch(): Promise<void>;
  addListener(
    event: "callState",
    cb: (e: { state: CallState }) => void
  ): Promise<PluginListenerHandle>;
}

// The same native plugin as the audio focus calls (AudioSessionPlugin.java).
const AudioSession = registerPlugin<CallWatchPlugin>("AudioSession");

/**
 * Phone calls as they happen, on Android: told when one starts ringing,
 * is answered, and is over. Seen through the phone's audio mode, so no
 * permission is asked for. Elsewhere it never fires; the visibility check
 * in usePhoneCallDetection still pauses a session the call takes over.
 *
 * Watches only while `enabled` (a session is under way).
 */
export const useRingingCall = (
  enabled: boolean,
  onChange: (state: CallState) => void
): void => {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || Capacitor.getPlatform() !== "android") return;
    let handle: PluginListenerHandle | null = null;
    let stopped = false;
    void (async () => {
      try {
        const h = await AudioSession.addListener("callState", (e) =>
          cb.current(e.state)
        );
        if (stopped) {
          void h.remove();
          return;
        }
        handle = h;
        await AudioSession.startCallWatch();
      } catch (e) {
        console.warn("Call watch unavailable:", e);
      }
    })();
    return () => {
      stopped = true;
      void handle?.remove();
      void AudioSession.stopCallWatch().catch(() => undefined);
    };
  }, [enabled]);
};
