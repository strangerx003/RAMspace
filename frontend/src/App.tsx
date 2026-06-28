import React, { useEffect } from 'react';
import { useApp } from './store';
import Sidebar from './components/Sidebar';
import ResultsPanel from './components/ResultsPanel';
import RBDModule from './modules/rbd/RBDModule';
import RAMModule from './modules/ram/RAMModule';
import FTAModule from './modules/fta/FTAModule';
import ComponentsDB from './modules/components-db/ComponentsDB';
import ComingSoon from './components/ComingSoon';

export default function App() {
  const { state, dispatch } = useApp();

  useEffect(() => {
    if (state.toast) {
      const t = setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 3000);
      return () => clearTimeout(t);
    }
  }, [state.toast, dispatch]);

  const renderCanvas = () => {
    switch (state.activeModule) {
      case 'rbd': return <RBDModule />;
      case 'ram': return <RAMModule />;
      case 'fta': return <FTAModule />;
      case 'components-db': return <ComponentsDB />;
      case 'fmeca': return <ComingSoon title="FMECA" desc="Failure Mode Effects & Criticality Analysis" />;
      case 'lcc': return <ComingSoon title="Life Cycle Cost" desc="LCC analysis & modelling" />;
      case 'spares': return <ComingSoon title="Spare Parts Analysis" desc="Spare parts optimisation" />;
      case 'reliability': return <ComingSoon title="Reliability Calculations" desc="MTBF, MTTR, availability calculations" />;
      case 'monitoring': return <ComingSoon title="RAM Monitoring" desc="Performance tracking & KPIs" />;
      case 'demonstration': return <ComingSoon title="RAM Demonstration" desc="Compliance demonstration" />;
      default: return <ComponentsDB />;
    }
  };

  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-body">
        <Sidebar />
        <div className="canvas-area">
          {renderCanvas()}
        </div>
        <ResultsPanel />
      </div>
      {state.toast && <div className="toast">{state.toast}</div>}
    </div>
  );
}

function TopBar() {
  const { state } = useApp();

  return (
    <div className="topbar">
      <div className="topbar-logo">
        <div className="logo-icon">R</div>
        <div>
          <div className="topbar-title">RAMSspace</div>
        </div>
      </div>
      <span className="topbar-subtitle">EN 50126 · IEC 61078</span>
      <div className="topbar-sep" />
      <div className="topbar-tabs">
        {state.activeModule === 'rbd' && state.rbdProjects.map(p => (
          <div key={p.id} className={`topbar-tab ${p.id === state.selectedRBDProject ? 'active' : ''}`}>
            {p.name}
            <span className="tab-count">{p.blocks.length} blocks</span>
          </div>
        ))}
        {state.activeModule === 'rbd' && <div className="topbar-tab-add">+</div>}
      </div>
      <div className="topbar-actions">
        <button className="btn btn-ghost">Duplicate</button>
        <button className="btn btn-ghost">Clear</button>
        <button className="btn btn-primary">Export</button>
      </div>
    </div>
  );
}
