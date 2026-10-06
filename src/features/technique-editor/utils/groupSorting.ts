import { INITIAL_TECHNIQUES } from "@/constants/techniques";
import type { TechniqueShape } from "@/utils/techniqueUtils";
import { CORE_ORDER } from "../constants";

import { applyDisplayOrder } from "./styleDisplayOrder";

/**
 * The styles as the Technique Manager lists them: the same order as the home
 * grid. `order` is the order the user has saved; empty means the shipped one.
 *
 * This page used to lead with the user's own styles, newest first, on the
 * grounds that it is for editing rather than picking. That had to give once
 * the order became something set here, a row at a time: moving a style up one
 * place only means anything if the list being moved through is the list the
 * home screen shows. A style just created is scrolled to instead (see
 * `handleAddGroup`), so it is still not hunted for.
 */
export function getSortedGroups(
  local: Record<string, TechniqueShape>,
  order: readonly string[] = []
): [string, TechniqueShape][] {
  const listed = (k: string) => k !== "calisthenics" && k !== "timer_only";
  const shipped = (k: string) =>
    Object.prototype.hasOwnProperty.call(INITIAL_TECHNIQUES, k);

  // Shipped styles in CORE_ORDER...
  const coreKeys = CORE_ORDER.filter((k) => listed(k) && !!local[k]);
  // ...any shipped style CORE_ORDER has not been told about...
  const otherCoreKeys = Object.keys(local).filter(
    (k) => listed(k) && shipped(k) && !CORE_ORDER.includes(k)
  );
  // ...then the user's own, newest first. That is carried by insertion order,
  // which `Object.keys` preserves — see `prependGroup`, which every path that
  // adds a style (create, duplicate, import) goes through.
  const userKeys = Object.keys(local).filter((k) => listed(k) && !shipped(k));

  // Freestyle is a mode: it has a row here but no tile, so it sits last and
  // takes no part in the order.
  const defaults = [
    ...coreKeys.filter((k) => k !== "freestyle"),
    ...otherCoreKeys,
    ...userKeys,
    ...coreKeys.filter((k) => k === "freestyle"),
  ].map((key) => ({ key }));

  return applyDisplayOrder(defaults, order).map(
    ({ key }) => [key, local[key]] as [string, TechniqueShape]
  );
}
