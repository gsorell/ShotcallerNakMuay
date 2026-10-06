import { useRef, useState } from "react";

type StyleNameFieldProps = {
  keyName: string;
  /** The style's name as it stands. */
  name: string;
  onRename: (name: string) => void;
};

/**
 * The style's name, as the first field of an open style.
 *
 * Buffered: the name is committed on blur or Enter rather than on every
 * keystroke, so a half-typed name is never what the home screen shows, and
 * Escape puts back what was there.
 */
export default function StyleNameField({
  keyName,
  name,
  onRename,
}: StyleNameFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape blurs the field, and blur commits. Without this flag the commit
  // that follows still sees the abandoned text — clearing the draft has not
  // landed yet — and saves exactly what the user just threw away.
  const abandoned = useRef(false);

  const commit = () => {
    if (abandoned.current) {
      abandoned.current = false;
      setDraft(null);
      return;
    }
    const trimmed = (draft ?? "").trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    setDraft(null);
  };

  return (
    <div className="tech-editor-field">
      <label htmlFor={`name-${keyName}`} className="tech-editor-label">
        Name
      </label>
      <input
        id={`name-${keyName}`}
        type="text"
        className="tech-editor-input"
        value={draft ?? name}
        placeholder="Style name"
        onFocus={() => setDraft(name)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            // This page also listens for Escape, to go back. Abandoning an
            // edit must not take the whole screen with it.
            e.stopPropagation();
            abandoned.current = true;
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
