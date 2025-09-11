import './editor.css';
import React, { useEffect, useState } from 'react';
import INITIAL_TECHNIQUES from './techniques';

type AllTechniquesKey = 'khao' | 'mat' | 'tae' | 'femur' | 'sok' | 'boxing' | 'calisthenics';
type TechniquesShape = typeof INITIAL_TECHNIQUES;
const TECHNIQUES_STORAGE_KEY = 'shotcaller_techniques';

const LABELS: Record<AllTechniquesKey, string> = {
  khao: 'Muay Khao',
  mat: 'Muay Mat',
  tae: 'Muay Tae',
  femur: 'Muay Femur',
  sok: 'Muay Sok',
  boxing: 'Boxing',
  calisthenics: 'Calisthenics'
};

type TechniqueShape = { singles: string[]; combos?: string[]; exclusive?: boolean; label?: string; title?: string };

export default function TechniqueEditor({
  techniques,
  setTechniques,
  onBack
}: {
  techniques: Record<string, TechniqueShape>;
  setTechniques: (t: Record<string, TechniqueShape>) => void;
  onBack: () => void;
}) {
  const [local, setLocal] = useState<Record<string, TechniqueShape>>(techniques);

  useEffect(() => setLocal(techniques), [techniques]);

  function persist(next: Record<string, TechniqueShape>) {
    setLocal(next);
    try { setTechniques(next); } catch (e) { console.error(e); }
  }

  function updateSingle(groupKey: string, idx: number, value: string) {
    const next = { ...local };
    next[groupKey] = { ...next[groupKey], singles: [...(next[groupKey].singles || [])] };
    next[groupKey].singles[idx] = value;
    persist(next);
  }

  function addSingle(groupKey: string) {
    const next = { ...local };
    next[groupKey] = { ...next[groupKey], singles: [...(next[groupKey].singles || []), ''] };
    persist(next);
  }

  function removeSingle(groupKey: string, idx: number) {
    const next = { ...local };
    next[groupKey] = { ...next[groupKey], singles: [...(next[groupKey].singles || [])] };
    next[groupKey].singles.splice(idx, 1);
    persist(next);
  }

  function addGroup(key: string) {
    const k = key.trim();
    if (!k) return;
    if (local[k]) return;
    const next = { ...local, [k]: { label: k, title: k, singles: [], combos: [] } };
    persist(next);
  }

  // NOTE: deleting an entire group is not allowed by design.
  // If you need to remove items, remove singles/combos individually.
  function restoreDefaults() {
    if (!confirm('Restore core technique list? This will replace current technique groups and entries.')) return;
    // clone to avoid accidental mutation of the module export
    const clone = JSON.parse(JSON.stringify(INITIAL_TECHNIQUES));
    persist(clone);
  }

  const containerStyle: React.CSSProperties = { padding: 16, maxWidth: 980, margin: '0 auto', color: '#111' };
  const sectionStyle: React.CSSProperties = { marginBottom: 18, padding: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8 };
  const headingStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 };
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 };

  return (
    <div style={containerStyle}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Manage Techniques</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={restoreDefaults} style={{ marginRight: 8 }}>Restore core list</button>
          <button onClick={onBack} style={{ marginRight: 8 }}>Back</button>
        </div>
      </header>

      <div style={{ marginBottom: 12 }}>
        <AddGroupForm onAdd={addGroup} />
      </div>

      {Object.entries(local).map(([key, data]) => {
        const heading = data.title ?? data.label ?? key;
        return (
          <section key={key} style={sectionStyle}>
            <div style={headingStyle}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>{heading}</h3>
                {data.exclusive && <div style={{ fontSize: 12, color: '#dc2626' }}>Exclusive</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{key}</div>
                {/* Group deletion disabled - keep group keys stable */}
              </div>
            </div>

            <div style={{ marginBottom: 8, fontSize: 13, color: '#4b5563' }}>Singles</div>
            <div style={gridStyle}>
              {(data.singles || []).map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={s}
                    onChange={e => updateSingle(key, i, e.target.value)}
                    aria-label={`${heading} single ${i + 1}`}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 14 }}
                  />
                  <button onClick={() => removeSingle(key, i)} aria-label="remove" style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 8px' }}>✕</button>
                </div>
              ))}
              <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-start' }}>
                <button onClick={() => addSingle(key)} style={{ padding: '8px 10px', borderRadius: 6 }}>+ Add Single</button>
              </div>
            </div>

            <div style={{ marginTop: 12, marginBottom: 8, fontSize: 13, color: '#4b5563' }}>Combos</div>
            <div style={gridStyle}>
              {(data.combos || []).map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={c}
                    onChange={e => {
                      const next = { ...local };
                      const combos = [...(next[key]?.combos || [])];
                      combos[i] = e.target.value;
                      next[key] = { ...next[key], combos };
                      persist(next);
                    }}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 14 }}
                  />
                  <button onClick={() => {
                    const next = { ...local };
                    const combos = [...(next[key]?.combos || [])];
                    combos.splice(i, 1);
                    next[key] = { ...next[key], combos };
                    persist(next);
                  }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 8px' }}>✕</button>
                </div>
              ))}
              <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-start' }}>
                <button onClick={() => {
                  const next = { ...local };
                  const combos = [...(next[key]?.combos || []), ''];
                  next[key] = { ...next[key], combos };
                  persist(next);
                }} style={{ padding: '8px 10px', borderRadius: 6 }}>+ Add Combo</button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AddGroupForm({ onAdd }: { onAdd: (k: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); onAdd(val); setVal(''); }} style={{ display: 'flex', gap: 8 }}>
      <input placeholder="new group key (e.g. 'myStyle')" value={val} onChange={e => setVal(e.target.value)} style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
      <button type="submit" style={{ padding: '8px 10px', borderRadius: 6 }}>Add Group</button>
    </form>
  );
}