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
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function normalizeTechniques(src: Record<string, Partial<TechniqueShape>>) {
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

export function normalizeArray(arr: any[] | undefined): { text: string; favorite?: boolean }[] {
  if (!arr) return [];
  return arr.map(item => (typeof item === 'string' ? { text: item } : { text: item.text ?? '', favorite: !!item.favorite }));
}

export function denormalizeArray(arr: { text: string; favorite?: boolean }[]): (string | { text: string; favorite?: boolean })[] {
  if (arr.every(item => !item.favorite)) return arr.map(item => item.text);
  return arr;
}
