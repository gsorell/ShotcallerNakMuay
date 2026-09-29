import { FREE_IMPORT_LIMIT } from "@/constants/storage";
import { techniqueText } from "@/constants/techniques";
import type { SharedStyle } from "@/utils/styleShare";
import { shareFailureMessage } from "@/utils/styleShare";
import type { IncomingShare } from "./useIncomingShare";
import { importAllowance } from "./shareStorage";
import "@/styles/modal.css";

const PREVIEW_SINGLES = 6;
const PREVIEW_COMBOS = 4;

type ImportStyleModalProps = {
  incoming: IncomingShare | null;
  isPro: boolean;
  onImport: (style: SharedStyle) => void;
  onUnlockPro: () => void;
  onDismiss: () => void;
};

const countLabel = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * The confirmation a shared style has to pass before it touches storage.
 *
 * This is the first thing the recipient sees after tapping a link in a
 * message: the app opens straight to it. Nothing is written until they say
 * yes, and the preview is here so "yes" is an informed answer rather than a
 * guess about what a stranger's link contains.
 */
export default function ImportStyleModal({
  incoming,
  isPro,
  onImport,
  onUnlockPro,
  onDismiss,
}: ImportStyleModalProps) {
  // Read during render rather than memoised: it reads localStorage, so a stale
  // memo would be a lie, and the count only changes on import — which closes
  // this sheet anyway.
  const allowance = importAllowance(isPro);

  if (!incoming) return null;

  const isError = incoming.kind === "error";
  const style = incoming.kind === "style" ? incoming.style : null;
  const blocked = !isError && !allowance.allowed;

  return (
    <div
      className="sc-modal-backdrop"
      onClick={onDismiss}
      role="presentation"
    >
      <div
        className="sc-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sc-modal-heading"
      >
        {isError ? (
          <>
            <h3 id="sc-modal-heading" className="sc-modal-heading">
              Can&rsquo;t open this style
            </h3>
            <p className="sc-modal-error">
              {shareFailureMessage(incoming.failure)}
            </p>
            <div className="sc-modal-actions">
              <button
                type="button"
                className="sc-modal-btn sc-modal-btn--primary"
                onClick={onDismiss}
              >
                Close
              </button>
            </div>
          </>
        ) : (
          style && (
            <>
              <p className="sc-modal-kicker">
                {style.sender
                  ? `${style.sender} shared a style with you`
                  : "Someone shared a style with you"}
              </p>
              <h3 id="sc-modal-heading" className="sc-modal-heading">
                {style.title}
              </h3>

              {style.description && (
                <p className="sc-modal-desc">{style.description}</p>
              )}

              <p className="sc-modal-counts">
                {countLabel(style.singles.length, "single", "singles")} &middot;{" "}
                {countLabel(style.combos.length, "combo", "combos")}
              </p>

              <div className="sc-modal-preview">
                {style.singles.slice(0, PREVIEW_SINGLES).map((entry, i) => (
                  <span key={`s${i}`} className="sc-modal-chip">
                    {techniqueText(entry)}
                  </span>
                ))}
                {style.combos.slice(0, PREVIEW_COMBOS).map((entry, i) => (
                  <span
                    key={`c${i}`}
                    className="sc-modal-chip sc-modal-chip--combo"
                  >
                    {techniqueText(entry)}
                  </span>
                ))}
                {style.singles.length + style.combos.length >
                  PREVIEW_SINGLES + PREVIEW_COMBOS && (
                  <span className="sc-modal-chip sc-modal-chip--more">
                    +
                    {style.singles.length +
                      style.combos.length -
                      PREVIEW_SINGLES -
                      PREVIEW_COMBOS}{" "}
                    more
                  </span>
                )}
              </div>

              {blocked ? (
                <p className="sc-modal-note sc-modal-note--blocked">
                  You&rsquo;ve used your {FREE_IMPORT_LIMIT} free imports. Go Pro
                  to add this one and build your own styles.
                </p>
              ) : (
                allowance.isCapped && (
                  <p className="sc-modal-note">
                    {countLabel(allowance.remaining, "free import", "free imports")}{" "}
                    left.
                  </p>
                )
              )}

              <div className="sc-modal-actions">
                <button
                  type="button"
                  className="sc-modal-btn"
                  onClick={onDismiss}
                >
                  Not now
                </button>
                {blocked ? (
                  <button
                    type="button"
                    className="sc-modal-btn sc-modal-btn--primary"
                    onClick={onUnlockPro}
                  >
                    Unlock Pro
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sc-modal-btn sc-modal-btn--primary"
                    onClick={() => onImport(style)}
                  >
                    Add to my styles
                  </button>
                )}
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
