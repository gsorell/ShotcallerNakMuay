import { useMemo } from "react";
import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import { BASE_EMPHASIS_CONFIG } from "@/emphasisConfig";
import { type TechniquesShape } from "@/types";

export function useEmphasisList(techniques: TechniquesShape) {
  return useMemo(() => {
    // Exclude calisthenics from the tile list
    const techniqueKeys = Object.keys(techniques || {}).filter(
      (k) => k !== "calisthenics"
    );

    // Core group keys in preferred order
    const CORE_ORDER: string[] = [
      "timer_only",
      "newb",
      "two_piece",
      "boxing",
      "mat",
      "tae",
      "khao",
      "sok",
      "femur",
      "southpaw",
      "meat_potatoes",
      "buakaw",
      "low_kick_legends",
      "elbow_arsenal",
      "ko_setups",
      "tricky_traps",
      "feints_and_fakeouts",
      "dutch_kickboxing",
    ];

    interface EmphasisConfig {
      label?: string;
      iconPath?: string;
      icon?: string;
      desc?: string;
    }

    // Always include timer_only as the first tile
    const timerOnlyTile = (() => {
      const key = "timer_only";
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
    })();

    const coreGroups = CORE_ORDER.filter(
      (key) => key !== "timer_only" && techniqueKeys.includes(key)
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

    return [timerOnlyTile, ...coreGroups, ...userGroups];
  }, [techniques]);
}
