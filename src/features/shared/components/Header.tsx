import React, { useEffect, useState } from "react";
import "./Header.css";

export interface HeaderProps {
  onHelp: () => void;
  onLogoClick?: () => void; // Add onLogoClick as an optional property
}

const Header: React.FC<HeaderProps> = ({ onHelp, onLogoClick }) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const logoRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.style.overscrollBehaviorY = "contain";

    // Mobile-specific: Continuously enforce no tap highlighting for button element
    const enforceNoHighlight = () => {
      if (logoRef.current) {
        logoRef.current.style.setProperty(
          "-webkit-tap-highlight-color",
          "transparent"
        );
        logoRef.current.style.setProperty(
          "-webkit-tap-highlight-color",
          "rgba(0,0,0,0)"
        );
        logoRef.current.style.setProperty(
          "-webkit-focus-ring-color",
          "transparent"
        );
        logoRef.current.style.background = "transparent";
        logoRef.current.style.backgroundColor = "transparent";
        logoRef.current.style.outline = "none";
        logoRef.current.style.boxShadow = "none";
        // Button-specific mobile properties
        logoRef.current.style.border = "none";
        logoRef.current.style.setProperty("-webkit-appearance", "none");
        logoRef.current.style.setProperty("-moz-appearance", "none");
      }
    };

    // Run immediately and set up less frequent interval
    enforceNoHighlight();
    const interval = setInterval(enforceNoHighlight, 1000);

    return () => {
      document.body.style.overscrollBehaviorY = "auto";
      clearInterval(interval);
    };
  }, []);


  const modalOverlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    zIndex: 50,
    padding: "1rem",
    overflowY: "auto",
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Get the target element and ensure it loses focus
    const target = e.currentTarget as HTMLElement;

    // Force CSS variables to transparent
    document.documentElement.style.setProperty("--logo-bg", "transparent");
    document.documentElement.style.setProperty(
      "--logo-highlight",
      "transparent"
    );

    // Multiple immediate cleanup attempts
    const cleanupElement = (element: HTMLElement) => {
      element.blur();
      element.style.outline = "none";
      element.style.boxShadow = "none";
      element.style.background = "transparent";
      element.style.backgroundColor = "transparent";
      element.style.setProperty("-webkit-tap-highlight-color", "transparent");
      element.style.setProperty("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
      element.style.setProperty("background", "transparent");
      element.style.setProperty("background-color", "transparent");
      // Force repaint
      element.style.transform = "translateZ(0)";
      element.classList.add("force-reset");
    };

    // Apply to both target and ref
    if (logoRef.current) {
      cleanupElement(logoRef.current);
    }
    if (target) {
      cleanupElement(target);
    }

    // Force removal of any active/focus classes and states
    if (
      document.activeElement &&
      (document.activeElement as HTMLElement).blur
    ) {
      (document.activeElement as HTMLElement).blur();
    }

    // Delayed cleanup - multiple attempts
    const delayedCleanup = () => {
      if (logoRef.current) {
        cleanupElement(logoRef.current);
      }
      if (target) {
        cleanupElement(target);
      }
    };

    // Multiple delayed cleanup attempts at different intervals
    setTimeout(delayedCleanup, 10);
    setTimeout(delayedCleanup, 50);
    setTimeout(delayedCleanup, 100);

    // Use requestAnimationFrame to ensure cleanup happens after browser paint
    requestAnimationFrame(() => {
      delayedCleanup();
      requestAnimationFrame(() => {
        delayedCleanup();
      });
    });

    setTimeout(() => {
      if (logoRef.current) {
        logoRef.current.classList.remove("force-reset");
      }
      if (target) {
        target.classList.remove("force-reset");
      }
    }, 400); // Increased from 200ms to 400ms

    // Small delay to ensure blur takes effect before callback
    setTimeout(() => {
      if (onLogoClick) {
        onLogoClick();
      }
    }, 50);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Additional cleanup on mouse up to ensure no persistent highlights
    const target = e.currentTarget as HTMLElement;
    if (target && target.blur) {
      target.blur();
      target.style.outline = "none";
      target.style.boxShadow = "none";
      target.style.background = "transparent";
      target.style.setProperty("-webkit-tap-highlight-color", "transparent");
    }
    if (logoRef.current) {
      logoRef.current.blur();
      logoRef.current.style.outline = "none";
      logoRef.current.style.boxShadow = "none";
      logoRef.current.style.background = "transparent";
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Additional cleanup on touch end for mobile devices
    // DON'T prevent default here - it blocks navigation
    // e.preventDefault(); // REMOVED - this was blocking navigation
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    if (target && target.blur) {
      target.blur();
      target.style.outline = "none";
      target.style.boxShadow = "none";
      target.style.background = "transparent";
      target.style.setProperty("-webkit-tap-highlight-color", "transparent");
      target.style.setProperty("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
      target.style.setProperty("background", "transparent");
      target.style.setProperty("background-color", "transparent");
    }
    if (logoRef.current) {
      logoRef.current.blur();
      logoRef.current.style.outline = "none";
      logoRef.current.style.boxShadow = "none";
      logoRef.current.style.background = "transparent";
      logoRef.current.style.setProperty(
        "-webkit-tap-highlight-color",
        "transparent"
      );
      logoRef.current.style.setProperty(
        "-webkit-tap-highlight-color",
        "rgba(0,0,0,0)"
      );
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent mobile highlighting from the start but DON'T prevent default
    // e.preventDefault(); // REMOVED - this was blocking navigation
    const target = e.currentTarget as HTMLElement;
    if (target) {
      target.style.setProperty("-webkit-tap-highlight-color", "transparent");
      target.style.setProperty("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
      target.style.background = "transparent";
    }
    if (logoRef.current) {
      logoRef.current.style.setProperty(
        "-webkit-tap-highlight-color",
        "transparent"
      );
      logoRef.current.style.setProperty(
        "-webkit-tap-highlight-color",
        "rgba(0,0,0,0)"
      );
    }
  };

  return (
    <>
      <header
        className="app-header"
      >
        <button
          ref={logoRef}
          type="button"
          className="logo"
          onClick={handleLogoClick}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          tabIndex={-1} // Prevent keyboard focus
          aria-label="Go to home page"
          onBlur={() => {
            // Additional cleanup when button loses focus
            if (logoRef.current) {
              logoRef.current.style.background = "transparent";
              logoRef.current.style.backgroundColor = "transparent";
              logoRef.current.style.outline = "none";
              logoRef.current.style.boxShadow = "none";
            }
          }}
        >
          <img
            src="/assets/Logo_Header_Banner_Smooth.png"
            alt="Shotcaller Nak Muay"
            style={{
              cursor: onLogoClick ? "pointer" : "default",
              width: "100%",
              height: "auto",
              maxHeight: "120px",
              objectFit: "contain",
              display: "block",
              // Prevent mobile focus/active states on image
              outline: "none",
              userSelect: "none",
              WebkitTapHighlightColor: "transparent",
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none",
              pointerEvents: "none", // Prevent image from being the target
            }}
          />
        </button>
      </header>
      {isHelpOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsHelpOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <HelpContent onClose={() => setIsHelpOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
};

export default Header;

interface HelpContentProps {
  onClose: () => void;
}

const HelpContent: React.FC<HelpContentProps> = ({ onClose }) => {
  const modalContent = {
    maxWidth: "48rem",
    width: "calc(100% - 2rem)",
    padding: "1.25rem 1.5rem",
    borderRadius: "0.75rem",
    background: "rgb(15, 23, 42)",
    color: "white",
    boxShadow: "rgba(0, 0, 0, 0.6) 0px 10px 30px",
  };

  const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
  };

  const h3Style = {
    margin: "0px",
    fontSize: "1.125rem",
  };

  const closeButtonStyle = {
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "8px",
    color: "rgb(249, 168, 212)",
    cursor: "pointer",
    fontWeight: 700,
    padding: "0.5rem 0.75rem",
    textAlign: "center" as const,
  };

  const pStyle = {
    color: "rgb(249, 168, 212)",
    margin: "0.5rem 0px",
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse" as const,
    color: "rgb(249, 168, 212)",
    fontSize: "0.9rem",
  };

  const thStyle = {
    textAlign: "left" as const,
    padding: "0.5rem 0.75rem",
    color: "rgb(255, 255, 255)",
    width: "28%",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  };

  const tdStyle = {
    padding: "0.5rem 0.75rem",
    verticalAlign: "top" as const,
  };

  const tdBoldStyle = { ...tdStyle, fontWeight: 700 };

  return (
    <div style={modalContent}>
      <div style={headerStyle}>
        <h3 style={h3Style}>How It Works</h3>
        <button style={closeButtonStyle} onClick={onClose}>
          Close
        </button>
      </div>
      <p style={{ ...pStyle, margin: "0.5rem 0px" }}>
        Turn your shadowboxing and bagwork into a guided session with spoken
        techniques and timed rounds. Focus on reaction and flow — just like a
        real trainer the app calls the strikes so you learn to respond
        automatically.
      </p>
      <p style={{ ...pStyle, margin: "0.25rem 0px 0px" }}>
        Pick 1 or more emphases, set a difficulty level, and get started!
      </p>
      <p style={{ ...pStyle, margin: "0.25rem 0px 0px" }}>---</p>
      <p style={{ ...pStyle, margin: "0.25rem 0px 0px" }}>
        Want to customize your own workout? Modify existing sets or create your
        own by maintaining groups, techniques, and combinations in the Technique
        Editor.
      </p>
      <div style={{ marginTop: "0.75rem" }}>
        <div style={headerStyle}></div>
        <h3
          style={{
            margin: "0px 0px 0.5rem",
            color: "#ffffff",
            textAlign: "left" as const,
          }}
        >
          Glossary
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Technique</th>
                <th
                  style={{
                    ...thStyle,
                    width: "auto",
                    color: "rgb(243, 232, 255)",
                  }}
                >
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdBoldStyle}>Jab (1)</td>
                <td style={tdStyle}>
                  A straight punch with the Left hand, used to gauge distance
                  and set up other strikes.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Cross (2)</td>
                <td style={tdStyle}>
                  A straight punch with the Right hand, thrown across the body
                  for maximum power.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Hook (3, 4)</td>
                <td style={tdStyle}>
                  A curved punch thrown with either hand, typically targeting
                  the side of the opponent's head or body.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Uppercut (5, 6)</td>
                <td style={tdStyle}>
                  A vertical punch thrown with either hand, traveling upward to
                  target the opponent's chin or solar plexus.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Elbow Strike (Sok)</td>
                <td style={tdStyle}>
                  A powerful close-range strike unique to Muay Thai. Elbows can
                  be thrown horizontally, diagonally, vertically, or straight
                  down and are often used when the opponent is in clinching
                  range.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Knee Strike (Khao)</td>
                <td style={tdStyle}>
                  A strike with the knee, often used in the clinch but can also
                  be thrown from a distance. Knee strikes are a hallmark of Muay
                  Thai and are very effective at close range.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Roundhouse Kick (Tae Wiang)</td>
                <td style={tdStyle}>
                  The most common and powerful kick in Muay Thai, thrown with
                  the shin. It can target the legs (low kick), body (mid kick),
                  or head (high kick).
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Switch Kick</td>
                <td style={tdStyle}>
                  A variation of the roundhouse kick, where the fighter switches
                  stance before delivering the kick.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Teep (Push Kick)</td>
                <td style={tdStyle}>
                  A straight push kick used to maintain distance, disrupt
                  rhythm, or knock an opponent off balance.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Guard</td>
                <td style={tdStyle}>
                  The basic defensive stance, with hands high to protect the
                  head.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Clinch (Pam)</td>
                <td style={tdStyle}>
                  A grappling range where fighters hold onto each other; used
                  for knees, elbows and sweeps.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Block (Bang)</td>
                <td style={tdStyle}>
                  Using the shin, arms, or gloves to absorb or deflect an
                  incoming strike.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Parry</td>
                <td style={tdStyle}>
                  Using a hand to deflect a punch or kick to the side.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Slip</td>
                <td style={tdStyle}>
                  Moving the head to the side to avoid a straight punch.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Roll (or "Shoulder Roll")</td>
                <td style={tdStyle}>
                  Ducking the head and using the shoulder to block a hook,
                  allowing the punch to roll off the shoulder.
                </td>
              </tr>
              <tr>
                <td style={tdBoldStyle}>Check</td>
                <td style={tdStyle}>
                  Lifting the shin to block an incoming roundhouse kick to the
                  leg or body.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
