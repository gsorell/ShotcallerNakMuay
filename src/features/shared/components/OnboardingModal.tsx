import React from "react";
import { createPortal } from "react-dom";
import "./OnboardingModal.css";

export const OnboardingModal: React.FC<{
  open: boolean;
  modalScrollPosition: number;
  linkButtonStyle: any;
  setPage: any;
  onClose: () => void;
}> = React.memo(
  ({ open, modalScrollPosition, linkButtonStyle, setPage, onClose }) => {
    const modalRef = React.useRef<HTMLDivElement>(null);

    const escHandler = React.useCallback(
      (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      },
      [onClose]
    );

    React.useEffect(() => {
      if (!open) return;
      window.addEventListener("keydown", escHandler);
      return () => window.removeEventListener("keydown", escHandler);
    }, [open, escHandler]);

    // Restore and save scroll position using global variable
    React.useLayoutEffect(() => {
      if (!open || !modalRef.current) return;

      // Restore scroll position immediately
      modalRef.current.scrollTop = modalScrollPosition;

      // Save scroll position on scroll
      const handleScroll = () => {
        if (modalRef.current) {
          modalScrollPosition = modalRef.current.scrollTop;
        }
      };

      modalRef.current.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      return () => {
        if (modalRef.current) {
          modalRef.current.removeEventListener("scroll", handleScroll);
        }
      };
    }, [open]);

    if (!open) return null;

    const modal = (
      <div
        role="dialog"
        aria-modal="true"
        onClick={onClose} // click backdrop to close
        ref={modalRef}
        className="onboarding-backdrop"
      >
        <div
          onClick={(e) => e.stopPropagation()} // prevent backdrop close when clicking content
          className="onboarding-content"
        >
          {/* ADD: Help icon at the top */}
          <div className="onboarding-header">
            <img
              src="/assets/icon_help.png"
              alt="Help"
              className="onboarding-icon"
            />
            <h3>How to Use Nak Muay Shot Caller</h3>
            <button onClick={onClose} className="onboarding-btn">
              Close
            </button>
          </div>

          {/* REPLACED: onboarding intro text */}
          <p className="onboarding-text">
            <span>
              <strong>
                Turn your shadowboxing and bagwork into dynamic, guided sessions
                with spoken techniques and timed rounds.
              </strong>{" "}
              Think of it as having a personal trainer right in your ear,
              helping you focus on reaction time and flow.
            </span>
            <span>
              <strong>
                This app assumes you already know the proper form for each
                strike.
              </strong>{" "}
              It does not provide feedback, so if you are unfamiliar with any of
              the techniques, it is highly recommended that you first learn them
              from a qualified coach.
            </span>
            <span>
              The on-screen text is there to help you get started and to
              double-check a technique if you miss a verbal cue.{" "}
              <strong>
                However, the goal is to train without looking at the screen
              </strong>
              , so you can keep your hands up and focus on responding to the
              verbal commands.
            </span>
            <span>
              This isn't a game to play on the subway -- it's a powerful tool
              designed to help take you to the next level -- so{" "}
              <strong>
                Let's Go!
              </strong>
            </span>
          </p>
          <div className="onboarding-features-title">
            Features:
          </div>
          <ul className="onboarding-list">
            <li>
              <strong>Guided Sessions:</strong>{" "}
              Just pick one or more emphases and a difficulty level to get
              started.
            </li>
            <li>
              <strong>
                Workout Customization:
              </strong>{" "}
              Want to create your own unique session?{" "}
              <button
                className="onboarding-btn"
                onClick={() => {
                  onClose();
                  setPage("editor");
                }}
                tabIndex={0}
                aria-label="Open Technique Editor"
              >
                Use the Technique Editor
              </button>{" "}
              to modify existing sets or build new ones from scratch.
            </li>
          </ul>
          {/* END REPLACEMENT */}

          <div className="onboarding-table-section">
            <h4>Glossary</h4>

            <div className="onboarding-table-container">
              <table className="onboarding-table">
                <thead>
                  <tr>
                    <th className="onboarding-th">
                      Term
                    </th>
                    <th className="onboarding-th">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "Jab (1)",
                      "A straight punch with the Left hand, used to gauge distance and set up other strikes.",
                    ],
                    [
                      "Cross (2)",
                      "A straight punch with the Right hand, thrown across the body for maximum power.",
                    ],
                    [
                      "Hook (3, 4)",
                      "A curved punch thrown with either hand, typically targeting the side of the opponent's head or body.",
                    ],
                    [
                      "Uppercut (5, 6)",
                      "A vertical punch thrown with either hand, traveling upward to target the opponent's chin or solar plexus.",
                    ],
                    [
                      "Elbow Strike (Sok)",
                      "A powerful close-range strike unique to Muay Thai. Elbows can be thrown horizontally, diagonally, vertically, or straight down and are often used when the opponent is in clinching range.",
                    ],
                    [
                      "Knee Strike (Khao)",
                      "A strike with the knee, often used in the clinch but can also be thrown from a distance. Knee strikes are a hallmark of Muay Thai and are very effective at close range.",
                    ],
                    [
                      "Roundhouse Kick (Tae Wiang)",
                      "The most common and powerful kick in Muay Thai, thrown with the shin. It can target the legs (low kick), body (mid kick), or head (high kick).",
                    ],
                    [
                      "Switch Kick",
                      "A variation of the roundhouse kick, where the fighter switches stance before delivering the kick.",
                    ],
                    [
                      "Teep (Push Kick)",
                      "A straight push kick used to maintain distance, disrupt rhythm, or knock an opponent off balance.",
                    ],
                    [
                      "Guard",
                      "The basic defensive stance, with hands high to protect the head.",
                    ],
                    [
                      "Clinch (Pam)",
                      "A grappling range where fighters hold onto each other; used for knees, elbows and sweeps.",
                    ],
                    [
                      "Block (Bang)",
                      "Using the shin, arms, or gloves to absorb or deflect an incoming strike.",
                    ],
                    [
                      "Parry",
                      "Using a hand to deflect a punch or kick to the side.",
                    ],
                    [
                      "Slip",
                      "Moving the head to the side to avoid a straight punch.",
                    ],
                    [
                      "Oley",
                      "A strategic, often evasive, defensive technique to establish an angle",
                    ],
                    [
                      'Roll (or "Shoulder Roll")',
                      "Ducking the head and using the shoulder to block a hook, allowing the punch to roll off the shoulder.",
                    ],
                    [
                      "Check",
                      "Lifting the shin to block an incoming roundhouse kick to the leg or body.",
                    ],
                  ].map(([term, desc]) => (
                    <tr key={term}>
                      <td className="onboarding-td">
                        <strong>{term}</strong>
                      </td>
                      <td className="onboarding-td">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Privacy Policy Link */}
          <div className="onboarding-privacy-section">
            <a
              href="https://github.com/gsorell/ShotcallerNakMuay/blob/main/PRIVACY_POLICY.md"
              target="_blank"
              rel="noopener noreferrer"
              className="onboarding-privacy-link"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    );

    const target = typeof document !== "undefined" ? document.body : null;
    if (!target) return null;
    return createPortal(modal, target);
  }
);
