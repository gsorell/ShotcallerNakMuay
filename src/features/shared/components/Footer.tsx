import { scrollContentToTop } from "@/utils/scroll";
import "./Footer.css";

export type FooterProps = {
  isActive: boolean;
  hasSelectedEmphasis: boolean;
  linkButtonStyle: any;
  setPage: any;
  /** Same handler the header uses — Help re-opens the intro. */
  onHelp: () => void;
};

/**
 * The foot of every page: the mark, and where to find the app elsewhere.
 *
 * It used to carry the app's navigation too — Learn, Workout Logs, Help — at
 * the very bottom of the longest screen in the app. That lives in the header
 * menu now, where it can be reached without scrolling.
 */
export const Footer = ({ setPage }: FooterProps) => (
  <footer className="app-footer">
    <div className="app-footer-content">
      <img
        src="/assets/logo_icon.webp"
        alt="Logo"
        className="app-footer-logo"
        onClick={() => {
          setPage("timer");
          scrollContentToTop();
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setPage("timer");
            scrollContentToTop();
          }
        }}
        role="button"
        aria-label="Go to home"
      />
      <a
        href="https://www.instagram.com/nakmuayshotcaller?igsh=dTh6cXE4YnZmNDc4"
        target="_blank"
        rel="noopener noreferrer"
        className="app-footer-social"
        aria-label="Instagram"
      >
        <img
          src="/assets/icon.instagram.webp"
          alt="Instagram"
        />
      </a>
    </div>
  </footer>
);
