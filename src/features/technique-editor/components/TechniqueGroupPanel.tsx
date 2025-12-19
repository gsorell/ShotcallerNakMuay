import type { TechniqueShape } from "@/utils/techniqueUtils";
import { normalizeArray } from "@/utils/techniqueUtils";
import { GROUP_THUMBNAILS } from "../constants";
import TechniqueGroupHeader from "./TechniqueGroupHeader";
import TechniqueListSection from "./TechniqueListSection";

interface TechniqueGroupPanelProps {
  keyName: string;
  group: TechniqueShape;
  isCoreStyle: boolean;
  onDuplicate?: () => void;
  expanded: boolean;
  toggleGroupExpanded: (key: string) => void;
  updateGroupLabel: (label: string) => void;
  updateGroupDescription: (description: string) => void;
  onChangeSingle: (idx: number, value: string) => void;
  onToggleSingleFavorite: (idx: number) => void;
  onRemoveSingle: (idx: number) => void;
  onAddSingle: () => void;
  onChangeCombo: (idx: number, value: string) => void;
  onToggleComboFavorite: (idx: number) => void;
  onRemoveCombo: (idx: number) => void;
  onAddCombo: () => void;
  onDeleteGroup: () => void;
}

export default function TechniqueGroupPanel({
  keyName,
  group,
  isCoreStyle,
  onDuplicate,
  expanded,
  toggleGroupExpanded,
  updateGroupLabel,
  updateGroupDescription,
  onChangeSingle,
  onToggleSingleFavorite,
  onRemoveSingle,
  onAddSingle,
  onChangeCombo,
  onToggleComboFavorite,
  onRemoveCombo,
  onAddCombo,
  onDeleteGroup,
}: TechniqueGroupPanelProps) {
  const singles = normalizeArray(group.singles);
  const combos = normalizeArray(group.combos);
  const thumbnail = !isCoreStyle
    ? "/assets/icon_user.png"
    : GROUP_THUMBNAILS[keyName];

  return (
    <div className="tech-editor-panel">
      <TechniqueGroupHeader
        keyName={keyName}
        group={group}
        isCoreStyle={isCoreStyle}
        thumbnail={thumbnail}
        onDuplicate={onDuplicate}
        expanded={expanded}
        toggleGroupExpanded={toggleGroupExpanded}
        updateGroupLabel={updateGroupLabel}
      />
      {expanded && (
        <>
          {/* Description for all groups */}
          <div>
            <label htmlFor={`desc-${keyName}`} className="tech-editor-label">
              Description
            </label>
            {isCoreStyle ? (
              <div className="tech-editor-description-box">
                {group.description || "No description available"}
              </div>
            ) : (
              <textarea
                id={`desc-${keyName}`}
                value={group.description ?? ""}
                onChange={(e) => updateGroupDescription(e.target.value)}
                className="tech-editor-textarea"
                placeholder="Describe this group (purpose, focus, etc.)"
                aria-label="Group Description"
                rows={Math.max(2, (group.description || "").split("\n").length)}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = target.scrollHeight + "px";
                }}
              />
            )}
          </div>
          <div className="technique-sections">
            <TechniqueListSection
              title="Single Strikes"
              items={singles}
              readOnly={isCoreStyle}
              groupKey={keyName}
              kind="single"
              onChangeText={onChangeSingle}
              onToggleFavorite={onToggleSingleFavorite}
              onRemoveItem={onRemoveSingle}
              onAddItem={onAddSingle}
            />
            <TechniqueListSection
              title="Combos"
              items={combos}
              readOnly={isCoreStyle}
              groupKey={keyName}
              kind="combo"
              onChangeText={onChangeCombo}
              onToggleFavorite={onToggleComboFavorite}
              onRemoveItem={onRemoveCombo}
              onAddItem={onAddCombo}
            />
          </div>
          {!isCoreStyle && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                onClick={onDeleteGroup}
                className="tech-editor-btn--action"
                aria-label={`Delete group ${group.label}`}
              >
                Delete Group
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
