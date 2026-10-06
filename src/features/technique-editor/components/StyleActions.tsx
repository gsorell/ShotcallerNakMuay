import { useState } from "react";

import { ImportLinkDialog, SharingIdentity } from "@/features/style-share";
import NewStyleDialog from "./NewStyleDialog";

type StyleActionsProps = {
  /** Returns false if the name was rejected (already taken). */
  onCreate: (name: string) => boolean;
};

/**
 * The two ways a style enters the library, on one row.
 *
 * These were two headed panels — "Create New Style" with a permanent text
 * field, and "Share & Import Styles" with a button — stacked above the list.
 * Between them they pushed the first actual style off the bottom of a phone
 * screen, on a page whose entire job is the list of styles.
 *
 * Both are now buttons opening the same kind of dialog, which is worth more
 * than the one tap it costs: making a style and importing one are the same
 * intent from different sources, so they should not look like different
 * species of control.
 */
export default function StyleActions({
  onCreate,
}: StyleActionsProps) {
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  return (
    <div className="tech-editor-actions">
      <div className="tech-editor-actions-row">
        {/* Not equal weight: making a style is what this page is for, and
            importing one is occasional. Same primary/secondary pairing the
            dialogs use, so only one thing on the screen is shouting. */}
        <button
          type="button"
          className="tech-editor-action tech-editor-action--primary"
          onClick={() => setCreating(true)}
        >
          + New Style
        </button>
        <button
          type="button"
          className="tech-editor-action"
          onClick={() => setImporting(true)}
        >
          ↓ Import
        </button>
      </div>

      <SharingIdentity />

      {creating && (
        <NewStyleDialog onCreate={onCreate} onClose={() => setCreating(false)} />
      )}
      {importing && <ImportLinkDialog onClose={() => setImporting(false)} />}
    </div>
  );
}
