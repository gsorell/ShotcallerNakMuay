import {
  type EmphasisKey,
  type TechniquesShape,
  type TechniqueWithStyle,
} from "@/types";

export type TechniqueShape = {
  label: string;
  title?: string;
  singles?: (string | { text: string; favorite?: boolean })[];
  combos?: (string | { text: string; favorite?: boolean })[];
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
): { text: string; favorite?: boolean }[] {
  if (!arr) return [];
  return arr.map((item) =>
    typeof item === "string"
      ? { text: item }
      : { text: item.text ?? "", favorite: !!item.favorite }
  );
}

export function denormalizeArray(
  arr: { text: string; favorite?: boolean }[]
): (string | { text: string; favorite?: boolean })[] {
  if (arr.every((item) => !item.favorite)) return arr.map((item) => item.text);
  return arr;
}

// Normalize keys for stable lookups: lowercase, convert runs of non-alphanum to underscore, trim underscores.
export const normalizeKey = (k: string) =>
  k
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const generateTechniquePool = (
  techniques: TechniquesShape,
  selectedEmphases: Record<EmphasisKey, boolean>,
  addCalisthenics: boolean,
  techniqueIndex: Record<string, string>
): TechniqueWithStyle[] => {
  if (selectedEmphases.timer_only) return [];

  const enabled = (Object.entries(selectedEmphases) as [EmphasisKey, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);

  const keysToUse = enabled.length > 0 ? enabled : ["newb"];
  const pool: TechniqueWithStyle[] = [];

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
    out: TechniqueWithStyle[],
    styleKey: string
  ) => {
    if (!node) return;
    if (typeof node === "string") {
      out.push({ text: node, style: styleKey });
      return;
    }
    if (Array.isArray(node)) {
      for (const v of node) extractStrings(v, out, styleKey);
      return;
    }
    if (typeof node === "object") {
      if (node.singles) {
        for (const single of node.singles) {
          if (typeof single === "string") {
            out.push({ text: single, style: styleKey });
          } else if (single && typeof single.text === "string") {
            out.push({ text: single.text, style: styleKey });
            if (single.favorite && Math.random() < 0.35)
              out.push({ text: single.text, style: styleKey });
          }
        }
      }
      if (node.combos) {
        for (const combo of node.combos) {
          if (typeof combo === "string") {
            out.push({ text: combo, style: styleKey });
          } else if (combo && typeof combo.text === "string") {
            out.push({ text: combo.text, style: styleKey });
            if (combo.favorite && Math.random() < 0.35)
              out.push({ text: combo.text, style: styleKey });
          }
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

  // Deduplication logic
  const cleanedMap = new Map<string, TechniqueWithStyle>();
  for (const item of pool) {
    if (item && item.text && typeof item.text === "string") {
      const cleanText = item.text.trim();
      if (cleanText && !cleanedMap.has(cleanText)) {
        cleanedMap.set(cleanText, { text: cleanText, style: item.style });
      }
    }
  }
  return Array.from(cleanedMap.values());
};
