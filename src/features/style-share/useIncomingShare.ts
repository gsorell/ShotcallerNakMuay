import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useRef, useState } from "react";

import { trackEvent } from "@/utils/analytics";
import {
  type ShareFailure,
  type SharedStyle,
  ShareLinkError,
  decodeStyleCode,
  extractShareCode,
} from "@/utils/styleShare";
import { onShareCode } from "./shareInbox";

export type IncomingShare =
  | { kind: "style"; style: SharedStyle }
  | { kind: "error"; failure: ShareFailure };

/**
 * Catch a shared style arriving from outside the app.
 *
 * Three doors, and all three are needed:
 *
 *  - **Native, app already running.** Capacitor's `appUrlOpen` fires from
 *    `onNewIntent` (Android, `launchMode="singleTask"`) or
 *    `continue userActivity` (iOS, already wired in AppDelegate).
 *  - **Native, cold start.** The listener is attached too late to see the URL
 *    that launched the app, so `getLaunchUrl` is read once on mount. This is
 *    the common case — tapping a link from a text message with the app closed
 *    — and it is exactly the one an `appUrlOpen`-only implementation misses.
 *  - **Web.** The fragment on the current URL, plus `hashchange` for a second
 *    link followed without a reload.
 *
 * Cold start can deliver the same URL through both native doors, so codes are
 * deduplicated by value rather than by which door they came through.
 */
export function useIncomingShare() {
  const [incoming, setIncoming] = useState<IncomingShare | null>(null);
  const seenCode = useRef<string | null>(null);

  const consume = useCallback(
    async (rawUrl: string | null | undefined, force = false) => {
      if (!rawUrl) return;
      const code = extractShareCode(rawUrl);
      if (!code) return;
      // A pasted code is an explicit request, so it reopens even after the
      // same link was dismissed once. Links arriving on their own do not.
      if (!force && seenCode.current === code) return;
      seenCode.current = code;

      const platform = Capacitor.getPlatform();
      try {
        const style = await decodeStyleCode(code);
        trackEvent("style_link_opened", {
          platform,
          outcome: "decoded",
          singles: style.singles.length,
          combos: style.combos.length,
        });
        setIncoming({ kind: "style", style });
      } catch (error) {
        const failure: ShareFailure =
          error instanceof ShareLinkError ? error.code : "malformed";
        trackEvent("style_link_opened", { platform, outcome: failure });
        setIncoming({ kind: "error", failure });
      }
    },
    []
  );

  // Codes pasted into the editor land here too, so there is one confirmation
  // sheet rather than two implementations of the same decision.
  useEffect(() => onShareCode((raw) => void consume(raw, true)), [consume]);

  useEffect(() => {
    let cancelled = false;
    let removeListener: (() => void) | null = null;

    const clearWebFragment = () => {
      // Otherwise a reload re-prompts for a style they already decided on.
      try {
        if (window.location.hash.includes("p=")) {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );
        }
      } catch {
        /* non-fatal: the dedupe ref still stops a repeat within the session */
      }
    };

    const start = async () => {
      if (Capacitor.isNativePlatform()) {
        const handle = await App.addListener("appUrlOpen", (event) => {
          void consume(event.url);
        });
        if (cancelled) {
          void handle.remove();
          return;
        }
        removeListener = () => void handle.remove();

        try {
          const launch = await App.getLaunchUrl();
          if (!cancelled) void consume(launch?.url);
        } catch {
          /* no launch URL is the normal case */
        }
        return;
      }

      void consume(window.location.href);
      clearWebFragment();

      const onHashChange = () => {
        void consume(window.location.href);
        clearWebFragment();
      };
      window.addEventListener("hashchange", onHashChange);
      removeListener = () =>
        window.removeEventListener("hashchange", onHashChange);
    };

    void start();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [consume]);

  /**
   * Drop the pending share without importing it.
   *
   * The code stays in `seenCode`, so dismissing is final for this session —
   * re-opening the same link will not nag. A fresh link still prompts.
   */
  const dismiss = useCallback(() => setIncoming(null), []);

  return { incoming, dismiss };
}
