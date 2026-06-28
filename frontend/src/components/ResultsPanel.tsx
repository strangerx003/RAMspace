import React from 'react';
import { useApp } from '../store';

export default function ResultsPanel() {
  const { state } = useApp();

  const renderResults = () => {
    if (state.activeModule === 'rbd') {
      const proj = state.rbdProjects.find(p => p.id === state.selectedRBDProject);
      if (!proj || proj.blocks.length === 0) {
        return <div className="results-empty">● Add blocks to see results</div>;
      }
      // Use a default mission time of 8760 hours (1 year) for system-level RBD analysis
      const systemMissionTime = 8760;
      let sysRel = 1;
      let totalFailureRate = 0;
      proj.blocks.forEach(block => {
        const comp = state.components.find(c => c.id === block.componentId);
        if (comp) {
          const R = Math.exp(-comp.failureRate * systemMissionTime);
          sysRel *= Math.pow(R, block.quantity);
          totalFailureRate += comp.failureRate * block.quantity;
        }
      });
      const sysMTBF = totalFailureRate > 0 ? 1 / totalFailureRate : Infinity;

      return (
        <>
          <div className="result-card">
            <div className="result-label">System Reliability R(t)</div>
            <div className={`result-value ${sysRel > 0.99 ? 'success' : sysRel > 0.9 ? 'warning' : 'danger'}`}>
              {(sysRel * 100).toFixed(4)}%
            </div>
          </div>
          <div className="result-card">
            <div className="result-label">System MTBF</div>
            <div className="result-value">{sysMTBF === Infinity ? '—' : sysMTBF.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="result-sub">hours (system)</div>
          </div>
          <div className="result-card">
            <div className="result-label">Total Blocks</div>
            <div className="result-value">{proj.blocks.length}</div>
          </div>
          <div className="result-card">
            <div className="result-label">Connections</div>
            <div className="result-value">{proj.connections.length}</div>
          </div>
        </>
      );
    }

    if (state.activeModule === 'ram') {
      const proj = state.ramProjects.find(p => p.id === state.selectedRAMProject);
      if (!proj || !proj.results) {
        return <div className="results-empty">● Run analysis to see results</div>;
      }
      const r = proj.results;
      return (
        <>
          <div className="result-card">
            <div className="result-label">System Reliability</div>
            <div className={`result-value ${r.systemReliability > 0.99 ? 'success' : 'warning'}`}>{(r.systemReliability * 100).toFixed(4)}%</div>
          </div>
          <div className="result-card">
            <div className="result-label">System Availability</div>
            <div className="result-value success">{(r.systemAvailability * 100).toFixed(4)}%</div>
          </div>
          <div className="result-card">
            <div className="result-label">Maintainability</div>
            <div className="result-value">{(r.systemMaintainability * 100).toFixed(2)}%</div>
          </div>
          <div className="result-card">
            <div className="result-label">System MTBF</div>
            <div className="result-value">{r.systemMTBF.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="result-sub">hours</div>
          </div>
          <div className="result-card">
            <div className="result-label">System MTTR</div>
            <div className="result-value">{r.systemMTTR.toFixed(2)}</div>
            <div className="result-sub">hours</div>
          </div>
        </>
      );
    }

    return <div className="results-empty">● Select a module to see results</div>;
  };

  return (
    <div className="results-panel">
      <div className="results-title">
        <span>◈</span> System Results
      </div>
      {renderResults()}
    </div>
  );
}
