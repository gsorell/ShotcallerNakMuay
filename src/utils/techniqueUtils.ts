import { type TechniqueEntry } from "@/constants/techniques";
import {
  type EmphasisKey,
  type TechniquesShape,
  type TechniqueWithStyle,
} from "@/types";

export type TechniqueShape = {
  label: string;
  title?: string;
  singles?: TechniqueEntry[];
  combos?: TechniqueEntry[];
  techniques?: Record<string, any>;
  description?: string;
};

export function humanizeKey(k: string) {
  if (!k) return k;
  return k
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeTechniques(
  src: Record<string, Partial<TechniqueShape>>
) {
  const out: Record<string, TechniqueShape> = {};
  Object.entries(src || {}).forEach(([key, g]) => {
    const label = (g?.label ?? g?.title ?? key) as string; // always a string
    let title = (g?.title ?? g?.label ?? humanizeKey(key)) as string;
    // Defensive: if label/title are the raw key (likely coming from an incomplete save), humanize it
    let finalLabel = label;
    if (finalLabel === key) finalLabel = humanizeKey(key);
    if (title === key) title = humanizeKey(key);
    out[key] = { ...(g as any), label: finalLabel, title } as TechniqueShape;
  });
  return out;
}

export function normalizeArray(
  arr: any[] | undefined
): { text: string; favorite?: boolean; weight?: number }[] {
  if (!arr) return [];
  return arr.map((item) =>
    typeof item === "string"
      ? { text: item }
      : {
          text: item.text ?? "",
          favorite: !!item.favorite,
          // Carried through so editing a list does not quietly flatten a
          // weighting the style depends on.
          ...(typeof item.weight === "number" ? { weight: item.weight } : {}),
        }
  );
}

export function denormalizeArray(
  arr: { text: string; favorite?: boolean; weight?: number }[]
): TechniqueEntry[] {
  // Collapse back to plain strings only when there is nothing else to keep.
  if (arr.every((item) => !item.favorite && item.weight === undefined)) {
    return arr.map((item) => item.text);
  }
  return arr.map((item) =>
    item.favorite || item.weight !== undefined
      ? {
          text: item.text,
          ...(item.favorite ? { favorite: true } : {}),
          ...(item.weight !== undefined ? { weight: item.weight } : {}),
        }
      : item.text
  );
}

// Normalize keys for stable lookups: lowercase, convert runs of non-alphanum to underscore, trim underscores.
export const normalizeKey = (k: string) =>
  k
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

type WeightedTechnique = TechniqueWithStyle & { weight: number };

/** A starred technique is called about twice as often, unless it says otherwise. */
const FAVORITE_WEIGHT = 2;
/**
 * Ceiling on any single entry. A typo (`weight: 500`) would otherwise flood the
 * pool so completely that nothing else is ever called.
 */
const MAX_WEIGHT = 6;

export function entryWeight(entry: unknown): number {
  if (typeof entry === "string" || !entry) return 1;
  const raw = (entry as { weight?: unknown }).weight;
  const explicit = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(explicit) && explicit >= 1) {
    return Math.min(MAX_WEIGHT, Math.round(explicit));
  }
  return (entry as { favorite?: boolean }).favorite ? FAVORITE_WEIGHT : 1;
}

export const generateTechniquePool = (
  techniques: TechniquesShape,
  selectedEmphases: Record<EmphasisKey, boolean>,
  addCalisthenics: boolean,
  techniqueIndex: Record<string, string>
): TechniqueWithStyle[] => {
  if (selectedEmphases.timer_only || selectedEmphases.freestyle) return [];

  const enabled = (Object.entries(selectedEmphases) as [EmphasisKey, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);

  const keysToUse = enabled.length > 0 ? enabled : ["newb"];
  const pool: WeightedTechnique[] = [];

  const resolveStyle = (k: string) => {
    if (!techniques) return undefined;
    if (Object.prototype.hasOwnProperty.call(techniques, k)) {
      return (techniques as any)[k];
    }
    const norm = normalizeKey(k);
    const mappedKey =
      techniqueIndex[norm] ||
      techniqueIndex[k] ||
      techniqueIndex[k.toLowerCase()];
    if (
      mappedKey &&
      Object.prototype.hasOwnProperty.call(techniques, mappedKey)
    ) {
      return (techniques as any)[mappedKey];
    }
    const found = Object.keys(techniques).find(
      (candidate) => normalizeKey(candidate) === norm
    );
    if (found) return (techniques as any)[found];
    return undefined;
  };

  const extractStrings = (
    node: any,
    out: WeightedTechnique[],
    styleKey: string
  ) => {
    if (!node) return;
    if (typeof node === "string") {
      out.push({ text: node, style: styleKey, weight: 1 });
      return;
    }
    if (Array.isArray(node)) {
      for (const v of node) extractStrings(v, out, styleKey);
      return;
    }
    if (typeof node === "object") {
      for (const field of ["singles", "combos"] as const) {
        for (const entry of node[field] ?? []) {
          const text = typeof entry === "string" ? entry : entry?.text;
          if (typeof text !== "string") continue;
          out.push({ text, style: styleKey, weight: entryWeight(entry) });
        }
      }
      if (node.breakdown) extractStrings(node.breakdown, out, styleKey);
    }
  };

  for (const k of keysToUse) {
    const style = resolveStyle(k);
    if (!style) continue;
    extractStrings(style, pool, k);
  }

  if (addCalisthenics) {
    const cal = (techniques as any).calisthenics;
    if (cal) extractStrings(cal, pool, "calisthenics");
  }

  // Collapse duplicates, adding their weights together rather than throwing
  // the extras away. Writing a technique out three times used to have no
  // effect at all — the old dedupe kept the first and dropped the rest — so
  // the obvious way to say "call this more often" quietly did nothing.
  const byText = new Map<string, WeightedTechnique>();
  for (const item of pool) {
    if (!item || typeof item.text !== "string") continue;
    const text = item.text.trim();
    if (!text) continue;
    const existing = byText.get(text);
    if (existing) existing.weight += item.weight;
    else byText.set(text, { ...item, text });
  }

  // Expanded in passes rather than by repeating each entry back to back: a
  // pool read in order should still call everything once before it starts
  // repeating the weighted ones, not say "Left Check" three times running.
  const unique = [...byText.values()];
  const heaviest = unique.reduce((max, t) => Math.max(max, t.weight), 1);
  const out: TechniqueWithStyle[] = [];
  for (let pass = 0; pass < heaviest; pass += 1) {
    for (const item of unique) {
      if (item.weight > pass) out.push({ text: item.text, style: item.style });
    }
  }
  return out;
};
