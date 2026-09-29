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

  // The user's own styles lead, newest first; shipped styles follow in
  // CORE_ORDER.
  //
  // This page did briefly match the home grid's order instead (shipped first),
  // so that a given style sat in the same place on both screens. That is the
  // wrong trade here, because the two screens are for different jobs: the home
  // grid is for picking a workout, where Nak Muay Newb should lead for a
  // beginner, while this page is for editing your own styles — and burying a
  // style you just created under eighteen shipped ones means scrolling to find
  // the thing you are already looking at. `handleAddGroup` scrolling to the top
  // after a create only makes sense under this order, too.
  //
  // "Newest first" within the user's own styles is carried by insertion order,
  // which `Object.entries` preserves — see `prependGroup`, which every path
  // that adds a style (create, duplicate, import) goes through.
  return [...userGroups, ...coreGroups, ...otherCoreGroups];
}
