import { useState } from "react";

import "@/styles/modal.css";

type NewStyleDialogProps = {
  /** Returns false when the name is rejected, so the dialog can stay open. */
  onCreate: (name: string) => boolean;
  onClose: () => void;
};

/**
 * Name a new style.
 *
 * A dialog rather than a field parked at the top of the page, for the same
 * reason importing is: creating a style is an occasional, deliberate act, and
 * the styles themselves are what the page is for. Two headed panels and an
 * always-visible input used to push the first style most of the way down the
 * screen.
 */
export default function NewStyleDialog({
  onCreate,
  onClose,
}: NewStyleDialogProps) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed) return;
    // A duplicate name keeps the dialog open with the text intact, rather than
    // closing and losing what they typed.
    if (onCreate(trimmed)) onClose();
  };

  return (
    <div className="sc-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="sc-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-style-heading"
      >
        <h3 id="new-style-heading" className="sc-modal-heading">
          New style
        </h3>
        <p className="sc-modal-desc">
          Give it a name. You can add techniques straight after.
        </p>

        <input
          className="sc-modal-field"
          type="text"
          value={name}
          placeholder="e.g. Tuesday Drills"
          aria-label="Style name"
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />

        <div className="sc-modal-actions">
          <button type="button" className="sc-modal-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sc-modal-btn sc-modal-btn--primary"
            onClick={submit}
            disabled={!trimmed}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
