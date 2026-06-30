import React, { useMemo } from 'react';
import { useApp } from '../store';
import { calcSystemResults } from '../utils/rbdCalculations';

export default function ResultsPanel() {
  const { state } = useApp();

  const rbdResults = useMemo(() => {
    if (state.activeModule !== 'rbd') return null;
    const proj = state.rbdProjects.find(p => p.id === state.selectedRBDProject);
    if (!proj || proj.blocks.length === 0) return null;
    return calcSystemResults(proj.blocks, state.components, proj.connections);
  }, [state.activeModule, state.rbdProjects, state.selectedRBDProject, state.components]);

  const renderResults = () => {
    if (state.activeModule === 'rbd') {
      const proj = state.rbdProjects.find(p => p.id === state.selectedRBDProject);
      if (!proj || proj.blocks.length === 0) {
        return <div className="results-empty">● Add blocks to see results</div>;
      }

      return (
        <>
          <div className="result-card">
            <div className="result-label">System Failure Rate λs</div>
            <div className="result-value" style={{ fontSize: '16px' }}>{rbdResults ? rbdResults.totalLambda.toExponential(4) : '—'}</div>
            <div className="result-sub">failures/hour</div>
          </div>
          <div className="result-card">
            <div className="result-label">System MTBFs</div>
            <div className="result-value" style={{ fontSize: '16px' }}>{rbdResults ? rbdResults.totalMTBF.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</div>
            <div className="result-sub">hours</div>
          </div>
          <div className="result-card">
            <div className="result-label">System MTTRs</div>
            <div className="result-value" style={{ fontSize: '16px' }}>{rbdResults ? rbdResults.totalMTTR.toFixed(4) : '—'}</div>
            <div className="result-sub">hours</div>
          </div>
          <div className="result-card">
            <div className="result-label">Availability A(t)</div>
            <div className={`result-value ${rbdResults && rbdResults.availability > 0.9999 ? 'success' : 'warning'}`}>
              {rbdResults ? (rbdResults.availability * 100).toFixed(6) + '%' : '—'}
            </div>
          </div>
          <div className="result-card">
            <div className="result-label">Total Blocks</div>
            <div className="result-value">{proj.blocks.length}</div>
          </div>
          <div className="result-card">
            <div className="result-label">Connections</div>
            <div className="result-value">{proj.connections.length}</div>
          </div>
          {rbdResults && rbdResults.areaResults.map((r, i) => (
            <div key={r.blockId} className="result-card" style={{ borderLeft: '3px solid var(--primary)', padding: '8px 10px' }}>
              <div className="result-label" style={{ fontSize: '9px' }}>{r.componentName}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                {r.n === r.r ? 'Series' : `${r.r}oo${r.n}`} · λs={r.lambda_s.toExponential(3)}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>
                MTBFs={r.mtbf_s.toLocaleString(undefined, { maximumFractionDigits: 0 })}h · MTTRs={r.mttr_s.toFixed(2)}h
              </div>
            </div>
          ))}
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
