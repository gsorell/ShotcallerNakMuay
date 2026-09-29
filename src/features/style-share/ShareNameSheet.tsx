import { useState } from "react";

import { SHARE_LIMITS } from "@/utils/styleShare";
import "@/styles/modal.css";

type ShareNameSheetProps = {
  initialName: string;
  /** "confirm" runs before a first share; "edit" is a deliberate change. */
  mode: "confirm" | "edit";
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

/**
 * Ask what name a shared style should go out under.
 *
 * Shown once, before the first share, and thereafter only when the user asks
 * to change it — sharing itself stays a single tap. It exists because a name
 * cannot be collected in onboarding alone: Pro users never see onboarding, and
 * neither does anyone who onboarded before sharing existed, which is every
 * user who already has the app. Those users arrive here with an assigned name
 * already filled in, so confirming is one tap and correcting is easy.
 */
export default function ShareNameSheet({
  initialName,
  mode,
  onConfirm,
  onCancel,
}: ShareNameSheetProps) {
  // Mounted only while it is open, so the field seeds itself on mount and
  // there is no open/closed state to synchronise back in an effect.
  const [name, setName] = useState(initialName);

  const trimmed = name.trim();
  const submit = () => {
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <div className="sc-modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="sc-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-name-heading"
      >
        <h3 id="share-name-heading" className="sc-modal-heading">
          {mode === "confirm" ? "Share as…" : "Your sharing name"}
        </h3>
        <p className="sc-modal-desc">
          {mode === "confirm"
            ? "This is the name your friend sees on the style you send them."
            : "The name your friend sees on styles you send them."}
        </p>

        <input
          className="sc-modal-field"
          type="text"
          value={name}
          maxLength={SHARE_LIMITS.senderName}
          placeholder="e.g. Jake"
          aria-label="Your sharing name"
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <p className="sc-modal-note">Stored on this phone only.</p>

        <div className="sc-modal-actions">
          <button type="button" className="sc-modal-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="sc-modal-btn sc-modal-btn--primary"
            onClick={submit}
            disabled={!trimmed}
          >
            {mode === "confirm" ? "Save & Share" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
