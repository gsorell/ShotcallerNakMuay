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

    // Core group keys in preferred order. The first 9 are above the fold
    // (before the "More" toggle) and lead with the Muay Thai archetypes that
    // define the app's identity. Trailing tiles (timer_only/freestyle/newb)
    // are rendered separately at the end via TRAILING_KEYS.
    const CORE_ORDER: string[] = [
      // --- Above the fold (top 9) ---
      "meat_potatoes",
      "mat",
      "tae",
      "khao",
      "sok",
      "femur",
      "buakaw",
      "dutch_kickboxing",
      "two_piece",
      // --- Below the fold ---
      "low_kick_legends",
      "boxing",
      "ko_setups",
      "elbow_arsenal",
      "feints_and_fakeouts",
      "tricky_traps",
      "southpaw",
      // --- Trailing (filtered out and rendered separately) ---
      "timer_only",
      "freestyle",
      "newb",
    ];

    interface EmphasisConfig {
      label?: string;
      iconPath?: string;
      icon?: string;
      desc?: string;
    }

    // Special tiles that always appear regardless of technique data,
    // rendered at the end of the list.
    const TRAILING_KEYS = ["timer_only", "freestyle", "newb"];

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

    const trailingTiles = TRAILING_KEYS.map(buildSpecialTile);

    const coreGroups = CORE_ORDER.filter(
      (key) => !TRAILING_KEYS.includes(key) && techniqueKeys.includes(key)
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

    return [...coreGroups, ...userGroups, ...trailingTiles];
  }, [techniques]);
}
