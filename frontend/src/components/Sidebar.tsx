import React from 'react';
import { useApp } from '../store';
import type { ModuleId } from '../types';

const MODULES: { id: ModuleId; name: string; desc: string; icon: string; available: boolean }[] = [
  { id: 'components-db', name: 'Components Database', desc: 'Reliability component library', icon: '📦', available: true },
  { id: 'rbd', name: 'Reliability Block Diagram', desc: 'IEC 61078 compliant block diagrams', icon: '⊞', available: true },
  { id: 'ram', name: 'RAM Analysis', desc: 'EN 50126 RAM prediction', icon: '📊', available: true },
  { id: 'fta', name: 'Fault Tree Analysis', desc: 'Top-down failure analysis', icon: '⊠', available: true },
  { id: 'fmeca', name: 'FMECA', desc: 'Failure Mode Effects & Criticality', icon: '⚠', available: false },
  { id: 'reliability', name: 'Reliability Calculations', desc: 'MTBF, MTTR, availability calc', icon: '∑', available: false },
  { id: 'lcc', name: 'Life Cycle Cost', desc: 'LCC analysis & modelling', icon: '€', available: false },
  { id: 'spares', name: 'Spare Parts Analysis', desc: 'Spare parts optimisation', icon: '⊡', available: false },
  { id: 'monitoring', name: 'RAM Monitoring', desc: 'Performance tracking & KPIs', icon: '◉', available: false },
  { id: 'demonstration', name: 'RAM Demonstration', desc: 'Compliance demonstration', icon: '✓', available: false },
];

export default function Sidebar() {
  const { state, dispatch } = useApp();

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="sidebar-section-title">Analysis Modules</div>
          {MODULES.map(mod => (
            <div
              key={mod.id}
              className={`module-item ${state.activeModule === mod.id ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_MODULE', payload: mod.id })}
            >
              <div className="module-icon">{mod.icon}</div>
              <div className="module-info">
                <div className="module-name">
                  {mod.name}
                  {!mod.available && <span className="badge-soon">SOON</span>}
                </div>
                <div className="module-desc">{mod.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
