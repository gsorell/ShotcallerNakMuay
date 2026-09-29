import { useCallback, useEffect, useRef, useState } from "react";

import { useEntitlement } from "@/features/entitlement";
import { usePaywall } from "@/features/paywall";
import { captureElementAsBlob } from "@/utils/imageUtils";
import type { TechniqueShape } from "@/utils/techniqueUtils";
import ShareNameSheet from "./ShareNameSheet";
import StyleShareCard from "./StyleShareCard";
import { STYLE_CARD_BRAND, STYLE_CARD_WIDTH } from "./styleCardTheme";
import { onShareRequest } from "./shareInbox";
import { shareStyle } from "./shareStyle";
import {
  ensureSenderName,
  hasConfirmedSenderName,
  markSenderNameConfirmed,
  setSenderName,
} from "./shareStorage";

type PendingCard = { group: TechniqueShape; name: string };

/**
 * The one place a style actually gets shared.
 *
 * Mounted once, at the app root, and driven by `requestShareStyle` from
 * wherever the user tapped — the editor's ↗ or a tile's quick-edit on the home
 * screen. Keeping the Pro gate, the first-share name confirmation and the card
 * capture here means no button re-implements them, and none can drift.
 */
export default function ShareStyleFlow() {
  const { isPro } = useEntitlement();
  const { openPaywall } = usePaywall();
  const [pending, setPending] = useState<TechniqueShape | null>(null);
  const [assignedName, setAssignedName] = useState("");
  const [card, setCard] = useState<PendingCard | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  /** Render the card offscreen, then share it. */
  const beginShare = useCallback((group: TechniqueShape, name: string) => {
    setCard({ group, name });
  }, []);

  useEffect(() => {
    if (!card) return;
    let cancelled = false;

    (async () => {
      let blob: Blob | null = null;
      try {
        // Two frames: one for React to commit the card, one for layout to
        // settle before html2canvas measures it. Without this the capture can
        // come back at the wrong size or empty.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
        // The logo is the only image on the card; html2canvas reads a clone,
        // so it has to already be decoded.
        await Promise.all(
          Array.from(cardRef.current?.querySelectorAll("img") ?? []).map((img) =>
            img.complete ? Promise.resolve() : img.decode().catch(() => {})
          )
        );
        if (cardRef.current && !cancelled) {
          blob = await captureElementAsBlob(cardRef.current, {
            backgroundColor: STYLE_CARD_BRAND.bg,
          });
        }
      } catch {
        // A card is a nicety; the link is the payload. Share without it.
        blob = null;
      }

      if (cancelled) return;
      const outcome = await shareStyle(card.group, card.name, blob);
      if (!cancelled) setCard(null);

      if (outcome.status === "copied") {
        alert("Share sheet unavailable, so the link is on your clipboard.");
      } else if (outcome.status === "failed") {
        alert("Couldn't share that style. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [card]);

  useEffect(
    () =>
      onShareRequest((group) => {
        if (!isPro) {
          openPaywall("style_share");
          return;
        }
        // An assigned name gets one look before it goes out on someone's
        // style; a chosen one shares straight away.
        if (!hasConfirmedSenderName()) {
          setAssignedName(ensureSenderName());
          setPending(group);
          return;
        }
        beginShare(group, ensureSenderName());
      }),
    [isPro, openPaywall, beginShare]
  );

  return (
    <>
      {pending && (
        <ShareNameSheet
          initialName={assignedName}
          mode="confirm"
          onCancel={() => setPending(null)}
          onConfirm={(name) => {
            setSenderName(name);
            markSenderNameConfirmed();
            const group = pending;
            setPending(null);
            beginShare(group, name);
          }}
        />
      )}

      {/* The card, parked offscreen while it is captured.

          A left offset rather than `display: none` or `visibility: hidden`: a
          hidden node has no layout for html2canvas to measure, and both
          properties survive into its clone, so the capture comes back blank.
          Rendering it in place would also flash a poster over the app for a
          frame before the share sheet covers it. */}
      {card && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: -10000,
            width: STYLE_CARD_WIDTH,
            pointerEvents: "none",
          }}
        >
          <div
            ref={cardRef}
            style={{
              width: STYLE_CARD_WIDTH,
              background: STYLE_CARD_BRAND.bg,
              color: STYLE_CARD_BRAND.heading,
            }}
          >
            <StyleShareCard group={card.group} senderName={card.name} />
          </div>
        </div>
      )}
    </>
  );
}
