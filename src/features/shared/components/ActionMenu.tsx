import { useEffect, useRef, useState } from "react";
import "./ActionMenu.css";

export type ActionMenuItem = {
  label: string;
  /** A single glyph shown ahead of the label. */
  icon: string;
  onSelect: () => void;
  /** Sets the item apart, last and in red: it removes or overwrites work. */
  destructive?: boolean;
};

type ActionMenuProps = {
  /** What the menu acts on, for the button's accessible label. */
  subject: string;
  items: ActionMenuItem[];
};

/**
 * The "more actions" menu on a row: everything you can do TO the thing the
 * row stands for, as opposed to opening it.
 *
 * One familiar control at the trailing edge of a row, with the actions spelled
 * out behind it. It is what keeps a row from collecting a button for each
 * thing that can be done to it — a style's row on the Technique Manager and a
 * session's row in the Workout Logs both use it, so the same gesture means the
 * same thing in both places.
 */
export default function ActionMenu({ subject, items }: ActionMenuProps) {
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
      className="action-menu"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          // Some pages also listen for Escape, to go back. Closing a menu
          // must not take the whole screen with it.
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="action-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${subject}`}
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
        <div className="action-menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`action-menu-item ${
                item.destructive ? "is-destructive" : ""
              }`}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <span className="action-menu-icon" aria-hidden="true">
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
