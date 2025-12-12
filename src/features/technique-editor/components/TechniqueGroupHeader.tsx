import type { TechniqueShape } from "@/utils/techniqueUtils";
import { useRef, useState } from "react";

interface TechniqueGroupHeaderProps {
  keyName: string;
  group: TechniqueShape;
  isCoreStyle: boolean;
  thumbnail?: string;
  onDuplicate?: () => void;
  expanded: boolean;
  toggleGroupExpanded: (key: string) => void;
  updateGroupLabel: (label: string) => void;
}

export default function TechniqueGroupHeader({
  keyName,
  group,
  isCoreStyle,
  thumbnail,
  onDuplicate,
  expanded,
  toggleGroupExpanded,
  updateGroupLabel,
}: TechniqueGroupHeaderProps) {
  // Local buffered state for stable editing (commit on blur/Enter)
  const [tempEditValue, setTempEditValue] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Always use the current group data as the source of truth
  const currentTitle = group.title ?? group.label ?? keyName;
  const displayValue = isEditing ? tempEditValue : currentTitle;

  return (
    <div
      className={`tech-editor-group-header ${expanded ? "is-expanded" : ""}`}
    >
      {/* Top row: icon and title only */}
      <div className="tech-editor-header-row">
        {thumbnail && (
          <img
            src={thumbnail}
            alt={`${group.title ?? group.label ?? keyName} thumbnail`}
            className="tech-editor-thumbnail"
          />
        )}
        <div>
          {expanded && !isCoreStyle ? (
            <input
              type="text"
              value={displayValue}
              onChange={(e) => setTempEditValue(e.target.value)}
              onFocus={() => {
                setTempEditValue(currentTitle); // Initialize temp value with current title
                setIsEditing(true);
              }}
              onBlur={() => {
                const trimmed = tempEditValue.trim();

                if (trimmed) {
                  // Parent provides a bound updater via getUpdateLabelHandler(key)
                  // So call the provided updateGroupLabel with the single trimmed label argument.
                  updateGroupLabel(trimmed);
                }
                setIsEditing(false);
                setTempEditValue(""); // Clear temp value
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const trimmed = tempEditValue.trim();

                  if (trimmed) {
                    updateGroupLabel(trimmed);
                  }
                  setIsEditing(false);
                  setTempEditValue("");
                } else if (e.key === "Escape") {
                  setIsEditing(false);
                  setTempEditValue("");
                }
              }}
              className="tech-editor-input tech-editor-input--title"
              placeholder="Group name"
              aria-label="Group title"
            />
          ) : (
            <h3 className="tech-editor-title">{currentTitle}</h3>
          )}
        </div>
        {/* Buttons row */}
        <div className="tech-editor-buttons-row">
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="tech-editor-btn tech-editor-btn--copy"
              title="Duplicate this group"
              aria-label="Duplicate group"
            >
              📋
            </button>
          )}
          <button
            onClick={() => toggleGroupExpanded(keyName)}
            className={`tech-editor-btn tech-editor-btn--expand ${
              expanded ? "is-expanded" : ""
            }`}
            title={expanded ? "Collapse" : "Expand"}
            aria-label={expanded ? "Collapse group" : "Expand group"}
          >
            {expanded ? "−" : "+"}
          </button>
        </div>
      </div>
    </div>
  );
}
