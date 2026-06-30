import React, { useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../../store';
import type { RAMProject, RAMResults, ComponentRAMResult, TimePoint } from '../../types';
import { calcSystemResults } from '../../utils/rbdCalculations';

export default function RAMModule() {
  const { state, dispatch } = useApp();
  const [showNew, setShowNew] = React.useState(false);
  const [name, setName] = React.useState('');
  const [missionTime, setMissionTime] = React.useState(8760);
  const [selectedComps, setSelectedComps] = React.useState<string[]>([]);

  const project = state.ramProjects.find((p: RAMProject) => p.id === state.selectedRAMProject);
  
  // Auto-calculate from selected RBD project if available
  const rbdProject = state.selectedRBDProject 
    ? state.rbdProjects.find(p => p.id === state.selectedRBDProject)
    : null;

  const rbdSystem = useMemo(() => {
    if (rbdProject && rbdProject.blocks.length > 0) {
      return calcSystemResults(rbdProject.blocks, state.components);
    }
    return null;
  }, [rbdProject, state.components]);

  // Whether we're using RBD-based calculation
  const useRbd = rbdProject && rbdSystem !== null;

  const createProject = () => {
    if (!name.trim() || selectedComps.length === 0) return;
    const now = new Date().toISOString();
    const proj: RAMProject = { 
      id: uuidv4(), name, description: '', 
      componentIds: selectedComps, missionTime, results: null, 
      createdAt: now, updatedAt: now 
    };
    dispatch({ type: 'ADD_RAM_PROJECT', payload: proj });
    dispatch({ type: 'SET_SELECTED_RAM', payload: proj.id });
    setShowNew(false); setName(''); setSelectedComps([]);
  };

  const runAnalysis = () => {
    if (!project) return;
    
    // Get components and their RBD redundancy configuration if available
    let comps: { failureRate: number; mtbf: number; mttr: number; id: string; name: string }[] = [];
    
    if (useRbd && rbdSystem) {
      // Use RBD block results for component data
      comps = rbdSystem.areaResults.map(r => ({
        failureRate: r.lambda_s,
        mtbf: r.mtbf_s,
        mttr: r.mttr_s,
        id: r.blockId,
        name: r.componentName,
      }));
    } else {
      // Fallback: get components from selected IDs
      comps = project.componentIds
        .map(id => state.components.find(c => c.id === id))
        .filter(Boolean)
        .map(c => ({
          failureRate: c!.failureRate,
          mtbf: c!.mtbf,
          mttr: c!.mttr,
          id: c!.id,
          name: c!.name,
        }));
    }
    
    if (comps.length === 0) {
      dispatch({ type: 'SHOW_TOAST', payload: 'No components to analyze' });
      return;
    }

    const t = project.missionTime;
    const componentResults: ComponentRAMResult[] = comps.map(c => {
      const R = Math.exp(-c.failureRate * t);
      const A = c.mtbf / (c.mtbf + c.mttr);
      const M = c.mttr > 0 ? 1 - Math.exp(-t / c.mttr) : 0;
      return { 
        componentId: c.id, componentName: c.name, 
        reliability: R, availability: A, maintainability: M, 
        failureRate: c.failureRate, mtbf: c.mtbf, mttr: c.mttr 
      };
    });

    // Series combination of components/blocks
    const sysR = componentResults.reduce((acc, cr) => acc * cr.reliability, 1);
    const sysA = componentResults.reduce((acc, cr) => acc * cr.availability, 1);
    const sysFR = componentResults.reduce((acc, cr) => acc + cr.failureRate, 0);
    const sysMTBF = sysFR > 0 ? 1 / sysFR : 0;
    const sysMTTR = componentResults.length > 0
      ? componentResults.reduce((acc, cr) => acc + cr.mttr, 0) / componentResults.length
      : 0;
    const sysM = sysMTTR > 0 ? 1 - Math.exp(-t / sysMTTR) : 0;

    // Time series data
    const steps = 100;
    const dt = t / steps;
    const relOverTime: TimePoint[] = [];
    const availOverTime: TimePoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const time = i * dt;
      let rSys = 1, aSys = 1;
      comps.forEach(c => {
        rSys *= Math.exp(-c.failureRate * time);
        aSys *= c.mtbf / (c.mtbf + c.mttr);
      });
      relOverTime.push({ time, value: rSys });
      availOverTime.push({ time, value: aSys });
    }

    const results: RAMResults = {
      systemReliability: sysR, systemAvailability: sysA, systemMaintainability: sysM,
      systemMTBF: sysMTBF, systemMTTR: sysMTTR, systemMTTF: sysMTBF,
      systemFailureRate: sysFR, componentResults, 
      reliabilityOverTime: relOverTime, availabilityOverTime: availOverTime,
    };

    dispatch({ type: 'UPDATE_RAM_PROJECT', payload: { ...project, results, updatedAt: new Date().toISOString() } });
    dispatch({ type: 'SHOW_TOAST', payload: 'Analysis complete' });
  };

  const toggleComp = (id: string) => {
    setSelectedComps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  if (!project) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {state.ramProjects.length === 0 ? (
          <div className="canvas-empty">
            <h3>No RAM Analyses</h3>
            <p>Create a new analysis using components from the database</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowNew(true)}>+ New Analysis</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {state.ramProjects.map((p: RAMProject) => (
              <div key={p.id} className="card" style={{ width: '200px', cursor: 'pointer' }} onClick={() => dispatch({ type: 'SET_SELECTED_RAM', payload: p.id })}>
                <div className="card-body" style={{ padding: '12px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{p.name}</div>
                  <div className="text-xs text-muted mt-2">{p.componentIds.length} components · {p.missionTime}h</div>
                </div>
              </div>
            ))}
            <div className="card" style={{ width: '200px', cursor: 'pointer', borderStyle: 'dashed' }} onClick={() => setShowNew(true)}>
              <div className="card-body" style={{ padding: '12px', textAlign: 'center', color: 'var(--primary)' }}>+ New</div>
            </div>
          </div>
        )}

        {showNew && (
          <div className="modal-overlay" onClick={() => setShowNew(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header"><h3>New RAM Analysis</h3><button className="btn-icon" onClick={() => setShowNew(false)}>✕</button></div>
              <div className="modal-body">
                <div className="form-group"><label>Analysis Name</label><input className="form-control" value={name} onChange={e => setName(e.target.value)} /></div>
                <div className="form-group"><label>Mission Time (hours)</label><input className="form-control" type="number" value={missionTime} onChange={e => setMissionTime(parseFloat(e.target.value) || 8760)} /></div>
                <div className="form-group"><label>Select Components</label>
                  <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    {state.components.length === 0 ? <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>No components. Add some in Components DB first.</div> :
                      state.components.map(c => (
                        <div key={c.id} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: selectedComps.includes(c.id) ? 'var(--primary-bg)' : 'transparent' }} onClick={() => toggleComp(c.id)}>
                          <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: `2px solid ${selectedComps.includes(c.id) ? 'var(--primary)' : 'var(--border)'}`, background: selectedComps.includes(c.id) ? 'var(--primary)' : 'transparent' }} />
                          <span style={{ fontSize: '12px' }}>{c.name}</span>
                          <span className="badge badge-muted" style={{ marginLeft: 'auto' }}>{c.category}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={createProject}>Create</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Analysis view
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div className="flex items-center gap-2">
            <button className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: 'SET_SELECTED_RAM', payload: null })}>← Back</button>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{project.name}</h1>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Mission Time: {project.missionTime} hours · {project.componentIds.length} components</p>
        </div>
        <button className="btn btn-primary" onClick={runAnalysis}>▶ Run Analysis</button>
      </div>

      {project.results && (
        <>
          <div className="stats-grid" style={{ marginBottom: '16px' }}>
            <div className="stat-card">
              <div className="stat-label">Reliability R(t)</div>
              <div className="stat-value" style={{ color: project.results.systemReliability > 0.99 ? 'var(--success)' : 'var(--warning)' }}>{(project.results.systemReliability * 100).toFixed(4)}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Availability A(t)</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{(project.results.systemAvailability * 100).toFixed(4)}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">System MTBF</div>
              <div className="stat-value" style={{ color: 'var(--primary)' }}>{project.results.systemMTBF.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div className="stat-sub">hours</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">System MTTR</div>
              <div className="stat-value">{project.results.systemMTTR.toFixed(2)}</div>
              <div className="stat-sub">hours</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2>Component Results</h2></div>
            <div className="table-container">
              <table>
                <thead><tr><th>Component</th><th>R(t)</th><th>A(t)</th><th>M(t)</th><th>λ</th><th>MTBF</th><th>MTTR</th></tr></thead>
                <tbody>
                  {project.results.componentResults.map(cr => (
                    <tr key={cr.componentId}>
                      <td style={{ fontWeight: 600 }}>{cr.componentName}</td>
                      <td>{(cr.reliability * 100).toFixed(4)}%</td>
                      <td>{(cr.availability * 100).toFixed(4)}%</td>
                      <td>{(cr.maintainability * 100).toFixed(2)}%</td>
                      <td>{cr.failureRate.toExponential(3)}</td>
                      <td>{cr.mtbf.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td>{cr.mttr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
