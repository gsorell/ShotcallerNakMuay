import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { Page } from "@/types";
import {
  isStoreReviewSupported,
  markReviewDone,
  openStoreReviewPage,
} from "@/features/review";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import "./AppMenu.css";

type AppMenuProps = {
  page: Page;
  onNavigate: (page: Page) => void;
  onHelp: () => void;
  /** Current streak in days, shown beside Workout Logs. */
  streak?: number;
};

type Destination = {
  page: Page;
  label: string;
  hint: string;
};

// The app's places, in the order someone meets them: train, learn what to
// train, shape what gets called, look back at what was done.
const DESTINATIONS: Destination[] = [
  { page: "timer", label: "Train", hint: "Pick your styles and start a round" },
  { page: "learn", label: "Learn", hint: "Guided path and technique library" },
  {
    page: "editor",
    label: "Technique Manager",
    hint: "Edit styles or build your own",
  },
  { page: "logs", label: "Workout Logs", hint: "Your history and streak" },
];

/**
 * The one way to every place in the app, from every screen.
 *
 * Before this the app had no navigation of its own, so each destination was
 * given an entry point wherever there was room on the home screen: a stats
 * chip for the logs, a banner link and a card for Learn, a text link for the
 * Technique Manager, and a row of links in a footer under all of it. The home
 * screen's job is picking styles and starting; it was carrying the whole map
 * as well. Now the map lives here, and the home screen keeps only the one
 * destination it actively promotes — the Learn card.
 */
export default function AppMenu({
  page,
  onNavigate,
  onHelp,
  streak = 0,
}: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Where to hang the panel: just under the button, wherever the page has
  // scrolled it to. Measured on opening rather than assumed.
  const [anchor, setAnchor] = useState({ top: 0, right: 0 });

  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setAnchor({
        top: Math.max(8, rect.bottom + 8),
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setOpen((v) => !v);
  };

  // Several screens listen for Escape to go back. With the menu open, Escape
  // closes the menu and nothing else — caught on the way down, before any of
  // them hears it.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  const go = (destination: Page) => {
    setOpen(false);
    try {
      trackEvent("menu_navigate", { destination, from: page });
    } catch { /* analytics must never break the navigation it measures */ }
    onNavigate(destination);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="app-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        onClick={toggle}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            className="app-menu-backdrop"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <nav
              className="app-menu"
              role="menu"
              aria-label="App"
              style={{ top: anchor.top, right: anchor.right }}
              onClick={(e) => e.stopPropagation()}
            >
              {DESTINATIONS.map((d) => (
                <button
                  key={d.page}
                  type="button"
                  role="menuitem"
                  className={`app-menu-item ${
                    d.page === page ? "is-current" : ""
                  }`}
                  aria-current={d.page === page ? "page" : undefined}
                  onClick={() => go(d.page)}
                >
                  <span className="app-menu-text">
                    <span className="app-menu-label">{d.label}</span>
                    <span className="app-menu-hint">{d.hint}</span>
                  </span>
                  {d.page === "logs" && streak > 0 && (
                    <span
                      className="app-menu-streak"
                      aria-label={`${streak} day streak`}
                    >
                      🔥 {streak}
                    </span>
                  )}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                className="app-menu-item app-menu-item--help"
                onClick={() => {
                  setOpen(false);
                  onHelp();
                }}
              >
                <span className="app-menu-text">
                  <span className="app-menu-label">Help</span>
                  <span className="app-menu-hint">How the app works</span>
                </span>
              </button>
              {/* Native only: the browser build has no listing of its own to
                  rate. Going to the store by hand also retires the automatic
                  ask — someone who came here to rate has been asked enough. */}
              {isStoreReviewSupported() && (
                <button
                  type="button"
                  role="menuitem"
                  className="app-menu-item app-menu-item--rate"
                  onClick={() => {
                    setOpen(false);
                    markReviewDone();
                    try {
                      trackEvent(AnalyticsEvents.ReviewStoreOpen, { from: page });
                    } catch { /* analytics must never break the tap it measures */ }
                    void openStoreReviewPage();
                  }}
                >
                  <span className="app-menu-text">
                    <span className="app-menu-label">Rate Shot Caller</span>
                    <span className="app-menu-hint">
                      It helps other fighters find it
                    </span>
                  </span>
                </button>
              )}
            </nav>
          </div>,
          document.body
        )}
    </>
  );
}
