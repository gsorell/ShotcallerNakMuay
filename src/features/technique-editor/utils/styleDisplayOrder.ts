// ===========================================================================
// The order the user wants their styles in on the home screen.
// ---------------------------------------------------------------------------
// Without one, the grid follows CORE_ORDER with the user's own styles after
// it. With one, the saved list wins. It is a list of style keys and nothing
// else, kept apart from the technique data on purpose: it is a preference
// about one screen, and restoring or resetting the library should not have to
// know about it.
//
// A tiny external store rather than React state, because the list is written
// on the Technique Manager and read by the provider that builds the home
// grid, which sits well above it.
// ===========================================================================

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "style_display_order_v1";

// Modes rather than styles: they are not tiles in the grid, so they take no
// place in its order.
const MODE_KEYS = new Set(["timer_only", "freestyle"]);

const EMPTY: readonly string[] = Object.freeze([]);

function load(): readonly string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return EMPTY;
    const keys = parsed.filter((k): k is string => typeof k === "string" && !!k);
    return keys.length ? [...new Set(keys)] : EMPTY;
  } catch {
    return EMPTY;
  }
}

// Read lazily, so importing this module never touches storage by itself.
let current: readonly string[] | null = null;
const listeners = new Set<() => void>();

function snapshot(): readonly string[] {
  if (current === null) current = load();
  return current;
}

/** Save an order, or pass an empty list to go back to the default. */
export function saveStyleDisplayOrder(keys: readonly string[]): void {
  current = keys.length ? [...new Set(keys)] : EMPTY;
  try {
    if (current.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* a full or blocked store must not break the reorder */ }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** The saved order; empty when the user has never set one. */
export function useStyleDisplayOrder(): readonly string[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * One step up or down a list of style keys. Returns the same list when the
 * style is already at that end, or is not in it.
 */
export function moveStyleKey(
  keys: readonly string[],
  key: string,
  direction: "up" | "down"
): string[] {
  const from = keys.indexOf(key);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= keys.length) return [...keys];
  const next = [...keys];
  next[from] = next[to]!;
  next[to] = key;
  return next;
}

/** Whether a key is a mode (Timer Only, Freestyle) rather than a style. */
export const isModeKey = (key: string): boolean => MODE_KEYS.has(key);

/**
 * Put a list of styles into the saved order.
 *
 * A style the saved order has never heard of — one made, imported or shipped
 * since it was saved — goes to the front, where it will be noticed, rather
 * than to the end of a list the user arranged by hand. The modes keep their
 * place at the end whatever the order says.
 */
export function applyDisplayOrder<T extends { key: string }>(
  items: readonly T[],
  order: readonly string[]
): T[] {
  if (!order.length) return [...items];
  const styles = items.filter((item) => !MODE_KEYS.has(item.key));
  const modes = items.filter((item) => MODE_KEYS.has(item.key));
  const byKey = new Map(styles.map((item) => [item.key, item]));
  // De-duplicated here as well as on load: a key listed twice would otherwise
  // put the same tile on the screen twice.
  const placed = [...new Set(order)]
    .map((key) => byKey.get(key))
    .filter((item): item is T => item !== undefined);
  const placedKeys = new Set(placed.map((item) => item.key));
  const unplaced = styles.filter((item) => !placedKeys.has(item.key));
  return [...unplaced, ...placed, ...modes];
}
