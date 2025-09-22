import React, { useState, useEffect, useRef } from 'react';
import './editor.css';
import INITIAL_TECHNIQUES from './techniques';

type TechniqueDetail = {
  name: string;
  combo: string;
};

export interface TechniqueShape {
  label: string;
  title?: string;
  singles?: (string | { text: string; favorite?: boolean })[];
  combos?: (string | { text: string; favorite?: boolean })[];
  techniques?: Record<string, TechniqueDetail>;
  description?: string; // Added description property
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
function normalizeTechniques(src: Record<string, Partial<TechniqueShape>>) {
  const out: Record<string, TechniqueShape> = {};
  Object.entries(src || {}).forEach(([key, g]) => {
    const label = (g?.label ?? g?.title ?? key); // always a string
    const title = (g?.title ?? g?.label ?? humanizeKey(key));
    out[key] = { ...g, label, title } as TechniqueShape;
  });
  return out;
}

// Helper: normalize singles/combos to array of objects { text, favorite }
function normalizeArray(arr: any[] | undefined): { text: string, favorite?: boolean }[] {
  if (!arr) return [];
  return arr.map(item =>
    typeof item === 'string'
      ? { text: item }
      : { text: item.text ?? '', favorite: !!item.favorite }
  );
}

// Helper: denormalize back to original format (for backward compatibility)
function denormalizeArray(arr: { text: string, favorite?: boolean }[]): (string | { text: string, favorite?: boolean })[] {
  // If none are favorited, save as string array for compactness
  if (arr.every(item => !item.favorite)) return arr.map(item => item.text);
  // Otherwise, save as objects
  return arr;
}

// Define the path to the download icon
const downloadIcon = '/assets/icon_download.png';

// Define the path to the upload icon
const uploadIcon = '/assets/icon_upload.png';

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

type TechniqueEditorProps = {
  techniques: Record<string, TechniqueShape>;
  setTechniques: (t: Record<string, TechniqueShape>) => void;
  onBack?: () => void;
};

export default function TechniqueEditor({
  techniques,
  setTechniques,
  onBack
}: TechniqueEditorProps) {
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
    // Always update both label and title to the new value
    next[groupKey] = { ...existing, label, title: label };
    persist(next);
  }

  function updateGroupDescription(groupKey: string, description: string) {
    const next = { ...local };
    const existing = next[groupKey] || {};
    next[groupKey] = { ...existing, description };
    persist(next);
  }

  function updateSingle(groupKey: string, idx: number, value: string) {
    const next = { ...local };
    const singles = normalizeArray(next[groupKey].singles);
    singles[idx].text = value;
    next[groupKey] = { ...next[groupKey], singles: denormalizeArray(singles) };
    persist(next);
  }

  function toggleSingleFavorite(groupKey: string, idx: number) {
    const next = { ...local };
    const singles = normalizeArray(next[groupKey].singles);
    singles[idx].favorite = !singles[idx].favorite;
    next[groupKey] = { ...next[groupKey], singles: denormalizeArray(singles) };
    persist(next);
  }

  function addSingle(groupKey: string) {
    const next = { ...local };
    const singles = normalizeArray(next[groupKey].singles);
    singles.push({ text: '' });
    next[groupKey] = { ...next[groupKey], singles: denormalizeArray(singles) };
    persist(next);
  }

  function removeSingle(groupKey: string, idx: number) {
    if (!window.confirm('Are you sure you want to delete this single?')) return;
    const next = { ...local };
    const singles = normalizeArray(next[groupKey].singles);
    singles.splice(idx, 1);
    next[groupKey] = { ...next[groupKey], singles: denormalizeArray(singles) };
    persist(next);
  }

  function updateCombo(groupKey: string, idx: number, value: string) {
    const next = { ...local };
    const combos = normalizeArray(next[groupKey].combos);
    combos[idx].text = value;
    next[groupKey] = { ...next[groupKey], combos: denormalizeArray(combos) };
    persist(next);
  }

  function toggleComboFavorite(groupKey: string, idx: number) {
    const next = { ...local };
    const combos = normalizeArray(next[groupKey].combos);
    combos[idx].favorite = !combos[idx].favorite;
    next[groupKey] = { ...next[groupKey], combos: denormalizeArray(combos) };
    persist(next);
  }

  function addCombo(groupKey: string) {
    const next = { ...local };
    const combos = normalizeArray(next[groupKey].combos);
    combos.push({ text: '' });
    next[groupKey] = { ...next[groupKey], combos: denormalizeArray(combos) };
    persist(next);
  }

  function removeCombo(groupKey: string, idx: number) {
    if (!window.confirm('Are you sure you want to delete this combo?')) return;
    const next = { ...local };
    const combos = normalizeArray(next[groupKey].combos);
    combos.splice(idx, 1);
    next[groupKey] = { ...next[groupKey], combos: denormalizeArray(combos) };
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

  // Optional: allow Escape to return to main page
  React.useEffect(() => {
    if (!onBack) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onBack]);

  // --- NEW: Export/Import logic ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export techniques (user + custom only, never core)
  function handleExport() {
    const data = JSON.stringify(local, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'techniques_backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Import techniques (validate before applying)
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        // Basic validation: must be an object with at least one group
        if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
          alert('Invalid file format.');
          return;
        }
        // Confirm before overwrite
        if (!window.confirm('Importing will overwrite your current techniques (custom and user sets only). Core sets will remain unchanged. Continue?')) return;
        // Merge: keep core sets from INITIAL_TECHNIQUES, overwrite/add others from import
        const merged: Record<string, TechniqueShape> = normalizeTechniques(INITIAL_TECHNIQUES as Record<string, Partial<TechniqueShape>>);
        Object.entries(imported).forEach(([k, v]) => {
          if (!INITIAL_TECHNIQUES[k]) merged[k] = normalizeTechniques({ [k]: v as Partial<TechniqueShape> })[k];
        });
        persist(merged);
        alert('Techniques imported! (Core sets unchanged)');
      } catch {
        alert('Failed to import: Invalid or corrupted file.');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported if needed
    e.target.value = '';
  }

  // Duplicate a core set for editing
  function duplicateCoreSet(key: string) {
    let base = local[key];
    if (!base) return;
    let newKey = key + '_copy';
    let i = 2;
    while (local[newKey]) {
      newKey = key + `_copy${i++}`;
    }
    const next = {
      ...local,
      [newKey]: {
        ...base,
        label: base.label + ' (Copy)',
        title: (base.title || base.label) + ' (Copy)'
      }
    };
    persist(next);
    alert(`Duplicated "${base.label}" as "${base.label} (Copy)"`);
  }

  // Map group keys to their thumbnail image paths (should match home page)
  const GROUP_THUMBNAILS: Record<string, string> = {
    newb: '/assets/icon_newb.png',
    khao: '/assets/icon_khao.png',
    mat: '/assets/icon_mat.png',
    tae: '/assets/icon_tae.png',
    femur: '/assets/icon_femur.png',
    sok: '/assets/icon_sok.png',
    boxing: '/assets/icon_boxing.png',
    two_piece: '/assets/icon_two_piece.png',
    southpaw: '/assets/icon_southpaw.png',
    // --- Custom icons for new groups ---
    meat_potatoes: '/assets/icon_meat_potatoes.png',
    buakaw: '/assets/icon.buakaw.png',
    low_kick_legends: '/assets/icon_lowkicklegends.png',
    elbow_arsenal: '/assets/icon.elbow arsenal.png',
    muay_tech: '/assets/icon.muaytech.png',
    ko_setups: '/assets/icon.ko.png'
  };

  // Replace the delete button icon with the custom trash icon
  const trashIcon = '/assets/icon_trash.png';

  return (
    <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '1rem', position: 'relative' }}>
      {/* Top-left Back button, visually aligned and not overlapping */}
      {onBack && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          marginBottom: '1.5rem',
          marginLeft: '0.5rem',
          zIndex: 2
        }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#f9a8d4',
              border: '1.5px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: '0.5rem 1.1rem',
              fontWeight: 700,
              fontSize: '1rem',
              boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)',
              cursor: 'pointer',
              transition: 'background 0.15s',
              outline: 'none'
            }}
            title="Back to Training (Esc)"
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(249,168,212,0.13)')}
            onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >
            ← Back
          </button>
        </div>
      )}
      {/* Info message at the top */}
      <div
        style={{
          background: 'rgba(30, 27, 75, 0.85)',
          border: '1.5px solid #a31caf86',
          borderRadius: '1rem',
          padding: '1.5rem 1.25rem',
          marginBottom: '2.5rem',
          color: '#fff',
          fontSize: '1.12rem',
          lineHeight: 1.7,
          boxShadow: '0 4px 24px 0 rgba(168,85,247,0.10)',
          textAlign: 'center'
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#f9a8d4', marginBottom: '0.5em', letterSpacing: '0.5px' }}>
          Technique Manager
        </div>
        <div style={{ marginBottom: '0.7em' }}>
          Customize the techniques and combos used during your training sessions.
        </div>
        <div style={{ margin: '0.5em 0 0 0', padding: 0, color: '#fff', fontSize: '1.05rem', textAlign: 'center' }}>
          Add, edit, rename, or remove techniques and combos for each emphasis group. You call the shots here.<br />
          <span style={{ color: '#fde047', fontWeight: 700 }}>★</span>
          <span style={{ color: '#fde047', fontWeight: 500 }}> Star</span>
          <span style={{ color: '#fff' }}> your favorites to have them called out more often.<br /></span>
          <span style={{ color: '#fff', fontWeight: 500 }}>
            Use <b>Export</b> to back up your custom techniques, and <b>Import</b> to restore or share them.<br />
          </span>
          To restore to default, click the button at the bottom of the page.
        </div>
        <div style={{ marginTop: '0.8em', color: '#a5b4fc', fontSize: '1rem', fontStyle: 'italic' }}>
          Tip: Use this page to tailor your training experience, reinforce key skills, or experiment with new combinations.
        </div>
      </div>
      {/* Top bar with Export/Import */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          gap: '0.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, color: 'white' }}>Technique Manager</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleExport}
              style={buttonStyle}
              title="Export your techniques as a backup"
            >
              <img src={uploadIcon} alt="Export" style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 6 }} />
              Export
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={buttonStyle}
              title="Import techniques from a backup file"
            >
              <img src={downloadIcon} alt="Import" style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 6 }} />
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>
        </div>
      </div>

      {Object.entries(local).map(([key, group]) => {
        const displayLabel = group.title ?? group.label ?? key;
        const isCoreStyle = Object.keys(INITIAL_TECHNIQUES).includes(key);
        const singles = normalizeArray(group.singles);
        const combos = normalizeArray(group.combos);
        // Always show a thumbnail if available in GROUP_THUMBNAILS
        const thumbnail = GROUP_THUMBNAILS[key];
        return (
          <div key={key} style={panelStyle}>
            <div
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-start'
  }}
>
  {thumbnail && (
    <img
      src={thumbnail}
      alt={`${displayLabel} thumbnail`}
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        objectFit: 'cover',
        boxShadow: '0 2px 8px 0 rgba(0,0,0,0.18)',
        background: '#18181b'
      }}
    />
  )}
  <h3
    style={{
      margin: 0,
      color: 'white',
      fontSize: '1.5rem',
      fontWeight: 700,
      textShadow: '0 1px 3px rgba(0,0,0,0.4)',
      minWidth: 0,
      wordBreak: 'break-word'
    }}
  >
    {displayLabel}
  </h3>
  {isCoreStyle && (
    <div style={{ marginLeft: 'auto', marginTop: 8 }}>
      <button
        onClick={() => duplicateCoreSet(key)}
        style={{
          ...buttonStyle,
          maxWidth: '100%',
          whiteSpace: 'nowrap'
        }}
        title="Duplicate this core set to create an editable copy"
      >
        Duplicate
      </button>
    </div>
  )}
  {!isCoreStyle && (
    <input
      type="text"
      value={group.label}
      onChange={e => updateGroupLabel(key, e.target.value)}
      style={{ ...inputStyle, flexGrow: 1, minWidth: 0 }}
      aria-label="Custom Group Name"
    />
  )}
</div>

            {/* --- Description field for custom groups --- */}
            {!isCoreStyle && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor={`desc-${key}`} style={{ color: '#a5b4fc', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Description (shown on homepage)
                </label>
                <textarea
                  id={`desc-${key}`}
                  value={group.description ?? ''}
                  onChange={e => updateGroupDescription(key, e.target.value)}
                  style={{
                    ...inputStyle,
                    minHeight: 60,
                    resize: 'vertical',
                    fontSize: '1rem',
                    color: 'white'
                  }}
                  placeholder="Describe this group (purpose, focus, etc.)"
                  aria-label="Group Description"
                />
              </div>
            )}
            {/* --- End description field --- */}

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#f9a8d4', marginBottom: '0.75rem' }}>Single Strikes</h4>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {singles.map((single, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={single.text}
                      onChange={e => !isCoreStyle && updateSingle(key, idx, e.target.value)}
                      style={{
                        ...inputStyle,
                        flexGrow: 1,
                        background: isCoreStyle ? 'rgba(0,0,0,0.15)' : inputStyle.background,
                        color: isCoreStyle ? '#a3a3a3' : inputStyle.color
                      }}
                      placeholder="e.g., jab"
                      readOnly={isCoreStyle}
                      tabIndex={isCoreStyle ? -1 : 0}
                    />
                    <button
                      onClick={() => toggleSingleFavorite(key, idx)}
                      style={{
                        ...buttonStyle,
                        background: single.favorite ? 'rgba(36, 229, 251, 0.25)' : 'rgba(255,255,255,0.08)',
                        color: single.favorite ? '#facc15' : '#f9a8d4',
                        width: '2.5rem',
                        height: '2.5rem',
                        fontSize: '1.3rem',
                        padding: 0,
                        lineHeight: '2.5rem',
                        opacity: 1,
                        cursor: 'pointer'
                      }}
                      aria-label={single.favorite ? "Unstar" : "Star"}
                      title={single.favorite ? "Unstar (favorite)" : "Star (favorite)"}
                    >★</button>
                    {!isCoreStyle && (
                      <button onClick={() => removeSingle(key, idx)} style={deleteButtonStyle} aria-label="Delete single">
                        <img src={trashIcon} alt="Delete" style={{ width: 20, height: 20, verticalAlign: 'middle', pointerEvents: 'none' }} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!isCoreStyle && (
                <button onClick={() => addSingle(key)} style={{ ...buttonStyle, marginTop: '1rem' }}>Add Single</button>
              )}
            </div>

            <div>
              <h4 style={{ color: '#f9a8d4', marginBottom: '0.75rem' }}>Combos</h4>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {combos.map((combo, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={combo.text}
                      onChange={e => !isCoreStyle && updateCombo(key, idx, e.target.value)}
                      style={{
                        ...inputStyle,
                        flexGrow: 1,
                        background: isCoreStyle ? 'rgba(0,0,0,0.15)' : inputStyle.background,
                        color: isCoreStyle ? '#a3a3a3' : inputStyle.color
                      }}
                      placeholder="e.g., 1, 2, 3"
                      readOnly={isCoreStyle}
                      tabIndex={isCoreStyle ? -1 : 0}
                    />
                    <button
                      onClick={() => toggleComboFavorite(key, idx)}
                      style={{
                        ...buttonStyle,
                        background: combo.favorite ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)',
                        color: combo.favorite ? '#facc15' : '#f9a8d4',
                        width: '2.5rem',
                        height: '2.5rem',
                        fontSize: '1.3rem',
                        padding: 0,
                        lineHeight: '2.5rem',
                        opacity: 1,
                        cursor: 'pointer'
                      }}
                      aria-label={combo.favorite ? "Unstar" : "Star"}
                      title={combo.favorite ? "Unstar (favorite)" : "Star (favorite)"}
                    >★</button>
                    {!isCoreStyle && (
                      <button onClick={() => removeCombo(key, idx)} style={deleteButtonStyle} aria-label="Delete combo">
                        <img src={trashIcon} alt="Delete" style={{ width: 20, height: 20, verticalAlign: 'middle', pointerEvents: 'none' }} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!isCoreStyle && (
                <button onClick={() => addCombo(key)} style={{ ...buttonStyle, marginTop: '1rem' }}>Add Combo</button>
              )}
            </div>

            {!isCoreStyle && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete group "${group.label}" and all its techniques? This cannot be undone.`)) {
                      const next = { ...local };
                      delete next[key];
                      persist(next);
                    }
                  }}
                  style={{
                    ...deleteButtonStyle,
                    width: 'auto',
                    height: '2.5rem',
                    padding: '0 1.5rem',
                    fontSize: '1rem',
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  aria-label={`Delete group ${group.label}`}
                >
                  <img src={trashIcon} alt="Delete" style={{ width: 20, height: 20, verticalAlign: 'middle', pointerEvents: 'none' }} />
                  Delete Group
                </button>
              </div>
            )}
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