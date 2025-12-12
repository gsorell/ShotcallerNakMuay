interface TechniqueItem {
  text: string;
  favorite?: boolean;
}

interface TechniqueListSectionProps {
  title: string;
  items: TechniqueItem[];
  readOnly: boolean;
  groupKey: string;
  kind: "single" | "combo";
  onChangeText: (idx: number, value: string) => void;
  onToggleFavorite: (idx: number) => void;
  onRemoveItem: (idx: number) => void;
  onAddItem: () => void;
}

export default function TechniqueListSection({
  title,
  items,
  readOnly,
  groupKey,
  kind,
  onChangeText,
  onToggleFavorite,
  onRemoveItem,
  onAddItem,
}: TechniqueListSectionProps) {
  return (
    <div>
      <h4 className="tech-editor-section-header">
        {title}
        <span className="tech-editor-count">({items.length})</span>
      </h4>
      <div>
        {items.map((item, idx) => (
          <div key={idx} className="tech-editor-item">
            <input
              id={`${kind}-${groupKey}-${idx}`}
              type="text"
              value={item.text}
              onChange={(e) => !readOnly && onChangeText(idx, e.target.value)}
              className="tech-editor-input tech-editor-input--item"
              placeholder={`e.g., ${title === "Combos" ? "1, 2, 3" : "jab"}`}
              aria-label={`${title} technique ${idx + 1}`}
              readOnly={readOnly}
              tabIndex={readOnly ? -1 : 0}
            />
            <button
              onClick={() => onToggleFavorite(idx)}
              className={`tech-editor-btn--star ${
                item.favorite ? "is-active" : ""
              }`}
              aria-label={item.favorite ? "Unstar" : "Star"}
              title={item.favorite ? "Unstar (favorite)" : "Star (favorite)"}
            >
              ★
            </button>
            {!readOnly && (
              <button
                onClick={() => onRemoveItem(idx)}
                className="tech-editor-btn tech-editor-btn--delete"
                aria-label="Delete item"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <button onClick={onAddItem} className="tech-editor-btn--add">
          Add {title.slice(0, -1)}
        </button>
      )}
    </div>
  );
}
