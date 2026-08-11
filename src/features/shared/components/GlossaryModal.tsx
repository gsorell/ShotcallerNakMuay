import React from "react";
import { createPortal } from "react-dom";

// The library's data module, not the Learn barrel — that barrel pulls in
// LearnSection, which imports this feature back.
import { TECHNIQUE_LIBRARY } from "@/features/learn/data/techniqueLibrary";

import "./GlossaryModal.css";

interface GlossaryModalProps {
  open: boolean;
  onClose: () => void;
  /** Offered when there is somewhere to send them; omitted inside onboarding. */
  onOpenLearn?: () => void;
}

/**
 * A free, quick reference for what the app is shouting at you.
 *
 * This replaced a hand-written table that had drifted — it called the jab "a
 * straight punch with the Left hand", which is wrong for half the stances the
 * app supports. Both sections are derived from the lesson library instead, so
 * there is one description of a technique in the codebase rather than two.
 *
 * Deliberately not gated. The full lessons are Pro, but knowing that 3 means
 * the lead hook is table stakes — paywalling the vocabulary would lock out
 * exactly the beginner the rest of this app bends over backwards to help.
 */
export const GlossaryModal: React.FC<GlossaryModalProps> = ({
  open,
  onClose,
  onOpenLearn,
}) => {
  if (!open) return null;

  // Multi-number entries are combinations ("1 1" is a double jab), not another
  // name for a single technique, so they have no place in a numbering table.
  const numbered = TECHNIQUE_LIBRARY.filter(
    (e) => e.numbering && !/\s/.test(e.numbering)
  ).sort((a, b) => Number(a.numbering) - Number(b.numbering));

  const thai = TECHNIQUE_LIBRARY.filter((e) => e.thai);

  const modal = (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Glossary"
      className="glossary-backdrop"
    >
      <div onClick={(e) => e.stopPropagation()} className="glossary-content">
        <div className="glossary-header">
          <h3>Glossary</h3>
          <button onClick={onClose} className="glossary-close">
            Close
          </button>
        </div>

        <p className="glossary-note">
          <strong>This app assumes you already know the form.</strong> It calls
          techniques out; it cannot see you and will not correct you. If a
          technique here is new to you, learn it from a qualified coach before
          drilling it at speed.
        </p>

        <div className="glossary-section">
          <h4>The numbers</h4>
          <p className="glossary-sub">
            Combinations are called by number. These six are the whole system.
          </p>
          <div className="glossary-table-wrap">
            <table className="glossary-table">
              <tbody>
                {numbered.map((entry) => (
                  <tr key={entry.slug}>
                    <td className="glossary-num">{entry.numbering}</td>
                    <td className="glossary-term">{entry.name}</td>
                    <td className="glossary-desc">{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glossary-section">
          <h4>Thai terms</h4>
          <div className="glossary-table-wrap">
            <table className="glossary-table">
              <tbody>
                {thai.map((entry) => (
                  <tr key={entry.slug}>
                    <td className="glossary-term">
                      {entry.name}
                      <span className="glossary-thai">{entry.thai}</span>
                    </td>
                    <td className="glossary-desc">{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {onOpenLearn && (
          <button className="glossary-more" onClick={onOpenLearn}>
            Every technique explained, in Learn ›
          </button>
        )}

        <div className="glossary-footer">
          <a
            href="https://shotcallernakmuay.netlify.app/privacy-policy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="glossary-privacy"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );

  const target = typeof document !== "undefined" ? document.body : null;
  if (!target) return null;
  return createPortal(modal, target);
};

export default GlossaryModal;
