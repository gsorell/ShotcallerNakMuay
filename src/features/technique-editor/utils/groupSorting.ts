import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import type { TechniqueShape } from "@/utils/techniqueUtils";
import { CORE_ORDER } from "../constants";

export function getSortedGroups(
  local: Record<string, TechniqueShape>
): [string, TechniqueShape][] {
  // User-created groups: not in INITIAL_TECHNIQUES and not 'calisthenics' or 'timer_only'
  const userGroups = Object.entries(local).filter(
    ([k]) =>
      !Object.prototype.hasOwnProperty.call(INITIAL_TECHNIQUES, k) &&
      k !== "calisthenics" &&
      k !== "timer_only"
  );

  // Core groups in correct order, EXCLUDING 'timer_only'
  const coreGroups = CORE_ORDER.filter((k) => k !== "timer_only")
    .map((k) => [k, local[k]] as [string, TechniqueShape])
    .filter(([, v]) => !!v);

  // Any other core groups not in CORE_ORDER (fallback), EXCLUDING 'timer_only'
  const otherCoreGroups = Object.entries(local).filter(
    ([k]) =>
      Object.prototype.hasOwnProperty.call(INITIAL_TECHNIQUES, k) &&
      !CORE_ORDER.includes(k) &&
      k !== "calisthenics" &&
      k !== "timer_only"
  );

  // Final sorted group list for the Technique Manager (NO timer_only)
  return [...userGroups, ...coreGroups, ...otherCoreGroups];
}
