import { useState } from "react";

import { trackEvent } from "@/utils/analytics";
import { useSessionReel } from "./reelStore";
import { shareReel } from "./shareReel";
import "./SessionReelCard.css";

/**
 * The session's reel at the top of the completion screen: it plays on its
 * own, muted and looping, with one button to share or save it.
 */
export default function SessionReelCard() {
  const reel = useSessionReel();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!reel) return null;

  const onShare = async () => {
    setBusy(true);
    setFailed(false);
    const outcome = await shareReel(reel);
    setBusy(false);
    if (outcome === "failed") setFailed(true);
    try {
      trackEvent("session_reel_share", { outcome, format: reel.ext });
    } catch { /* analytics must never break the tap it measures */ }
  };

  return (
    <section className="session-reel" aria-label="Your session reel">
      <video
        className="session-reel-video"
        src={reel.url}
        autoPlay
        muted
        loop
        playsInline
        controls
      />
      <button
        type="button"
        className="session-reel-share"
        onClick={onShare}
        disabled={busy}
      >
        {busy ? "Preparing…" : "Share or save your reel"}
      </button>
      {failed && (
        <p className="session-reel-error" role="alert">
          Couldn't open sharing. Try again in a moment.
        </p>
      )}
    </section>
  );
}
