import { useState } from "react";

import { extractShareCode } from "@/utils/styleShare";
import { submitShareCode } from "./shareInbox";
import "@/styles/modal.css";

type ImportLinkDialogProps = {
  onClose: () => void;
};

/**
 * Paste a shared style link.
 *
 * This is a dialog rather than a field sitting permanently in the editor
 * because importing by paste is a rare, deliberate act — most styles arrive by
 * tapping a link, which never comes through here at all. It stays because a
 * link can land somewhere the OS will not hand to the app (an in-app browser,
 * a desktop chat mirrored to the phone), and because neither store carries the
 * link through an install, so someone who installs *after* being sent a style
 * has no other way in.
 */
export default function ImportLinkDialog({ onClose }: ImportLinkDialogProps) {
  // Mounted only while open, so both fields start clean without an effect
  // reaching back in to reset them.
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState("");

  const handleImport = () => {
    const code = extractShareCode(pasted);
    if (!code) {
      setError("That doesn't look like a Shot Caller style link.");
      return;
    }
    // Hand off to the same confirmation sheet a tapped link opens, so there is
    // one place that decides whether a style gets written.
    onClose();
    submitShareCode(code);
  };

  return (
    <div className="sc-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="sc-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-link-heading"
      >
        <h3 id="import-link-heading" className="sc-modal-heading">
          Import a style
        </h3>
        <p className="sc-modal-desc">
          Paste a link someone shared with you.
        </p>

        <input
          className="sc-modal-field"
          type="text"
          value={pasted}
          placeholder="https://shotcallernakmuay.netlify.app/s/#p=…"
          aria-label="Shared style link"
          autoFocus
          onChange={(e) => {
            setPasted(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleImport();
            }
          }}
        />
        {error && <p className="sc-modal-note--blocked">{error}</p>}

        <div className="sc-modal-actions">
          <button type="button" className="sc-modal-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sc-modal-btn sc-modal-btn--primary"
            onClick={handleImport}
            disabled={!pasted.trim()}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
