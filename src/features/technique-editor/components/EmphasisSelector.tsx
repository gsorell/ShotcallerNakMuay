import React from "react";

import type { EmphasisKey, TechniquesShape } from "@/types"; // Adjust path to types
import { ImageWithFallback } from "../../shared";

interface EmphasisSelectorProps {
  emphasisList: any[]; // You can type this strictly based on your emphasisList definition
  selectedEmphases: Record<EmphasisKey, boolean>;
  toggleEmphasis: (k: EmphasisKey) => void;
  techniques: TechniquesShape;
  showAllEmphases: boolean;
  setShowAllEmphases: React.Dispatch<React.SetStateAction<boolean>>;
  onManageTechniques: () => void;
}

export const EmphasisSelector: React.FC<EmphasisSelectorProps> = ({
  emphasisList,
  selectedEmphases,
  toggleEmphasis,
  techniques,
  showAllEmphases,
  setShowAllEmphases,
  onManageTechniques,
}) => {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ textAlign: "center", position: "relative" }}>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: "bold",
            color: "white",
            margin: "0 0 1rem 0",
          }}
        >
          Choose Your Fighting Style
        </h2>
        <p style={{ color: "#f9a8d4", fontSize: "0.875rem", margin: 0 }}>
          Select one or more styles to get started.
        </p>
      </div>
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "60rem",
          margin: "0 auto",
        }}
      >
        <div
          className="emphasis-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
            maxWidth: "60rem",
            margin: "0 auto",
          }}
        >
          {(showAllEmphases ? emphasisList : emphasisList.slice(0, 9)).map(
            (style) => {
              const isSelected = selectedEmphases[style.key as EmphasisKey];
              return (
                <button
                  key={style.key}
                  type="button"
                  onClick={() => toggleEmphasis(style.key as EmphasisKey)}
                  style={{
                    position: "relative",
                    padding: "1.5rem",
                    borderRadius: "1rem",
                    border: isSelected
                      ? "2px solid #60a5fa"
                      : "2px solid rgba(255,255,255,0.2)",
                    minHeight: "140px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    backgroundColor: isSelected
                      ? "#2563eb"
                      : "rgba(255,255,255,0.1)",
                    color: "white",
                    boxShadow: isSelected
                      ? "0 10px 25px rgba(37,99,235,0.25)"
                      : "none",
                    transform: isSelected ? "scale(1.02)" : "scale(1)",
                  }}
                  onMouseUp={(e) => e.currentTarget.blur()}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <ImageWithFallback
                          srcPath={style.iconPath}
                          alt={style.label}
                          emoji={style.emoji}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 8,
                            objectFit: "cover",
                            display: "inline-block",
                          }}
                        />
                        <h3
                          style={{
                            fontSize: "1.125rem",
                            fontWeight: 700,
                            margin: 0,
                          }}
                        >
                          {techniques[style.key]?.title?.trim() || style.label}
                        </h3>
                      </div>
                      {style.desc && (
                        <p
                          style={{
                            color: "#f9a8d4",
                            margin: 0,
                            fontSize: "0.875rem",
                          }}
                        >
                          {style.desc}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            }
          )}
        </div>

        {/* More/Less Button Logic */}
        {emphasisList.length > 9 && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "1rem",
              paddingRight: "0.5rem",
            }}
          >
            <button
              type="button"
              onClick={() => setShowAllEmphases((v) => !v)}
              style={{
                padding: ".75rem 1rem",
                borderRadius: "1rem",
                border: "none",
                backgroundColor: "transparent",
                color: "#f9a8d4",
                boxShadow: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                fontWeight: 500,
                fontSize: "0.95rem",
                transition: "all 0.2s",
                cursor: "pointer",
                minWidth: 0,
                opacity: 1,
              }}
            >
              {showAllEmphases ? "Less" : "More"}
              <span
                style={{
                  display: "inline-block",
                  transition: "transform 0.2s",
                  fontSize: "1.1em",
                  marginLeft: 2,
                  transform: showAllEmphases
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                }}
              >
                ▼
              </span>
            </button>
          </div>
        )}

        {/* Manage Techniques Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginTop: "0.5rem",
            minHeight: "48px",
            width: "100%",
          }}
        >
          <button
            onClick={onManageTechniques}
            style={{
              padding: ".875rem 1.25rem",
              borderRadius: "1rem",
              border: "1px solid rgba(255,255,255,0.2)",
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "#f9a8d4",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 500,
              fontSize: "0.95rem",
              transition: "all 0.2s ease",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            <img
              src="/assets/icon_edit.png"
              alt=""
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                objectFit: "cover",
              }}
              aria-hidden="true"
            />
            <span>Manage Techniques</span>
          </button>
        </div>
      </div>
    </section>
  );
};
