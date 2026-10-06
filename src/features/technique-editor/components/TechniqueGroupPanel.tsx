import type { TechniqueShape } from "@/utils/techniqueUtils";
import { normalizeArray } from "@/utils/techniqueUtils";
import { GROUP_THUMBNAILS } from "../constants";
import type { ActionMenuItem } from "../../shared";
import StyleNameField from "./StyleNameField";
import TechniqueGroupHeader from "./TechniqueGroupHeader";
import TechniqueListSection from "./TechniqueListSection";

interface TechniqueGroupPanelProps {
  keyName: string;
  group: TechniqueShape;
  isCoreStyle: boolean;
  onDuplicate?: () => void;
  /** Absent for styles that cannot be shared (the timer-only mode). */
  onShare?: () => void;
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
  onResetGroup?: () => void;
}

export default function TechniqueGroupPanel({
  keyName,
  group,
  isCoreStyle,
  onDuplicate,
  onShare,
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
  onResetGroup,
}: TechniqueGroupPanelProps) {
  const singles = normalizeArray(group.singles);
  const combos = normalizeArray(group.combos);
  const thumbnail = !isCoreStyle
    ? "/assets/icon_user.webp"
    : GROUP_THUMBNAILS[keyName];

  // Everything that acts on the style as a whole, in one menu on its row.
  // Ordered by how often it is wanted, with the one that destroys work last.
  const actions: ActionMenuItem[] = [];
  if (onShare) actions.push({ label: "Share", icon: "↗", onSelect: onShare });
  if (onDuplicate) {
    actions.push({ label: "Duplicate", icon: "⧉", onSelect: onDuplicate });
  }
  if (isCoreStyle && onResetGroup) {
    actions.push({
      label: "Restore defaults",
      icon: "↺",
      onSelect: onResetGroup,
      destructive: true,
    });
  }
  if (!isCoreStyle) {
    actions.push({
      label: "Delete style",
      icon: "✕",
      onSelect: onDeleteGroup,
      destructive: true,
    });
  }

  return (
    <div className="tech-editor-panel" id={`group-panel-${keyName}`}>
      <TechniqueGroupHeader
        keyName={keyName}
        group={group}
        thumbnail={thumbnail}
        expanded={expanded}
        toggleGroupExpanded={toggleGroupExpanded}
        actions={actions}
      />
      {expanded && (
        <>
          {/* The style's own details first, as a short form: what it is
              called, then what it is for. */}
          <StyleNameField
            keyName={keyName}
            name={group.title ?? group.label ?? keyName}
            onRename={updateGroupLabel}
          />
          <div className="tech-editor-field">
            <label htmlFor={`desc-${keyName}`} className="tech-editor-label">
              Description
            </label>
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
          </div>
          <div className="technique-sections">
            <TechniqueListSection
              title="Single Strikes"
              items={singles}
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
              groupKey={keyName}
              kind="combo"
              onChangeText={onChangeCombo}
              onToggleFavorite={onToggleComboFavorite}
              onRemoveItem={onRemoveCombo}
              onAddItem={onAddCombo}
            />
          </div>
        </>
      )}
    </div>
  );
}
