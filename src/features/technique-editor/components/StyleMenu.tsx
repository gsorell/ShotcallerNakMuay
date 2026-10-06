import { useEffect, useRef, useState } from "react";

export type StyleMenuItem = {
  label: string;
  /** A single glyph shown ahead of the label. */
  icon: string;
  onSelect: () => void;
  /** Sets the item apart, last and in red: it removes or overwrites work. */
  destructive?: boolean;
};

type StyleMenuProps = {
  /** The style's name, for the button's accessible label. */
  styleName: string;
  items: StyleMenuItem[];
};

/**
 * The "more actions" menu on a style's row: everything you can do TO a style,
 * as opposed to opening it or moving it.
 *
 * Share and Duplicate began as two bare glyphs on the row, which made it
 * crowded, then became links inside the open style, where they were tidy and
 * easy to miss. This is the usual answer to that pair of problems: one
 * familiar control on every row, open or closed, with the actions spelled out
 * behind it.
 */
export default function StyleMenu({ styleName, items }: StyleMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // A tap anywhere else closes it. Pointer-down rather than click, so the menu
  // is gone before whatever was tapped reacts.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="tech-editor-menu"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          // This page also listens for Escape, to go back. Closing a menu
          // must not take the whole screen with it.
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="tech-editor-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${styleName}`}
        title="More actions"
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="13" cy="8" r="1.4" />
        </svg>
      </button>

      {open && (
        <div className="tech-editor-menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`tech-editor-menu-item ${
                item.destructive ? "is-destructive" : ""
              }`}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <span className="tech-editor-menu-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
