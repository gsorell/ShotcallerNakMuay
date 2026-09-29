import { normalizeArray, type TechniqueShape } from "@/utils/techniqueUtils";
import { STYLE_CARD_BRAND as BRAND } from "./styleCardTheme";

const countLabel = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * The image that travels with a shared style.
 *
 * It exists because the link alone is a wall of base64 — the recipient sees
 * seven lines of gibberish and has to take it on faith. The card is what makes
 * the message legible at a glance: who sent it, what it is, and how big.
 *
 * Deliberately a summary and not a listing. An earlier version printed a
 * handful of techniques, which invited reading the card as the style's
 * contents — it never could be, at 3 techniques or 300, and the app's own
 * numeric shorthand ("1 2") is unreadable to anyone deciding whether to tap.
 * The counts say how big it is; the link delivers what is in it.
 *
 * The domain is printed in the pixels on purpose. Facebook and Instagram drop
 * a share's caption entirely (verified on device, 2026-09-24), and the caption
 * is where the import link lives — so on those surfaces the card is all that
 * arrives, and it has to at least say where the app is. The style itself
 * cannot travel without the link, which is why this is a messaging feature.
 */
export default function StyleShareCard({
  group,
  senderName,
}: {
  group: TechniqueShape;
  senderName: string;
}) {
  const singles = normalizeArray(group.singles);
  const combos = normalizeArray(group.combos);
  const title = group.title ?? group.label ?? "A style";

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ padding: "36px 28px 28px" }}>
        <div
          style={{
            fontSize: "0.8rem",
            color: BRAND.muted,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            marginBottom: 22,
          }}
        >
          {senderName ? `${senderName} shares` : "A shared style"}
        </div>

        <div
          style={{
            fontSize: "2.6rem",
            fontWeight: 800,
            lineHeight: 1.05,
            color: BRAND.heading,
            marginBottom: 12,
            // A user picks this name; a long one must wrap rather than clip.
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>

        {group.description && (
          <div
            style={{
              fontSize: "0.95rem",
              color: BRAND.muted,
              lineHeight: 1.4,
              marginBottom: 18,
              overflowWrap: "anywhere",
            }}
          >
            {group.description}
          </div>
        )}

        <div
          style={{
            fontSize: "1.05rem",
            fontWeight: 700,
            color: BRAND.accent,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          {countLabel(singles.length, "technique", "techniques")} &middot;{" "}
          {countLabel(combos.length, "combo", "combos")}
        </div>
      </div>

      {/* Full bleed, because the export node has no corner radius to fight. */}
      <div
        style={{
          background: BRAND.ramp,
          color: BRAND.bg,
          padding: "18px 16px",
        }}
      >
        <div
          style={{
            fontSize: "1.45rem",
            fontWeight: 800,
            letterSpacing: "0.04em",
            lineHeight: 1.1,
          }}
        >
          Train it with me.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "14px 0 18px",
        }}
      >
        <img
          src="/assets/logo_mark.webp"
          alt=""
          style={{ width: 24, height: 24 }}
        />
        <span
          style={{ fontSize: "0.72rem", color: BRAND.muted, fontWeight: 500 }}
        >
          shotcallernakmuay.netlify.app
        </span>
      </div>
    </div>
  );
}
