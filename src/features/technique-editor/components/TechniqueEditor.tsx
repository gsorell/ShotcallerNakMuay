import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import "@/styles/editor.css";
import { trackEvent } from "@/utils/analytics";
import { type TechniqueShape as UtilsTechniqueShape } from "@/utils/techniqueUtils";
import { scrollContentToTop } from "@/utils/scroll";
import React, { useRef, useState } from "react";
import { useEntitlement } from "@/features/entitlement";
import { usePaywall } from "@/features/paywall";
import { useUIContext } from "../../shared";
import { useTechniqueEditor } from "../hooks/useTechniqueEditor";
import { getSortedGroups } from "../utils/groupSorting";
import "./TechniqueEditor.css";
import TechniqueGroupPanel from "./TechniqueGroupPanel";

type TechniqueDetail = {
  name: string;
  combo: string;
};

export interface TechniqueShape extends UtilsTechniqueShape {
  techniques?: Record<string, TechniqueDetail>;
}

// helper: create a readable title from a short key
// helpers imported from utils/techniqueUtils

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
  const {
    local,
    updateGroupLabel,
    updateGroupDescription,
    updateSingle,
    toggleSingleFavorite,
    addSingle,
    removeSingle,
    updateCombo,
    toggleComboFavorite,
    addCombo,
    removeCombo,
    addGroup,
    duplicateGroup,
    deleteGroup,
    resetToDefault,
    resetGroupToDefault,
    handleExport,
    handleImport,
  } = useTechniqueEditor({ techniques, setTechniques });

  const { editorFocusKey, setEditorFocusKey } = useUIContext();
  const { isPro } = useEntitlement();
  const { openPaywall } = usePaywall();

  // "View free, edit locked": the editor renders normally so free users can
  // browse every style and technique, but any mutating action opens the
  // paywall instead of applying. `guard` wraps a handler with that gate.
  const guard = React.useCallback(
    <T extends unknown[]>(fn: (...args: T) => unknown) =>
      (...args: T): void => {
        if (!isPro) {
          openPaywall("technique_editor");
          return;
        }
        fn(...args);
      },
    [isPro, openPaywall]
  );

  const [newGroupName, setNewGroupName] = useState("");

  // --- NEW: Scroll to top on group creation/duplication ---
  const topRef = useRef<HTMLDivElement>(null);
  const scrollToTop = React.useCallback(() => {
    setTimeout(() => {
      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: "auto", block: "start" });
      } else {
        scrollContentToTop("auto");
      }
    }, 0);
  }, [topRef]);

  // --- MODIFIED: Add group and scroll to top ---
  const handleAddGroup = (key: string) => {
    if (!isPro) {
      openPaywall("technique_editor");
      return;
    }
    const result = addGroup(key);
    if (result.ok && result.key) {
      // Expand the newly created group so user can immediately start adding techniques
      setExpandedGroups((prev) => ({ ...prev, [result.key!]: true }));
      setNewGroupName("");
      scrollToTop();
      trackEvent("custom_group_created", { group_name: key });
    }
  };

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

  const handleImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isPro) {
        openPaywall("technique_editor");
      } else {
        handleImport(file);
      }
    }
    e.target.value = "";
  };

  // --- NEW: Group sorting logic ---
  const sortedGroups: [string, TechniqueShape][] = React.useMemo(
    () => getSortedGroups(local),
    [local]
  );

  // --- NEW: Track expanded/collapsed state for each group ---
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );

  const toggleGroupExpanded = React.useCallback((key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, [setExpandedGroups]);

  // Deep-link: if a focus key was set before navigating here, expand that group
  // and scroll its panel into view, then clear the focus key so it doesn't fire again.
  React.useEffect(() => {
    if (!editorFocusKey) return;
    if (!local[editorFocusKey]) {
      setEditorFocusKey(null);
      return;
    }
    setExpandedGroups((prev) => ({ ...prev, [editorFocusKey]: true }));
    const id = window.setTimeout(() => {
      const el = document.getElementById(`group-panel-${editorFocusKey}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setEditorFocusKey(null);
    }, 50);
    return () => window.clearTimeout(id);
  }, [editorFocusKey, local, setEditorFocusKey]);

  // --- MODIFIED: Duplicate any group (core or user-created) and scroll to top ---
  const handleDuplicateGroup = React.useCallback(
    (key: string) => {
      if (!isPro) {
        openPaywall("technique_editor");
        return;
      }
      const result = duplicateGroup(key);
      if (result.ok && result.key) {
        setExpandedGroups((prev) => ({ ...prev, [result.key!]: true }));
        scrollToTop();
      }
    },
    [duplicateGroup, setExpandedGroups, scrollToTop, isPro, openPaywall]
  );

  // Memoized callback factories to prevent re-renders
  const getDuplicateHandler = React.useCallback(
    (key: string) => () => handleDuplicateGroup(key),
    [handleDuplicateGroup]
  );
  const getToggleHandler = React.useCallback(
    (key: string) => () => toggleGroupExpanded(key),
    [toggleGroupExpanded]
  );

  return (
    <div ref={topRef} className="tech-editor-container">
      {/* Top-left Back button, visually aligned and not overlapping */}
      {onBack && (
        <div className="tech-editor-back-row">
          <button
            type="button"
            onClick={onBack}
            className="back-link"
            title="Back to Training (Esc)"
          >
            <span className="back-link-arrow" aria-hidden="true">
              ←
            </span>
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

      {!isPro && (
        <div
          className="tech-editor-panel"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <span>
            🔒 You're viewing in read-only mode. Editing techniques and creating
            styles is a Pro feature.
          </span>
          <button
            type="button"
            onClick={() => openPaywall("technique_editor_banner")}
            className="tech-editor-btn--create"
          >
            Unlock Pro
          </button>
        </div>
      )}

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
            onClick={() => handleAddGroup(newGroupName)}
            className="tech-editor-btn--create"
          >
            Create Style
          </button>
        </div>
      </div>

      {/* --- Render all groups using TechniqueGroupPanel --- */}
      {sortedGroups.map(([key, group]) => {
        const isCoreStyle = Object.keys(INITIAL_TECHNIQUES).includes(key);
        const expanded = !!expandedGroups[key];
        return (
          <TechniqueGroupPanel
            key={key}
            keyName={key}
            group={group}
            isCoreStyle={isCoreStyle}
            onDuplicate={
              key !== "timer_only" ? getDuplicateHandler(key) : undefined
            }
            expanded={expanded}
            toggleGroupExpanded={getToggleHandler(key)}
            updateGroupLabel={guard((label: string) =>
              updateGroupLabel(key, label)
            )}
            updateGroupDescription={guard((desc: string) =>
              updateGroupDescription(key, desc)
            )}
            onChangeSingle={guard((idx: number, value: unknown) =>
              updateSingle(key, idx, value as never)
            )}
            onToggleSingleFavorite={guard((idx: number) =>
              toggleSingleFavorite(key, idx)
            )}
            onRemoveSingle={guard((idx: number) => removeSingle(key, idx))}
            onAddSingle={guard(() => addSingle(key))}
            onChangeCombo={guard((idx: number, value: unknown) =>
              updateCombo(key, idx, value as never)
            )}
            onToggleComboFavorite={guard((idx: number) =>
              toggleComboFavorite(key, idx)
            )}
            onRemoveCombo={guard((idx: number) => removeCombo(key, idx))}
            onAddCombo={guard(() => addCombo(key))}
            onDeleteGroup={guard(() => deleteGroup(key))}
            onResetGroup={guard(() => resetGroupToDefault(key))}
          />
        );
      })}

      {/* Backup Actions - Moved to end of interface */}
      <div className="tech-editor-backup-actions">
        <button onClick={handleExport} className="tech-editor-export-btn">
          Export Backup
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="tech-editor-import-btn"
        >
          Import Backup
        </button>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportChange}
        style={{ display: "none" }}
      />

      {/* Reset Data - Moved to bottom */}
      <div className="tech-editor-reset-panel">
        <h3>Reset Data</h3>
        <p>
          This will restore the original set of techniques and remove any custom
          ones you have added. This action cannot be undone.
        </p>
        <div>
          <button
            onClick={guard(resetToDefault)}
            className="tech-editor-btn--reset"
          >
            Reset to Default Techniques
          </button>
        </div>
      </div>
    </div>
  );
}
