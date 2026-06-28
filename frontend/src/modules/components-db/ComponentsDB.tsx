import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../../store';
import type { Component, ComponentCategory, DistributionType, Criticality } from '../../types';

const CATEGORIES: ComponentCategory[] = ['mechanical', 'electrical', 'electronic', 'hydraulic', 'pneumatic', 'software', 'sensor', 'actuator', 'structural', 'other'];
const DISTRIBUTIONS: DistributionType[] = ['exponential', 'weibull', 'normal', 'lognormal'];
const CRITICALITIES: Criticality[] = ['low', 'medium', 'high', 'critical'];

const emptyComp = (): Omit<Component, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '', category: 'mechanical', manufacturer: '', model: '', description: '',
  failureRate: 0.0001, mtbf: 10000, mttr: 4, mttf: 10000,
  distributionType: 'exponential', betaParam: 1, etaParam: 10000,
  cost: 0, criticality: 'medium', missionTime: 8760, tags: [],
});

export default function ComponentsDB() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyComp());
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const filtered = useMemo(() => state.components.filter(c => {
    const match = c.name.toLowerCase().includes(search.toLowerCase()) || c.manufacturer.toLowerCase().includes(search.toLowerCase());
    const catMatch = filterCat === 'all' || c.category === filterCat;
    return match && catMatch;
  }), [state.components, search, filterCat]);

  const openAdd = () => { setForm(emptyComp()); setEditId(null); setShowModal(true); };
  const openEdit = (c: Component) => {
    setForm({ name: c.name, category: c.category, manufacturer: c.manufacturer, model: c.model, description: c.description, failureRate: c.failureRate, mtbf: c.mtbf, mttr: c.mttr, mttf: c.mttf, distributionType: c.distributionType, betaParam: c.betaParam, etaParam: c.etaParam, cost: c.cost, criticality: c.criticality, missionTime: c.missionTime, tags: c.tags });
    setEditId(c.id);
    setShowModal(true);
  };

  const save = () => {
    if (!form.name.trim()) return;
    const now = new Date().toISOString();
    if (editId) {
      const existing = state.components.find(c => c.id === editId);
      dispatch({ type: 'UPDATE_COMPONENT', payload: { ...form, id: editId, createdAt: existing?.createdAt || now, updatedAt: now } as Component });
      dispatch({ type: 'SHOW_TOAST', payload: 'Component updated' });
    } else {
      dispatch({ type: 'ADD_COMPONENT', payload: { ...form, id: uuidv4(), createdAt: now, updatedAt: now } as Component });
      dispatch({ type: 'SHOW_TOAST', payload: 'Component added' });
    }
    setShowModal(false);
  };

  const del = (id: string) => {
    if (confirm('Delete this component?')) {
      dispatch({ type: 'DELETE_COMPONENT', payload: id });
      dispatch({ type: 'SHOW_TOAST', payload: 'Component deleted' });
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state.components, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'components.json'; a.click();
  };

  const handleImport = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (Array.isArray(data)) { dispatch({ type: 'IMPORT_COMPONENTS', payload: data }); dispatch({ type: 'SHOW_TOAST', payload: `Imported ${data.length} components` }); }
        } catch { alert('Invalid JSON'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const updateField = (field: string, value: any) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'failureRate' && value > 0) { next.mtbf = 1 / value; next.mttf = 1 / value; }
      if (field === 'mtbf' && value > 0) { next.failureRate = 1 / value; next.mttf = value; }
      if (field === 'mttf' && value > 0) { next.failureRate = 1 / value; next.mtbf = value; }
      return next;
    });
  };

  const critBadge = (c: Criticality) => {
    const cls = c === 'critical' ? 'badge-danger' : c === 'high' ? 'badge-warning' : c === 'medium' ? 'badge-info' : 'badge-success';
    return <span className={`badge ${cls}`}>{c}</span>;
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Components Database</h1>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Manage reliability components for all analyses</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={handleImport}>Import</button>
          <button className="btn btn-ghost" onClick={handleExport}>Export</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Component</button>
        </div>
      </div>

      <div className="toolbar">
        <input className="form-control search-box" placeholder="Search components..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-control" style={{ width: '140px' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-xs text-muted">{filtered.length} components</span>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No components yet</h3>
            <p>Add your first component to the reliability database</p>
            <button className="btn btn-primary mt-4" onClick={openAdd}>+ Add Component</button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>Name</th><th>Category</th><th>Manufacturer</th><th>λ (fail/hr)</th><th>MTBF (hrs)</th><th>MTTR (hrs)</th><th>Distribution</th><th>Criticality</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td><span className="badge badge-info">{c.category}</span></td>
                    <td className="text-muted">{c.manufacturer || '—'}</td>
                    <td>{c.failureRate.toExponential(3)}</td>
                    <td>{c.mtbf.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td>{c.mttr}</td>
                    <td className="text-muted">{c.distributionType}</td>
                    <td>{critBadge(c.criticality)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(c)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => del(c.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editId ? 'Edit' : 'Add'} Component</h3><button className="btn-icon" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Name *</label><input className="form-control" value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. Centrifugal Pump" /></div>
                <div className="form-group"><label>Category</label><select className="form-control" value={form.category} onChange={e => updateField('category', e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Manufacturer</label><input className="form-control" value={form.manufacturer} onChange={e => updateField('manufacturer', e.target.value)} /></div>
                <div className="form-group"><label>Model</label><input className="form-control" value={form.model} onChange={e => updateField('model', e.target.value)} /></div>
              </div>
              <div className="form-group"><label>Description</label><textarea className="form-control" value={form.description} onChange={e => updateField('description', e.target.value)} /></div>
              <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', margin: '12px 0 8px' }}>Reliability Parameters</h4>
              <div className="form-row-3">
                <div className="form-group"><label>Failure Rate λ</label><input className="form-control" type="number" step="any" value={form.failureRate} onChange={e => updateField('failureRate', parseFloat(e.target.value) || 0)} /></div>
                <div className="form-group"><label>MTBF (hrs)</label><input className="form-control" type="number" step="any" value={form.mtbf} onChange={e => updateField('mtbf', parseFloat(e.target.value) || 0)} /></div>
                <div className="form-group"><label>MTTR (hrs)</label><input className="form-control" type="number" step="any" value={form.mttr} onChange={e => updateField('mttr', parseFloat(e.target.value) || 0)} /></div>
              </div>
              <div className="form-row-3">
                <div className="form-group"><label>MTTF (hrs)</label><input className="form-control" type="number" step="any" value={form.mttf} onChange={e => updateField('mttf', parseFloat(e.target.value) || 0)} /></div>
                <div className="form-group"><label>Mission Time (hrs)</label><input className="form-control" type="number" step="any" value={form.missionTime} onChange={e => updateField('missionTime', parseFloat(e.target.value) || 0)} /></div>
                <div className="form-group"><label>Cost ($)</label><input className="form-control" type="number" step="any" value={form.cost} onChange={e => updateField('cost', parseFloat(e.target.value) || 0)} /></div>
              </div>
              <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', margin: '12px 0 8px' }}>Distribution</h4>
              <div className="form-row-3">
                <div className="form-group"><label>Type</label><select className="form-control" value={form.distributionType} onChange={e => updateField('distributionType', e.target.value)}>{DISTRIBUTIONS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div className="form-group"><label>β (Shape)</label><input className="form-control" type="number" step="any" value={form.betaParam} onChange={e => updateField('betaParam', parseFloat(e.target.value) || 0)} /></div>
                <div className="form-group"><label>η (Scale)</label><input className="form-control" type="number" step="any" value={form.etaParam} onChange={e => updateField('etaParam', parseFloat(e.target.value) || 0)} /></div>
              </div>
              <div className="form-group"><label>Criticality</label><select className="form-control" value={form.criticality} onChange={e => updateField('criticality', e.target.value)}>{CRITICALITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{editId ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
