import React, { useState, useEffect } from 'react';
import './editor.css';
import INITIAL_TECHNIQUES from './techniques';

type TechniqueDetail = {
  name: string;
  combo: string;
};

export interface TechniqueShape {
  label: string;
  title?: string;
  singles?: string[];
  combos?: string[];
  techniques?: Record<string, TechniqueDetail>;
}

// helper: create a readable title from a short key
function humanizeKey(k: string) {
  if (!k) return k;
  return k
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ensure every group has label + title so the UI never falls back to the raw key
function normalizeTechniques(src: Record<string, TechniqueShape>) {
  const out: Record<string, TechniqueShape> = {};
  Object.entries(src || {}).forEach(([key, g]) => {
    const label = (g && (g.label ?? g.title)) ? (g.label ?? g.title) : key;
    const title = g?.title ?? g?.label ?? humanizeKey(key);
    out[key] = { ...g, label, title };
  });
  return out;
}

// Reusable styles for the new theme
const panelStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '0.75rem',
  padding: '1.5rem',
  marginBottom: '1.5rem'
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '0.375rem',
  padding: '0.5rem 0.75rem',
  color: 'white',
  width: '100%',
  boxSizing: 'border-box'
};

const buttonStyle: React.CSSProperties = {
  background: 'rgba(236, 72, 153, 0.2)',
  color: '#f9a8d4',
  border: '1px solid rgba(236, 72, 153, 0.4)',
  borderRadius: '0.5rem',
  padding: '0.5rem 1rem',
  cursor: 'pointer',
  fontWeight: 600
};

const deleteButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'rgba(220, 38, 38, 0.2)',
  color: '#fca5a5',
  border: '1px solid rgba(220, 38, 38, 0.4)',
  padding: '0',
  width: '2.5rem',
  height: '2.5rem',
  lineHeight: '2.5rem',
  textAlign: 'center' as const,
  flexShrink: 0,
};

export default function TechniqueEditor({
  techniques,
  setTechniques,
  onBack
}: {
  techniques: Record<string, TechniqueShape>;
  setTechniques: (t: Record<string, TechniqueShape>) => void;
  onBack: () => void;
}) {
  // start with normalized techniques so missing titles/labels are filled
  const [local, setLocal] = useState<Record<string, TechniqueShape>>(() => normalizeTechniques(techniques));
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => setLocal(normalizeTechniques(techniques)), [techniques]);

  function persist(next: Record<string, TechniqueShape>) {
    setLocal(next);
    try { setTechniques(next); } catch (e) { console.error(e); }
  }

  function updateGroupLabel(groupKey: string, label: string) {
    const next = { ...local };
    const existing = next[groupKey] || {};
    // prefer preserving an explicit title but if none exists, create a humanized title
    const title = existing.title ?? humanizeKey(label);
    next[groupKey] = { ...existing, label, title };
    persist(next);
  }

  function updateSingle(groupKey: string, idx: number, value: string) {
    const next = { ...local };
    const singles = [...(next[groupKey].singles || [])];
    singles[idx] = value;
    next[groupKey] = { ...next[groupKey], singles };
    persist(next);
  }

  function addSingle(groupKey: string) {
    const next = { ...local };
    next[groupKey] = { ...next[groupKey], singles: [...(next[groupKey].singles || []), ''] };
    persist(next);
  }

  function removeSingle(groupKey: string, idx: number) {
    if (!window.confirm('Are you sure you want to delete this single?')) return;
    const next = { ...local };
    const singles = [...(next[groupKey].singles || [])];
    singles.splice(idx, 1);
    next[groupKey] = { ...next[groupKey], singles };
    persist(next);
  }

  function updateCombo(groupKey: string, idx: number, value: string) {
    const next = { ...local };
    const combos = [...(next[groupKey].combos || [])];
    combos[idx] = value;
    next[groupKey] = { ...next[groupKey], combos };
    persist(next);
  }

  function addCombo(groupKey: string) {
    const next = { ...local };
    next[groupKey] = { ...next[groupKey], combos: [...(next[groupKey].combos || []), ''] };
    persist(next);
  }

  function removeCombo(groupKey: string, idx: number) {
    if (!window.confirm('Are you sure you want to delete this combo?')) return;
    const next = { ...local };
    const combos = [...(next[groupKey].combos || [])];
    combos.splice(idx, 1);
    next[groupKey] = { ...next[groupKey], combos };
    persist(next);
  }

  function addGroup(key: string) {
    const k = key.trim();
    if (!k) return;
    if (local[k]) { alert(`Group "${k}" already exists.`); return; }
    const next = { ...local, [k]: { label: k, title: humanizeKey(k), singles: [], combos: [] } };
    persist(next);
    setNewGroupName('');
  }

  function resetToDefault() {
    if (!window.confirm('Are you sure you want to reset all techniques to their default values? This cannot be undone.')) return;
    persist(INITIAL_TECHNIQUES as any);
  }

  return (
    <div className="editor-root" style={{ color: '#fdf2f8' }}>
      {Object.entries(local).map(([key, group]) => {
        // prefer the explicit title when available, then label, then the group key
        const displayLabel = group.title ?? group.label ?? key;
        const isCoreStyle = Object.keys(INITIAL_TECHNIQUES).includes(key);
        return (
          <div key={key} style={panelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'white', flexGrow: 1, fontSize: '1.5rem', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                {displayLabel}
              </h3>
              {!isCoreStyle && (
                <input
                  type="text"
                  value={group.label}
                  onChange={e => updateGroupLabel(key, e.target.value)}
                  style={{ ...inputStyle, flexGrow: 1 }}
                  aria-label="Custom Group Name"
                />
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#f9a8d4', marginBottom: '0.75rem' }}>Singles (individual moves)</h4>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {(group.singles || []).map((single, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={single}
                      onChange={e => updateSingle(key, idx, e.target.value)}
                      style={{ ...inputStyle, flexGrow: 1 }}
                      placeholder="e.g., jab"
                    />
                    <button onClick={() => removeSingle(key, idx)} style={deleteButtonStyle} aria-label="Delete single">✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => addSingle(key)} style={{ ...buttonStyle, marginTop: '1rem' }}>Add Single</button>
            </div>

            <div>
              <h4 style={{ color: '#f9a8d4', marginBottom: '0.75rem' }}>Combos</h4>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {(group.combos || []).map((combo, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={combo}
                      onChange={e => updateCombo(key, idx, e.target.value)}
                      style={{ ...inputStyle, flexGrow: 1 }}
                      placeholder="e.g., 1, 2, 3"
                    />
                    <button onClick={() => removeCombo(key, idx)} style={deleteButtonStyle} aria-label="Delete combo">✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => addCombo(key)} style={{ ...buttonStyle, marginTop: '1rem' }}>Add Combo</button>
            </div>
          </div>
        );
      })}

      <div className="add-emphasis-panel" style={panelStyle}>
        <h3 style={{ marginTop: 0, color: 'white' }}>Create New Emphasis</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="short-key (e.g., mystyle)"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            style={{ ...inputStyle, flexGrow: 1 }}
          />
          <button onClick={() => addGroup(newGroupName)} style={buttonStyle}>Add Emphasis</button>
        </div>
      </div>

      <div className="reset-panel" style={{ ...panelStyle, background: 'rgba(159, 18, 57, 0.2)', borderColor: 'rgba(251, 113, 133, 0.3)' }}>
        <h3 style={{ marginTop: 0, color: '#fca5a5' }}>Reset Data</h3>
        <p style={{ margin: '0 0 1rem 0', color: '#fecdd3', fontSize: '0.875rem' }}>
          This will restore the original set of techniques and remove any custom ones you have added. This action cannot be undone.
        </p>
        <button onClick={resetToDefault} style={{ ...buttonStyle, background: 'rgba(220, 38, 38, 0.4)', color: '#fca5a5', border: '1px solid rgba(220, 38, 38, 0.6)' }}>
          Reset Techniques to Default
        </button>
      </div>
    </div>
  );
}