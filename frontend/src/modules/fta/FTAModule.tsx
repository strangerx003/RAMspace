import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../../store';
import type { FTAProject, FTANode, FTANodeType, FTAGateType } from '../../types';

const NODE_TYPES: { type: FTANodeType; label: string; color: string }[] = [
  { type: 'top-event', label: 'Top Event', color: '#f87171' },
  { type: 'intermediate', label: 'Intermediate', color: '#fbbf24' },
  { type: 'basic-event', label: 'Basic Event', color: '#60a5fa' },
  { type: 'undeveloped', label: 'Undeveloped', color: '#8b8fa8' },
];

const GATE_TYPES: FTAGateType[] = ['AND', 'OR', 'XOR'];

export default function FTAModule() {
  const { state, dispatch } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [showAddNode, setShowAddNode] = useState<string | null>(null); // parent id
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState<FTANodeType>('basic-event');
  const [newGateType, setNewGateType] = useState<FTAGateType>('AND');
  const [newFailRate, setNewFailRate] = useState(0.0001);

  const project = state.ftaProjects.find((p: FTAProject) => p.id === state.selectedFTAProject);

  const createProject = () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const topEvent: FTANode = { id: uuidv4(), name: name, type: 'top-event', gateType: 'OR', children: [], x: 400, y: 60 };
    const proj: FTAProject = { id: uuidv4(), name, description: '', topEvent: topEvent, createdAt: now, updatedAt: now };
    dispatch({ type: 'ADD_FTA_PROJECT', payload: proj });
    dispatch({ type: 'SET_SELECTED_FTA', payload: proj.id });
    setShowNew(false); setName('');
  };

  const addChild = (parentId: string) => {
    if (!project?.topEvent || !newNodeName.trim()) return;
    const child: FTANode = {
      id: uuidv4(), name: newNodeName, type: newNodeType,
      gateType: newNodeType === 'basic-event' || newNodeType === 'undeveloped' ? '' : newGateType,
      failureRate: newNodeType === 'basic-event' ? newFailRate : undefined,
      probability: newNodeType === 'basic-event' ? newFailRate * 8760 : undefined,
      children: [], x: 0, y: 0,
    };
    const updated = addNodeRecursive({ ...project.topEvent }, parentId, child);
    dispatch({ type: 'UPDATE_FTA_PROJECT', payload: { ...project, topEvent: updated, updatedAt: new Date().toISOString() } });
    setShowAddNode(null); setNewNodeName(''); setNewFailRate(0.0001);
    dispatch({ type: 'SHOW_TOAST', payload: 'Node added' });
  };

  const addNodeRecursive = (node: FTANode, parentId: string, child: FTANode): FTANode => {
    if (node.id === parentId) {
      return { ...node, children: [...node.children, child] };
    }
    return { ...node, children: node.children.map(c => addNodeRecursive(c, parentId, child)) };
  };

  const deleteNode = (parentId: string, nodeId: string) => {
    if (!project?.topEvent) return;
    const updated = deleteNodeRecursive({ ...project.topEvent }, parentId, nodeId);
    dispatch({ type: 'UPDATE_FTA_PROJECT', payload: { ...project, topEvent: updated, updatedAt: new Date().toISOString() } });
  };

  const deleteNodeRecursive = (node: FTANode, parentId: string, nodeId: string): FTANode => {
    if (node.id === parentId) {
      return { ...node, children: node.children.filter(c => c.id !== nodeId) };
    }
    return { ...node, children: node.children.map(c => deleteNodeRecursive(c, parentId, nodeId)) };
  };

  // Calculate top event probability
  const calcProbability = (node: FTANode): number => {
    if (node.type === 'basic-event') return node.probability || 0;
    if (node.type === 'undeveloped') return node.probability || 0.01;
    const childProbs = node.children.map(c => calcProbability(c));
    if (childProbs.length === 0) return 0;
    if (node.gateType === 'AND') return childProbs.reduce((a, b) => a * b, 1);
    if (node.gateType === 'OR') return 1 - childProbs.reduce((a, b) => a * (1 - b), 1);
    if (node.gateType === 'XOR') {
      // XOR: exactly one event occurs = sum(pi * product(1-pj for j!=i))
      return childProbs.reduce((sum, pi, i) => {
        const othersProduct = childProbs.reduce((prod, pj, j) => j === i ? prod : prod * (1 - pj), 1);
        return sum + pi * othersProduct;
      }, 0);
    }
    return childProbs.reduce((a, b) => a + b - a * b, 0);
  };

  // Render tree SVG
  const renderTree = (node: FTANode, x: number, y: number, levelWidth: number): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    const childCount = node.children.length;
    const childSpacing = Math.max(levelWidth / Math.max(childCount, 1), 120);
    const startX = x - ((childCount - 1) * childSpacing) / 2;

    node.children.forEach((child, i) => {
      const cx = childCount === 1 ? x : startX + i * childSpacing;
      const cy = y + 100;
      elements.push(
        <line key={`link-${node.id}-${child.id}`} x1={x} y1={y + 25} x2={cx} y2={cy - 25} stroke="#5c6078" strokeWidth="1.5" />
      );
      elements.push(...renderTree(child, cx, cy, levelWidth / Math.max(childCount, 1)));
    });

    const color = NODE_TYPES.find(n => n.type === node.type)?.color || '#60a5fa';
    const r = node.type === 'top-event' ? 28 : node.type === 'basic-event' ? 22 : 24;

    elements.push(
      <g key={node.id} className={`fta-node ${node.type}`}>
        <circle cx={x} cy={y} r={r} style={{ stroke: color, fill: `${color}15` }} />
        <text x={x} y={y - 4} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: '9px', fill: '#f0f6fc', fontWeight: 600 }}>
          {node.name.length > 12 ? node.name.slice(0, 12) + '..' : node.name}
        </text>
        {node.gateType && (
          <text x={x} y={y + 10} textAnchor="middle"
            style={{ fontSize: '8px', fill: color, fontWeight: 700 }}>{node.gateType}</text>
        )}
        {node.type === 'basic-event' && node.probability !== undefined && (
          <text x={x} y={y + r + 14} textAnchor="middle"
            style={{ fontSize: '8px', fill: '#8b949e' }}>P={node.probability.toExponential(2)}</text>
        )}
        {node.type !== 'basic-event' && node.type !== 'undeveloped' && (
          <g onClick={() => setShowAddNode(node.id)} style={{ cursor: 'pointer' }}>
            <circle cx={x + r - 2} cy={y - r + 2} r="8" fill="var(--surface)" stroke="var(--border-light)" strokeWidth="1" />
            <text x={x + r - 2} y={y - r + 2} textAnchor="middle" dominantBaseline="middle"
              fontSize="10" fill="var(--primary)">+</text>
          </g>
        )}
        {node.type !== 'top-event' && (
          <g onClick={() => {
            const findParent = (n: FTANode, targetId: string): string | null => {
              for (const c of n.children) {
                if (c.id === targetId) return n.id;
                const found = findParent(c, targetId);
                if (found) return found;
              }
              return null;
            };
            if (project?.topEvent) {
              const parentId = findParent(project.topEvent, node.id);
              if (parentId) deleteNode(parentId, node.id);
            }
          }} style={{ cursor: 'pointer' }}>
            <circle cx={x - r + 2} cy={y - r + 2} r="7" fill="var(--danger-bg)" stroke="var(--danger)" strokeWidth="1" />
            <text x={x - r + 2} y={y - r + 2} textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fill="var(--danger)">×</text>
          </g>
        )}
      </g>
    );

    return elements;
  };

  if (!project) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {state.ftaProjects.length === 0 ? (
          <div className="canvas-empty">
            <h3>No Fault Tree Analyses</h3>
            <p>Build a top-down failure model</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowNew(true)}>+ New FTA</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {state.ftaProjects.map((p: FTAProject) => (
              <div key={p.id} className="card" style={{ width: '200px', cursor: 'pointer' }} onClick={() => dispatch({ type: 'SET_SELECTED_FTA', payload: p.id })}>
                <div className="card-body" style={{ padding: '12px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{p.name}</div>
                  <div className="text-xs text-muted mt-2">{p.topEvent?.children.length || 0} child events</div>
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
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <div className="modal-header"><h3>New Fault Tree Analysis</h3><button className="btn-icon" onClick={() => setShowNew(false)}>✕</button></div>
              <div className="modal-body">
                <div className="form-group"><label>Top Event Name</label><input className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. System Failure" autoFocus /></div>
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

  const topProb = project.topEvent ? calcProbability(project.topEvent) : 0;

  return (
    <>
      <div className="canvas-grid-bg" />
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox="0 0 1200 900" preserveAspectRatio="xMidYMin meet">
        {project.topEvent && renderTree(project.topEvent, 600, 80, 900)}
      </svg>

      <div className="canvas-toolbar">
        <button className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: 'SET_SELECTED_FTA', payload: null })}>← Back</button>
      </div>

      {/* Top event probability */}
      <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', zIndex: 10 }}>
        <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>Top Event Probability</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: topProb > 0.01 ? 'var(--danger)' : 'var(--success)', fontFamily: 'var(--font-mono)' }}>{(topProb * 100).toFixed(6)}%</div>
      </div>

      {/* Add node modal */}
      {showAddNode && (
        <div className="modal-overlay" onClick={() => setShowAddNode(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header"><h3>Add Child Node</h3><button className="btn-icon" onClick={() => setShowAddNode(null)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group"><label>Name</label><input className="form-control" value={newNodeName} onChange={e => setNewNodeName(e.target.value)} autoFocus /></div>
              <div className="form-row">
                <div className="form-group"><label>Type</label><select className="form-control" value={newNodeType} onChange={e => setNewNodeType(e.target.value as FTANodeType)}>
                  {NODE_TYPES.filter(n => n.type !== 'top-event').map(n => <option key={n.type} value={n.type}>{n.label}</option>)}
                </select></div>
                {newNodeType !== 'basic-event' && newNodeType !== 'undeveloped' && (
                  <div className="form-group"><label>Gate</label><select className="form-control" value={newGateType} onChange={e => setNewGateType(e.target.value as FTAGateType)}>
                    {GATE_TYPES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select></div>
                )}
              </div>
              {newNodeType === 'basic-event' && (
                <div className="form-group"><label>Failure Rate (per hour)</label><input className="form-control" type="number" step="any" value={newFailRate} onChange={e => setNewFailRate(parseFloat(e.target.value) || 0)} /></div>
              )}
              {newNodeType === 'basic-event' && (
                <div className="form-group">
                  <label>Component from DB (optional)</label>
                  <select className="form-control" onChange={e => {
                    const comp = state.components.find((c: any) => c.id === e.target.value);
                    if (comp) { setNewNodeName(comp.name); setNewFailRate(comp.failureRate); }
                  }}>
                    <option value="">— Link component —</option>
                    {state.components.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAddNode(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => addChild(showAddNode)}>Add</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
