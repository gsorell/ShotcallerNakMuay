import { normalizeTechniques, humanizeKey } from '../utils/techniqueUtils';
import { describe, it, expect } from 'vitest';

describe('persist normalization', () => {
  it('preserves renamed title when duplicating and persisting', () => {
    const initial = normalizeTechniques({
      newb: { title: 'Nak Muay Newb', label: 'Nak Muay Newb', singles: ['jab'], combos: ['1,2'] }
    });

    // duplicate
    const copyKey = 'newb_copy';
    const duplicated = {
      ...initial,
      [copyKey]: { ...initial.newb, label: initial.newb.label + ' (Copy)', title: (initial.newb.title || initial.newb.label) + ' (Copy)' }
    };

    // rename the copy
    const renamed = { ...duplicated };
    renamed[copyKey] = { ...renamed[copyKey], label: 'My Newb Style', title: 'My Newb Style' };

    // simulate persist normalization
    const persisted = normalizeTechniques(renamed as any);

    expect(persisted[copyKey].title).toBe('My Newb Style');
    expect(persisted[copyKey].label).toBe('My Newb Style');
  });

  it('humanizes raw-key fallback', () => {
    const obj = { 'newb_copy': { label: 'newb_copy', title: 'newb_copy' } };
    const normalized = normalizeTechniques(obj as any);
    expect(normalized['newb_copy'].title).toBe(humanizeKey('newb_copy'));
  });
});
