import { useMemo } from "react";
import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import { BASE_EMPHASIS_CONFIG } from "@/emphasisConfig";
import { type TechniquesShape } from "@/types";
import { CORE_ORDER } from "../constants";

export function useEmphasisList(techniques: TechniquesShape) {
  return useMemo(() => {
    // Exclude calisthenics from the tile list
    const techniqueKeys = Object.keys(techniques || {}).filter(
      (k) => k !== "calisthenics"
    );

    interface EmphasisConfig {
      label?: string;
      iconPath?: string;
      icon?: string;
      desc?: string;
    }

    // Tiles that always appear regardless of the saved technique data, so a
    // user who deleted or renamed a group still has a usable starting point.
    //
    // Nak Muay Newb leads the grid rather than trailing it: it is the style a
    // beginner is meant to pick, so burying it under nine advanced archetypes
    // was working against the whole point of it.
    const LEADING_KEYS = ["newb"];
    const TRAILING_KEYS = ["timer_only", "freestyle"];
    const SPECIAL_KEYS = [...LEADING_KEYS, ...TRAILING_KEYS];

    const buildSpecialTile = (key: string) => {
      const config = (BASE_EMPHASIS_CONFIG[key] || {}) as EmphasisConfig;
      const technique = techniques[key] || INITIAL_TECHNIQUES[key];
      let label: string;

      if (
        technique?.title &&
        typeof technique.title === "string" &&
        technique.title.trim()
      ) {
        label = technique.title.trim();
      } else if (config.label) {
        label = config.label;
      } else {
        label = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())
          .replace(/\s*\(Copy\)$/i, "");
      }

      return {
        key,
        label,
        iconPath: config.iconPath || "/assets/icon_user.png",
        emoji: config.icon || "🎯",
        desc: config.desc || technique?.description || `Custom style: ${key}`,
      };
    };

    const leadingTiles = LEADING_KEYS.map(buildSpecialTile);
    const trailingTiles = TRAILING_KEYS.map(buildSpecialTile);

    const coreGroups = CORE_ORDER.filter(
      (key) => !SPECIAL_KEYS.includes(key) && techniqueKeys.includes(key)
    ).map((key) => {
      const config = (BASE_EMPHASIS_CONFIG[key] || {}) as EmphasisConfig;
      const technique = techniques[key];
      let label: string;
      if (
        technique?.title &&
        typeof technique.title === "string" &&
        technique.title.trim()
      ) {
        label = technique.title.trim();
      } else if (config.label) {
        label = config.label;
      } else {
        label = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())
          .replace(/\s*\(Copy\)$/i, "");
      }
      return {
        key,
        label,
        iconPath: config.iconPath || "/assets/icon_user.png",
        emoji: config.icon || "🎯",
        desc: config.desc || technique?.description || `Custom style: ${key}`,
      };
    });

    const userGroups = techniqueKeys
      .filter((key) => !CORE_ORDER.includes(key))
      .map((key) => {
        const technique = techniques[key];
        let label: string;
        if (
          technique?.title &&
          typeof technique.title === "string" &&
          technique.title.trim()
        ) {
          label = technique.title.trim();
        } else {
          label = key
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase())
            .replace(/\s*\(Copy\)$/i, "");
        }
        return {
          key,
          label,
          iconPath: "/assets/icon_user.png",
          emoji: "🎯",
          desc: technique?.description || `Custom style: ${key}`,
        };
      });

    return [...leadingTiles, ...coreGroups, ...userGroups, ...trailingTiles];
  }, [techniques]);
}
