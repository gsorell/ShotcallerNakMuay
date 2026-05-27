import React from "react";
import { normalizeArray, type TechniqueShape } from "@/utils/techniqueUtils";
import { useTechniqueEditor } from "../hooks/useTechniqueEditor";

interface TechniqueQuickEditProps {
  groupKey: string;
  techniques: Record<string, TechniqueShape>;
  setTechniques: (t: Record<string, TechniqueShape>) => void;
  onOpenFullEditor?: () => void;
}

export const TechniqueQuickEdit: React.FC<TechniqueQuickEditProps> = ({
  groupKey,
  techniques,
  setTechniques,
  onOpenFullEditor,
}) => {
  const {
    local,
    updateSingle,
    addSingle,
    removeSingle,
    toggleSingleFavorite,
    updateCombo,
    addCombo,
    removeCombo,
    toggleComboFavorite,
  } = useTechniqueEditor({ techniques, setTechniques });

  const group = local[groupKey];
  if (!group) return null;

  const singles = normalizeArray(group.singles);
  const combos = normalizeArray(group.combos);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      onClick={stop}
      onMouseDown={stop}
      style={{
        marginTop: "1rem",
        paddingTop: "1rem",
        borderTop: "1px solid rgba(255,255,255,0.15)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <Section
        title="Techniques"
        items={singles}
        placeholder="e.g., jab"
        onChange={(idx, v) => updateSingle(groupKey, idx, v)}
        onToggleFavorite={(idx) => toggleSingleFavorite(groupKey, idx)}
        onRemove={(idx) => removeSingle(groupKey, idx)}
        onAdd={() => addSingle(groupKey)}
      />
      <Section
        title="Combos"
        items={combos}
        placeholder="e.g., 1, 2, 3"
        onChange={(idx, v) => updateCombo(groupKey, idx, v)}
        onToggleFavorite={(idx) => toggleComboFavorite(groupKey, idx)}
        onRemove={(idx) => removeCombo(groupKey, idx)}
        onAdd={() => addCombo(groupKey)}
      />

      {onOpenFullEditor && (
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            onOpenFullEditor();
          }}
          style={openEditorBtnStyle}
        >
          Open in full editor →
        </button>
      )}
    </div>
  );
};

interface SectionProps {
  title: string;
  items: { text: string; favorite?: boolean }[];
  placeholder: string;
  onChange: (idx: number, value: string) => void;
  onToggleFavorite: (idx: number) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
}

const Section: React.FC<SectionProps> = ({
  title,
  items,
  placeholder,
  onChange,
  onToggleFavorite,
  onRemove,
  onAdd,
}) => (
  <div>
    <div style={sectionHeaderStyle}>
      <span>{title}</span>
      <span style={countStyle}>({items.length})</span>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      {items.map((item, idx) => (
        <div key={idx} style={rowStyle}>
          <input
            type="text"
            value={item.text}
            onChange={(e) => onChange(idx, e.target.value)}
            placeholder={placeholder}
            style={inputStyle}
            aria-label={`${title} ${idx + 1}`}
          />
          <button
            type="button"
            onClick={() => onToggleFavorite(idx)}
            title={item.favorite ? "Unfavorite" : "Favorite"}
            aria-label={item.favorite ? "Unfavorite" : "Favorite"}
            style={{
              ...iconBtnStyle,
              color: item.favorite ? "#fbbf24" : "rgba(255,255,255,0.5)",
            }}
          >
            {item.favorite ? "★" : "☆"}
          </button>
          <button
            type="button"
            onClick={() => onRemove(idx)}
            title="Remove"
            aria-label={`Remove ${title} ${idx + 1}`}
            style={{ ...iconBtnStyle, color: "rgba(255,255,255,0.6)" }}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={onAdd} style={addBtnStyle}>
        + Add {title.toLowerCase().replace(/s$/, "")}
      </button>
    </div>
  </div>
);

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "rgba(255,255,255,0.7)",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  marginBottom: "0.5rem",
};

const countStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 400,
  color: "rgba(255,255,255,0.4)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "0.5rem 0.625rem",
  borderRadius: "0.5rem",
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  fontSize: "0.875rem",
  outline: "none",
};

const iconBtnStyle: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  width: "1.75rem",
  height: "1.75rem",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "0.375rem",
  background: "rgba(255,255,255,0.06)",
  fontSize: "0.95rem",
  flexShrink: 0,
};

const addBtnStyle: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  marginTop: "0.25rem",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.5rem",
  border: "1px dashed rgba(255,255,255,0.25)",
  background: "transparent",
  color: "rgba(255,255,255,0.7)",
  fontSize: "0.8rem",
  fontWeight: 500,
  textAlign: "center",
};

const openEditorBtnStyle: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid rgba(96,165,250,0.4)",
  background: "rgba(96,165,250,0.1)",
  color: "#93c5fd",
  fontSize: "0.8rem",
  fontWeight: 500,
  textAlign: "center",
};
