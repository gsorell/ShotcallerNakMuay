import React, { useState, useEffect } from 'react';
import './editor.css';
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

export default function TechniqueEditor({
  techniques,
  setTechniques,
  onBack
}: {
  techniques: TechniquesShape;
  setTechniques: (t: TechniquesShape) => void;
  onBack: () => void;
}) {
  const save = (next: TechniquesShape) => {
    setTechniques(next);
    try { localStorage.setItem(TECHNIQUES_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const handleUpdate = (emphasis: AllTechniquesKey, type: 'singles' | 'combos', index: number, value: string) => {
    const copy = JSON.parse(JSON.stringify(techniques)) as TechniquesShape;
    copy[emphasis][type][index] = value;
    save(copy);
  };

  const handleAdd = (emphasis: AllTechniquesKey, type: 'singles' | 'combos') => {
    const copy = JSON.parse(JSON.stringify(techniques)) as TechniquesShape;
    copy[emphasis][type].push(type === 'singles' ? 'New Item' : 'New Combo');
    save(copy);
  };

  const handleDelete = (emphasis: AllTechniquesKey, type: 'singles' | 'combos', index: number) => {
    if (!window.confirm('Delete this entry?')) return;
    const copy = JSON.parse(JSON.stringify(techniques)) as TechniquesShape;
    copy[emphasis][type].splice(index, 1);
    save(copy);
  };

  const handleReset = () => {
    if (!window.confirm('Are you sure you want to reset all techniques to their defaults?')) return;
    localStorage.removeItem(TECHNIQUES_STORAGE_KEY);
    save(INITIAL_TECHNIQUES);
  };

  return (
    <div className="editor-root">
      <div className="editor-actions">
        <button onClick={handleReset} className="btn btn-primary">Reset to Defaults</button>
        <button onClick={onBack} className="btn btn-ghost">Back to Timer</button>
      </div>

      { (Object.keys(techniques) as AllTechniquesKey[]).map(key => (
        <div key={key} className="editor-panel">
          <div className="panel-title">{LABELS[key]}</div>
          <div className="panel-grid">
            <div>
              <div className="small-muted">Singles</div>
              <div className="tech-list" style={{ marginTop: 8 }}>
                {techniques[key].singles.map((s, i) => (
                  <div className="tech-item" key={i}>
                    <input className="tech-input" value={s} onChange={(e) => handleUpdate(key, 'singles', i, e.target.value)} />
                    <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(key, 'singles', i)} aria-label="delete">✕</button>
                  </div>
                ))}
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-primary" onClick={() => handleAdd(key, 'singles')}>+ Add Single</button>
                </div>
              </div>
            </div>

            <div>
              <div className="small-muted">Combos</div>
              <div className="tech-list" style={{ marginTop: 8 }}>
                {techniques[key].combos.map((c, i) => (
                  <div className="tech-item" key={i}>
                    <input className="tech-input" value={c} onChange={(e) => handleUpdate(key, 'combos', i, e.target.value)} />
                    <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(key, 'combos', i)} aria-label="delete">✕</button>
                  </div>
                ))}
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-primary" onClick={() => handleAdd(key, 'combos')}>+ Add Combo</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )) }
    </div>
  );
}