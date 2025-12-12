import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import "@/styles/editor.css";
import {
  denormalizeArray,
  humanizeKey,
  normalizeArray,
  normalizeTechniques,
  type TechniqueShape as UtilsTechniqueShape,
} from "@/utils/techniqueUtils";
import React, { useEffect, useRef, useState } from "react";
import "./TechniqueEditor.css";

type TechniqueDetail = {
  name: string;
  combo: string;
};

export interface TechniqueShape extends UtilsTechniqueShape {
  techniques?: Record<string, TechniqueDetail>;
}

// helper: create a readable title from a short key
// helpers imported from utils/techniqueUtils

// Define the path to the download icon
const downloadIcon = "/assets/icon_download.png";

// Define thumbnails for groups (example mapping)
const GROUP_THUMBNAILS: Record<string, string> = {
  timer_only: "/assets/icon.stopwatch.png",
  newb: "/assets/icon_newb.png",
  two_piece: "/assets/icon_two_piece.png",
  boxing: "/assets/icon_boxing.png",
  mat: "/assets/icon_mat.png",
  tae: "/assets/icon_tae.png",
  khao: "/assets/icon_khao.png",
  sok: "/assets/icon_sok.png",
  femur: "/assets/icon_femur.png",
  southpaw: "/assets/icon_southpaw.png",
  muay_tech: "/assets/icon.muaytech.png",
  meat_potatoes: "/assets/icon_meat_potatoes.png",
  buakaw: "/assets/icon.buakaw.png",
  low_kick_legends: "/assets/icon_lowkicklegends.png",
  elbow_arsenal: "/assets/icon.elbow arsenal.png",
  ko_setups: "/assets/icon.ko.png",
  tricky_traps: "/assets/icon.trickytraps.png",
  feints_and_fakeouts: "/assets/icon.feintsandfakes.png",
  dutch_kickboxing: "/assets/icon.dutch.png",
};

// Define the path to the upload icon
const uploadIcon = "/assets/icon_upload.png";

// Define the path to the trash icon
const trashIcon = "/assets/icon_trash.png";

type TechniqueEditorProps = {
  techniques: Record<string, TechniqueShape>;
  setTechniques: (t: Record<string, TechniqueShape>) => void;
  onBack?: () => void;
};

export default function TechniqueEditor({
  techniques,
  setTechniques,
  onBack,
}: TechniqueEditorProps) {
  // start with normalized techniques so missing titles/labels are filled
  const [local, setLocal] = useState<Record<string, TechniqueShape>>(() =>
    normalizeTechniques(techniques)
  );
  const [newGroupName, setNewGroupName] = useState("");

  // --- NEW: Scroll to top on group creation/duplication ---
  const topRef = useRef<HTMLDivElement>(null);
  function scrollToTop() {
    setTimeout(() => {
      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: "auto", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    }, 0);
  }

  useEffect(() => setLocal(normalizeTechniques(techniques)), [techniques]);

  useEffect(() => setLocal(normalizeTechniques(techniques)), [techniques]);

  function persist(next: Record<string, TechniqueShape>) {
    // Normalize incoming data so every group has label/title fields
    const normalized = normalizeTechniques(
      next as Record<string, Partial<TechniqueShape>>
    );
    // Defensive: if any group ended up with raw key as label/title (e.g., 'newb_copy'), replace with humanized form
    Object.entries(normalized).forEach(([k, v]) => {
      try {
        if (v.label === k || v.title === k) {
          const human = humanizeKey(k);
          if (v.label === k) v.label = human;
          if (v.title === k) v.title = human;
        }
      } catch (e) {
        /* noop */
      }
    });
    setLocal(normalized);
    try {
      // Ensure the app-level techniques state receives the normalized shape
      setTechniques(normalized as Record<string, TechniqueShape>);
    } catch (e) {
      // swallow to avoid breaking the editor UI
    }
  }

  function updateGroupLabel(groupKey: string, label: string) {
    const next = { ...local };
    const existing = next[groupKey] || {};
    next[groupKey] = { ...existing, label, title: label };
    persist(next);
  }

  function updateGroupDescription(groupKey: string, description: string) {
    const next = { ...local };
    const existing = next[groupKey] || {};
    next[groupKey] = { ...existing, description, label: description };
    persist(next);
  }

  function updateSingle(groupKey: string, idx: number, value: string) {
    const next = { ...local };
    const singles = normalizeArray(next[groupKey]!.singles);
    singles[idx]!.text = value;
    next[groupKey] = { ...next[groupKey]!, singles: denormalizeArray(singles) };
    persist(next);
  }

  function toggleSingleFavorite(groupKey: string, idx: number) {
    const next = { ...local };
    const singles = normalizeArray(next[groupKey]!.singles);
    singles[idx]!.favorite = !singles[idx]!.favorite;
    next[groupKey] = { ...next[groupKey]!, singles: denormalizeArray(singles) };
    persist(next);
  }

  function addSingle(groupKey: string) {
    const next = { ...local };
    const singles = normalizeArray(next[groupKey]!.singles);
    singles.push({ text: "" });
    next[groupKey] = { ...next[groupKey]!, singles: denormalizeArray(singles) };
    persist(next);
  }

  function removeSingle(groupKey: string, idx: number) {
    const next = { ...local };
    const singles = normalizeArray(next[groupKey]!.singles);
    singles.splice(idx, 1);
    next[groupKey] = { ...next[groupKey]!, singles: denormalizeArray(singles) };
    persist(next);
  }

  function updateCombo(groupKey: string, idx: number, value: string) {
    const next = { ...local };
    const combos = normalizeArray(next[groupKey]!.combos);
    combos[idx]!.text = value;
    next[groupKey] = { ...next[groupKey]!, combos: denormalizeArray(combos) };
    persist(next);
  }

  function toggleComboFavorite(groupKey: string, idx: number) {
    const next = { ...local };
    const combos = normalizeArray(next[groupKey]!.combos);
    combos[idx]!.favorite = !combos[idx]!.favorite;
    next[groupKey] = { ...next[groupKey]!, combos: denormalizeArray(combos) };
    persist(next);
  }

  function addCombo(groupKey: string) {
    const next = { ...local };
    const combos = normalizeArray(next[groupKey]!.combos);
    combos.push({ text: "" });
    next[groupKey] = { ...next[groupKey]!, combos: denormalizeArray(combos) };
    persist(next);
  }

  function removeCombo(groupKey: string, idx: number) {
    const next = { ...local };
    const combos = normalizeArray(next[groupKey]!.combos);
    combos.splice(idx, 1);
    next[groupKey] = { ...next[groupKey]!, combos: denormalizeArray(combos) };
    persist(next);
  }

  // --- MODIFIED: Add group and scroll to top ---
  function addGroup(key: string) {
    const k = key.trim();
    if (!k) return;
    if (local[k]) {
      alert(`Group "${k}" already exists.`);
      return;
    }
    // Insert new group at the top of the user groups (before all others)
    const next: Record<string, TechniqueShape> = {};
    // Add the new group first
    next[k] = { label: k, title: humanizeKey(k), singles: [], combos: [] };
    // Then add all existing groups
    Object.entries(local).forEach(([groupKey, value]) => {
      next[groupKey] = value;
    });
    persist(next);
    // Expand the newly created group so user can immediately start adding techniques
    setExpandedGroups((prev) => ({ ...prev, [k]: true }));
    setNewGroupName("");
    scrollToTop();
  }

  function resetToDefault() {
    if (
      !window.confirm(
        "Are you sure you want to reset all techniques to their default values? This cannot be undone."
      )
    )
      return;
    persist(INITIAL_TECHNIQUES as any);
  }

  // Optional: allow Escape to return to main page
  React.useEffect(() => {
    if (!onBack) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onBack]);

  // --- NEW: Export/Import logic ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const data = JSON.stringify(local, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "techniques_backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        if (
          !imported ||
          typeof imported !== "object" ||
          Array.isArray(imported)
        ) {
          alert("Invalid file format.");
          return;
        }
        if (
          !window.confirm(
            "Importing will overwrite your current techniques (custom and user sets only). Core sets will remain unchanged. Continue?"
          )
        )
          return;
        const merged: Record<string, TechniqueShape> = normalizeTechniques(
          INITIAL_TECHNIQUES as Record<string, Partial<TechniqueShape>>
        );
        Object.entries(imported).forEach(([k, v]) => {
          if (!INITIAL_TECHNIQUES[k])
            merged[k] = normalizeTechniques({
              [k]: v as Partial<TechniqueShape>,
            })[k]!;
        });
        persist(merged);
        alert("Techniques imported! (Core sets unchanged)");
      } catch {
        alert("Failed to import: Invalid or corrupted file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // --- MODIFIED: Duplicate any group (core or user-created) and scroll to top ---
  function duplicateGroup(key: string) {
    let base = local[key];
    if (!base) return;
    let newKey = key + "_copy";
    let i = 2;
    while (local[newKey]) {
      newKey = key + `_copy${i++}`;
    }
    const next = {
      ...local,
      [newKey]: {
        ...base,
        label: base.label + " (Copy)",
        title: (base.title || base.label) + " (Copy)",
      },
    };
    persist(next);
    // Expand the newly duplicated group so user can immediately start editing
    setExpandedGroups((prev) => ({ ...prev, [newKey]: true }));
    alert(`Duplicated "${base.label}" as "${base.label} (Copy)"`);
    scrollToTop();
  }

  // --- NEW: Group sorting logic ---
  // Home page order (excluding user and calisthenics)
  const CORE_ORDER = [
    "timer_only",
    "newb",
    "two_piece",
    "boxing",
    "mat",
    "tae",
    "khao",
    "sok",
    "femur",
    "southpaw",
    "muay_tech",
    "meat_potatoes",
    "buakaw",
    "low_kick_legends",
    "elbow_arsenal",
    "ko_setups",
    "tricky_traps",
  ];

  // User-created groups: not in INITIAL_TECHNIQUES and not 'calisthenics' or 'timer_only'
  const userGroups = React.useMemo(
    () =>
      Object.entries(local).filter(
        ([k]) =>
          !Object.prototype.hasOwnProperty.call(INITIAL_TECHNIQUES, k) &&
          k !== "calisthenics" &&
          k !== "timer_only"
      ),
    [local]
  );

  // Core groups in correct order, EXCLUDING 'timer_only'
  const coreGroups = React.useMemo(
    () =>
      CORE_ORDER.filter((k) => k !== "timer_only")
        .map((k) => [k, local[k]] as [string, TechniqueShape])
        .filter(([k, v]) => !!v),
    [local]
  );

  // Any other core groups not in CORE_ORDER (fallback), EXCLUDING 'timer_only'
  const otherCoreGroups = React.useMemo(
    () =>
      Object.entries(local).filter(
        ([k]) =>
          Object.prototype.hasOwnProperty.call(INITIAL_TECHNIQUES, k) &&
          !CORE_ORDER.includes(k) &&
          k !== "calisthenics" &&
          k !== "timer_only"
      ),
    [local]
  );

  // Final sorted group list for the Technique Manager (NO timer_only)
  const sortedGroups: [string, TechniqueShape][] = React.useMemo(
    () => [...userGroups, ...coreGroups, ...otherCoreGroups],
    [userGroups, coreGroups, otherCoreGroups]
  );

  // --- NEW: Track expanded/collapsed state for each group ---
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );

  function toggleGroupExpanded(key: string) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  // Track which group title is currently being edited to suppress re-renders
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const beginEdit = (key: string) => setEditingKey(key);
  const endEdit = () => setEditingKey(null);

  // Memoized callback factories to prevent re-renders
  const getDuplicateHandler = React.useCallback(
    (key: string) => () => duplicateGroup(key),
    [duplicateGroup]
  );
  const getToggleHandler = React.useCallback(
    (key: string) => () => toggleGroupExpanded(key),
    [toggleGroupExpanded]
  );
  const getBeginEditHandler = React.useCallback(
    (key: string) => () => beginEdit(key),
    [beginEdit]
  );
  const getUpdateLabelHandler = React.useCallback(
    (key: string) => (newLabel: string) => updateGroupLabel(key, newLabel),
    [updateGroupLabel]
  );

  // Note: Title editing uses the same controlled pattern as description; no edit suppression needed

  // --- Helper: Collapsible group header (applies to all groups) ---
  const GroupHeader = React.memo(
    function GroupHeader({
      keyName,
      group,
      isCoreStyle,
      thumbnail,
      onDuplicate,
      expanded,
      toggleGroupExpanded,
      updateGroupLabel,
      editingKey,
      onBeginEdit,
      onEndEdit,
    }: {
      keyName: string;
      group: TechniqueShape;
      isCoreStyle: boolean;
      thumbnail?: string;
      onDuplicate?: () => void;
      expanded: boolean;
      toggleGroupExpanded: (key: string) => void;
      // Parent may pass a bound single-arg updater (label: string) => void via getUpdateLabelHandler
      updateGroupLabel: (...args: any[]) => void;
      editingKey: string | null;
      onBeginEdit: (key: string) => void;
      onEndEdit: () => void;
    }) {
      // Instrumentation: track renders for this row (placed after state declarations)
      // Local buffered state for stable editing (commit on blur/Enter)
      const inputRef = React.useRef<HTMLInputElement>(null);
      const [tempEditValue, setTempEditValue] = React.useState<string>("");
      const [isEditing, setIsEditing] = React.useState<boolean>(false);

      // Always use the current group data as the source of truth
      const currentTitle = group.title ?? group.label ?? keyName;
      const displayValue = isEditing ? tempEditValue : currentTitle;

      return (
        <div
          className={`tech-editor-group-header ${
            expanded ? "is-expanded" : ""
          }`}
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
                  ref={inputRef}
                  type="text"
                  value={displayValue}
                  onChange={(e) => setTempEditValue(e.target.value)}
                  onFocus={() => {
                    setTempEditValue(currentTitle); // Initialize temp value with current title
                    setIsEditing(true);
                    onBeginEdit(keyName);
                  }}
                  onBlur={() => {
                    const trimmed = tempEditValue.trim();

                    if (trimmed) {
                      // Parent provides a bound updater via getUpdateLabelHandler(key)
                      // So call the provided updateGroupLabel with the single trimmed label argument.
                      (updateGroupLabel as unknown as (label: string) => void)(
                        trimmed
                      );
                    }
                    setIsEditing(false);
                    setTempEditValue(""); // Clear temp value
                    onEndEdit();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const trimmed = tempEditValue.trim();

                      if (trimmed) {
                        (
                          updateGroupLabel as unknown as (label: string) => void
                        )(trimmed);
                      }
                      setIsEditing(false);
                      setTempEditValue("");
                      onEndEdit();
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                    if (e.key === "Escape") {
                      setIsEditing(false);
                      setTempEditValue("");
                      onEndEdit();
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                  className="tech-editor-input tech-editor-input--title"
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  enterKeyHint="done"
                  aria-label="Rename group"
                  id={`group-title-${keyName}`}
                  name={`group-title-${keyName}`}
                  placeholder="Group Name"
                />
              ) : (
                <h3 className="tech-editor-title">
                  {group.title ?? group.label ?? keyName}
                </h3>
              )}
            </div>
          </div>
          {/* Buttons row: copy on left, expand on right */}
          <div className="tech-editor-buttons-row">
            {/* Copy button for all groups on the left */}
            {onDuplicate ? (
              <button
                onClick={onDuplicate}
                className="tech-editor-btn--copy"
                aria-label="Duplicate group"
                title="Create a copy of this style"
              >
                Copy
              </button>
            ) : (
              <div></div>
            )}

            {/* Expand/collapse button on the right */}
            <button
              onClick={() => toggleGroupExpanded(keyName)}
              className="tech-editor-btn--expand"
              aria-label={expanded ? "Collapse group" : "Expand group"}
              tabIndex={0}
            >
              {expanded ? "▲" : "▼"}
            </button>
          </div>
        </div>
      );
    },
    (prev, next) => {
      // Re-render if any of these change
      if (prev.keyName !== next.keyName) return false;
      if (prev.expanded !== next.expanded) return false;

      // Re-render if group title/label changes (for external updates)
      const prevTitle = prev.group.title ?? prev.group.label ?? prev.keyName;
      const nextTitle = next.group.title ?? next.group.label ?? next.keyName;
      if (prevTitle !== nextTitle) return false;

      // Re-render if editing state changes
      if (prev.editingKey !== next.editingKey) return false;

      // Don't re-render if nothing important changed
      return true;
    }
  );

  return (
    <div ref={topRef} className="tech-editor-container">
      {/* Top-left Back button, visually aligned and not overlapping */}
      {onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="tech-editor-btn--back"
            title="Back to Training (Esc)"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.12)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <span>←</span>
            Back
          </button>
        </div>
      )}
      {/* Clean Header & Quick Actions */}
      <div>
        {/* Page Title */}
        <h1 className="tech-editor-page-title">Technique Manager</h1>

        {/* Subtitle */}
        <p className="tech-editor-subtitle">
          Customize your training routines • Star favorites • Manage technique
          sets
        </p>
      </div>

      {/* --- Move Create New Emphasis block to the top --- */}
      <div className="add-emphasis-panel tech-editor-panel">
        <h3 className="tech-editor-panel-title">Create New Style</h3>
        <div>
          <input
            id="new-group-name"
            type="text"
            placeholder="Title (e.g., My Style)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="tech-editor-input"
            aria-label="New technique style name"
          />
          <button
            onClick={() => addGroup(newGroupName)}
            className="tech-editor-btn--create"
          >
            Create Style
          </button>
        </div>
      </div>

      {/* --- Render all groups using GroupHeader --- */}
      {sortedGroups.map(([key, group]) => {
        const isCoreStyle = Object.keys(INITIAL_TECHNIQUES).includes(key);
        const singles = normalizeArray(group.singles);
        const combos = normalizeArray(group.combos);
        // Use custom icon for user groups, otherwise use GROUP_THUMBNAILS
        const thumbnail = !isCoreStyle
          ? "/assets/icon_user.png"
          : GROUP_THUMBNAILS[key];
        const expanded = !!expandedGroups[key];
        return (
          <div key={key} className="tech-editor-panel">
            <GroupHeader
              keyName={key}
              group={group}
              isCoreStyle={isCoreStyle}
              thumbnail={thumbnail}
              onDuplicate={getDuplicateHandler(key)}
              expanded={expanded}
              toggleGroupExpanded={getToggleHandler(key)}
              updateGroupLabel={getUpdateLabelHandler(key)}
              editingKey={editingKey}
              onBeginEdit={getBeginEditHandler(key)}
              onEndEdit={endEdit}
            />
            {expanded && (
              <>
                {/* Description for all groups */}
                <div>
                  <label htmlFor={`desc-${key}`} className="tech-editor-label">
                    Description
                  </label>
                  {isCoreStyle ? (
                    <div className="tech-editor-description-box">
                      {group.description || "No description available"}
                    </div>
                  ) : (
                    <textarea
                      id={`desc-${key}`}
                      value={group.description ?? ""}
                      onChange={(e) =>
                        updateGroupDescription(key, e.target.value)
                      }
                      className="tech-editor-textarea"
                      placeholder="Describe this group (purpose, focus, etc.)"
                      aria-label="Group Description"
                      rows={Math.max(
                        2,
                        (group.description || "").split("\n").length
                      )}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto";
                        target.style.height = target.scrollHeight + "px";
                      }}
                    />
                  )}
                </div>
                <div className="technique-sections">
                  <div>
                    <h4 className="tech-editor-section-header">
                      Single Strikes
                      <span className="tech-editor-count">
                        ({singles.length})
                      </span>
                    </h4>
                    <div>
                      {singles.map((single, idx) => (
                        <div key={idx} className="tech-editor-item">
                          <input
                            id={`single-${key}-${idx}`}
                            type="text"
                            value={single.text}
                            onChange={(e) =>
                              !isCoreStyle &&
                              updateSingle(key, idx, e.target.value)
                            }
                            className="tech-editor-input tech-editor-input--item"
                            placeholder="e.g., jab"
                            aria-label={`Single technique ${idx + 1}`}
                            readOnly={isCoreStyle}
                            tabIndex={isCoreStyle ? -1 : 0}
                          />
                          <button
                            onClick={() => toggleSingleFavorite(key, idx)}
                            className={`tech-editor-btn--star ${
                              single.favorite ? "is-active" : ""
                            }`}
                            aria-label={single.favorite ? "Unstar" : "Star"}
                            title={
                              single.favorite
                                ? "Unstar (favorite)"
                                : "Star (favorite)"
                            }
                          >
                            ★
                          </button>
                          {!isCoreStyle && (
                            <button
                              onClick={() => removeSingle(key, idx)}
                              className="tech-editor-btn tech-editor-btn--delete"
                              aria-label="Delete single"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {!isCoreStyle && (
                      <button
                        onClick={() => addSingle(key)}
                        className="tech-editor-btn--add"
                      >
                        Add Single
                      </button>
                    )}
                  </div>
                  <div>
                    <h4 className="tech-editor-section-header">
                      Combos
                      <span className="tech-editor-count">
                        ({combos.length})
                      </span>
                    </h4>
                    <div>
                      {combos.map((combo, idx) => (
                        <div key={idx} className="tech-editor-item">
                          <input
                            id={`combo-${key}-${idx}`}
                            type="text"
                            value={combo.text}
                            onChange={(e) =>
                              !isCoreStyle &&
                              updateCombo(key, idx, e.target.value)
                            }
                            className="tech-editor-input tech-editor-input--item"
                            placeholder="e.g., 1, 2, 3"
                            aria-label={`Combo technique ${idx + 1}`}
                            readOnly={isCoreStyle}
                            tabIndex={isCoreStyle ? -1 : 0}
                          />
                          <button
                            onClick={() => toggleComboFavorite(key, idx)}
                            className={`tech-editor-btn--star ${combo.favorite ? 'is-active' : ''}`}
                            aria-label={combo.favorite ? "Unstar" : "Star"}
                            title={
                              combo.favorite
                                ? "Unstar (favorite)"
                                : "Star (favorite)"
                            }
                          >
                            ★
                          </button>
                          {!isCoreStyle && (
                            <button
                              onClick={() => removeCombo(key, idx)}
                              className="tech-editor-btn tech-editor-btn--delete"
                              aria-label="Delete combo"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {!isCoreStyle && (
                      <button
                        onClick={() => addCombo(key)}
                        className="tech-editor-btn--add"
                      >
                        Add Combo
                      </button>
                    )}
                  </div>
                </div>
                {!isCoreStyle && (
                  <div>
                    <button
                      onClick={() => {
                        const next = { ...local };
                        delete next[key];
                        persist(next);
                      }}
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
      })}

      {/* Backup Actions - Moved to end of interface */}
      <div>
        <button onClick={handleExport} className="tech-editor-export-btn">
          Export Backup
        </button>

        <button
          onClick={() =>
            document.getElementById("technique-import-input")?.click()
          }
          className="tech-editor-import-btn"
        >
          Import Backup
        </button>
      </div>

      {/* Hidden file input for import */}
      <input
        id="technique-import-input"
        type="file"
        accept=".json"
        onChange={handleImport}
      />

      {/* Reset Data - Moved to bottom */}
      <div className="tech-editor-reset-panel">
        <h3>
          Reset Data
        </h3>
        <p>
          This will restore the original set of techniques and remove any custom
          ones you have added. This action cannot be undone.
        </p>
        <div>
          <button onClick={resetToDefault} className="tech-editor-btn--reset">
            Reset to Default Techniques
          </button>
        </div>
      </div>
    </div>
  );
}
