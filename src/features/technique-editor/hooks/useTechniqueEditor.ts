import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import {
  denormalizeArray,
  humanizeKey,
  normalizeArray,
  normalizeTechniques,
  type TechniqueShape,
} from "@/utils/techniqueUtils";
import { downloadJSON } from "@/utils/fileUtils";
import { useEffect, useState } from "react";

interface UseTechniqueEditorProps {
  techniques: Record<string, TechniqueShape>;
  setTechniques: (t: Record<string, TechniqueShape>) => void;
}

export function useTechniqueEditor({
  techniques,
  setTechniques,
}: UseTechniqueEditorProps) {
  // start with normalized techniques so missing titles/labels are filled
  const [local, setLocal] = useState<Record<string, TechniqueShape>>(() =>
    normalizeTechniques(techniques)
  );

  // Sync local state when techniques prop changes
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
    next[groupKey] = { ...existing, description } as TechniqueShape;
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

  function addGroup(key: string): { ok: boolean; key?: string } {
    const k = key.trim();
    if (!k) return { ok: false };
    if (local[k]) {
      alert(`Group "${k}" already exists.`);
      return { ok: false };
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
    return { ok: true, key: k };
  }

  function duplicateGroup(key: string) {
    let base = local[key];
    if (!base) return { ok: false };
    let newKey = key + "_copy";
    let i = 2;
    while (local[newKey]) {
      newKey = key + `_copy${i++}`;
    }
    const baseTitle = base.title ?? base.label ?? humanizeKey(key);
    const next = { ...local };
    next[newKey] = {
      ...base,
      label: `${base.label} (Copy)`,
      title: `${baseTitle} (Copy)`,
    };
    persist(next);
    return { ok: true, key: newKey };
  }

  function deleteGroup(key: string) {
    if (key in INITIAL_TECHNIQUES) return; // Prevent deleting core groups
    const next = { ...local };
    delete next[key];
    persist(next);
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

  async function handleExport() {
    try {
      await downloadJSON(local, "techniques_backup");
    } catch (error) {
      console.error("Error exporting techniques:", error);
      alert("Failed to export backup. Please try again.");
    }
  }

  function handleImport(file: File) {
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
  }

  return {
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
    handleExport,
    handleImport,
  };
}
