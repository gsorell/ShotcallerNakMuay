import React, { useState } from "react";

import type { EmphasisKey, TechniquesShape } from "@/types";
import { ImageWithFallback } from "../../shared";
import { TechniqueQuickEdit } from "./TechniqueQuickEdit";

interface EmphasisSelectorProps {
  emphasisList: any[];
  selectedEmphases: Record<EmphasisKey, boolean>;
  toggleEmphasis: (k: EmphasisKey) => void;
  techniques: TechniquesShape;
  setTechniques: (t: TechniquesShape) => void;
  showAllEmphases: boolean;
  setShowAllEmphases: React.Dispatch<React.SetStateAction<boolean>>;
  onManageTechniques: (groupKey?: string) => void;
}

const TILES_WITHOUT_TECHNIQUES = new Set(["timer_only", "freestyle"]);

export const EmphasisSelector: React.FC<EmphasisSelectorProps> = ({
  emphasisList,
  selectedEmphases,
  toggleEmphasis,
  techniques,
  setTechniques,
  showAllEmphases,
  setShowAllEmphases,
  onManageTechniques,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpanded = (key: string) =>
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));

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
            alignItems: "start",
          }}
        >
          {(showAllEmphases ? emphasisList : emphasisList.slice(0, 9)).map(
            (style) => {
              const isSelected = selectedEmphases[style.key as EmphasisKey];
              const isExpanded = !!expandedKeys[style.key];
              const canEdit = !TILES_WITHOUT_TECHNIQUES.has(style.key);
              return (
                <div
                  key={style.key}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => toggleEmphasis(style.key as EmphasisKey)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleEmphasis(style.key as EmphasisKey);
                    }
                  }}
                  style={{
                    position: "relative",
                    padding: "0.875rem 1rem",
                    borderRadius: "1rem",
                    border: isSelected
                      ? "2px solid #60a5fa"
                      : "2px solid rgba(255,255,255,0.2)",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "border 0.2s, background 0.2s, box-shadow 0.2s",
                    backgroundColor: isSelected
                      ? "#2563eb"
                      : "rgba(255,255,255,0.1)",
                    color: "white",
                    boxShadow: isSelected
                      ? "0 10px 25px rgba(37,99,235,0.25)"
                      : "none",
                  }}
                >
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(style.key);
                      }}
                      title={
                        isExpanded
                          ? "Hide techniques"
                          : "View & edit techniques"
                      }
                      aria-label={
                        isExpanded
                          ? `Hide techniques for ${style.label}`
                          : `View & edit techniques for ${style.label}`
                      }
                      aria-expanded={isExpanded}
                      style={{
                        position: "absolute",
                        top: "0.5rem",
                        right: "0.5rem",
                        width: "1.75rem",
                        height: "1.75rem",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "transparent",
                        border: "none",
                        color: "rgba(255,255,255,0.7)",
                        fontSize: "1rem",
                        lineHeight: 1,
                        cursor: "pointer",
                        padding: 0,
                        transition: "transform 0.2s",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                      }}
                    >
                      ▾
                    </button>
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.625rem",
                      paddingRight: canEdit ? "2rem" : 0,
                    }}
                  >
                    <ImageWithFallback
                      srcPath={style.iconPath}
                      alt={style.label}
                      emoji={style.emoji}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        objectFit: "cover",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3
                        style={{
                          fontSize: "1rem",
                          fontWeight: 700,
                          margin: 0,
                          lineHeight: 1.2,
                        }}
                      >
                        {techniques[style.key]?.title?.trim() || style.label}
                      </h3>
                      {style.desc && (
                        <p
                          style={{
                            color: "#f9a8d4",
                            margin: "0.125rem 0 0 0",
                            fontSize: "0.75rem",
                            lineHeight: 1.3,
                          }}
                        >
                          {style.desc}
                        </p>
                      )}
                    </div>
                  </div>

                  {canEdit && isExpanded && (
                    <TechniqueQuickEdit
                      groupKey={style.key}
                      techniques={techniques as any}
                      setTechniques={setTechniques as any}
                      onOpenFullEditor={() => onManageTechniques(style.key)}
                    />
                  )}
                </div>
              );
            }
          )}
        </div>

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
