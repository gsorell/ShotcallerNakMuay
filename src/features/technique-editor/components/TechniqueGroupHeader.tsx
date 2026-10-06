import type { TechniqueShape } from "@/utils/techniqueUtils";
import StyleMenu, { type StyleMenuItem } from "./StyleMenu";

interface TechniqueGroupHeaderProps {
  keyName: string;
  group: TechniqueShape;
  thumbnail?: string;
  expanded: boolean;
  toggleGroupExpanded: (key: string) => void;
  /** What can be done to the style as a whole — see StyleMenu. */
  actions?: StyleMenuItem[];
}

/**
 * A style's row: which style it is, what you can do to it, and the way in.
 *
 * It says the same thing open or closed. The name used to turn into a text
 * field in place once the style was open, which left a field squeezed between
 * the icon and two buttons and cut the name off mid-word on a phone. Renaming
 * now happens in the open style, with the description — see StyleNameField.
 */
export default function TechniqueGroupHeader({
  keyName,
  group,
  thumbnail,
  expanded,
  toggleGroupExpanded,
  actions = [],
}: TechniqueGroupHeaderProps) {
  const currentTitle = group.title ?? group.label ?? keyName;

  return (
    <div
      className={`tech-editor-group-header ${expanded ? "is-expanded" : ""}`}
    >
      <div className="tech-editor-header-row">
        {thumbnail && (
          <img
            src={thumbnail}
            alt={`${currentTitle} thumbnail`}
            className="tech-editor-thumbnail"
          />
        )}
        {/* The name opens and closes the style too — the whole row reads as
            one thing to tap, and the button at the end is the same action for
            the keyboard. */}
        <div
          className="tech-editor-title-area"
          style={{ flex: 1 }}
          onClick={() => toggleGroupExpanded(keyName)}
        >
          <h3 className="tech-editor-title">{currentTitle}</h3>
        </div>
        {/* The trailing edge: what you can do with the style (the menu), then
            the way in (the chevron). Icons, not filled buttons — the row is
            mostly a name, and should read as one. */}
        <div className="tech-editor-buttons-row-inline">
          <StyleMenu styleName={currentTitle} items={actions} />
          <button
            type="button"
            onClick={() => toggleGroupExpanded(keyName)}
            className={`tech-editor-disclose ${expanded ? "is-expanded" : ""}`}
            title={expanded ? "Collapse" : "Expand"}
            aria-label={expanded ? "Collapse group" : "Expand group"}
            aria-expanded={expanded}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 6 8 10.5 12.5 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
