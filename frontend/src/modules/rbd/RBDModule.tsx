import React, { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../../store';
import type { RBDProject, RBDNode, RBDLink, Component } from '../../types';

const BW = 140;
const BH = 60;

// 8 ports: 4 corners + 4 side midpoints (PowerPoint style)
const PORTS: [number, number][] = [
  [0,   0],           // 0: top-left corner
  [BW * 0.5, 0],      // 1: top-center
  [BW,   0],          // 2: top-right corner
  [0,   BH * 0.5],    // 3: middle-left
  [BW,  BH * 0.5],    // 4: middle-right
  [0,   BH],          // 5: bottom-left corner
  [BW * 0.5, BH],     // 6: bottom-center
  [BW,   BH],         // 7: bottom-right corner
];

// Snap radius in SVG units (~3-5mm at typical zoom)
const SNAP_RADIUS = 12;

function portPos(block: RBDNode, port: number): [number, number] {
  return [block.x + PORTS[port][0], block.y + PORTS[port][1]];
}

function getNearestPort(block: RBDNode, px: number, py: number): number {
  let nearest = 1;
  let minDist = Infinity;
  PORTS.forEach(([ppx, ppy], i) => {
    const dist = Math.hypot(px - (block.x + ppx), py - (block.y + ppy));
    if (dist < minDist) { minDist = dist; nearest = i; }
  });
  return nearest;
}

/** Find a port within snap radius, returns {block, port, dist} or null */
function findSnapPort(blocks: RBDNode[], px: number, py: number, excludeBlockId?: string): { block: RBDNode; port: number; dist: number } | null {
  let best: { block: RBDNode; port: number; dist: number } | null = null;
  for (const b of blocks) {
    if (b.id === excludeBlockId) continue;
    for (let i = 0; i < PORTS.length; i++) {
      const [ppx, ppy] = PORTS[i];
      const dist = Math.hypot(px - (b.x + ppx), py - (b.y + ppy));
      if (dist < SNAP_RADIUS && (!best || dist < best.dist)) {
        best = { block: b, port: i, dist };
      }
    }
  }
  return best;
}

function getBlockAtPoint(blocks: RBDNode[], px: number, py: number): RBDNode | null {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (px >= b.x && px <= b.x + BW && py >= b.y && py <= b.y + BH) return b;
  }
  return null;
}

type ConnectorMode = 'straight' | 'right-angle';

function computePath(mode: ConnectorMode, sx: number, sy: number, tx: number, ty: number, elbowX?: number): string {
  if (mode === 'straight') {
    return `M${sx},${sy} L${tx},${ty}`;
  }
  const dx = Math.abs(tx - sx);
  const dy = Math.abs(ty - sy);
  if (dx < 10 || dy < 10) {
    return `M${sx},${sy} L${tx},${ty}`;
  }
  const midX = elbowX !== undefined ? elbowX : (sx + tx) / 2;
  return `M${sx},${sy} L${midX},${sy} L${midX},${ty} L${tx},${ty}`;
}

const DRAG_KEY = 'rbd_comp_id';

export default function RBDModule() {
  const { state, dispatch } = useApp();
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<{ blockId: string; port: number } | null>(null);
  const [connectEnd, setConnectEnd] = useState<{ x: number; y: number } | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projName, setProjName] = useState('');
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
  const [hoveredPort, setHoveredPort] = useState<{ blockId: string; port: number } | null>(null);
  const [drawConnector, setDrawConnector] = useState<ConnectorMode>('right-angle');
  const [copyBuffer, setCopyBuffer] = useState<RBDNode | null>(null);
  const [eraserMode, setEraserMode] = useState(false);
  const [draggingElbow, setDraggingElbow] = useState<string | null>(null);

  const project = state.rbdProjects.find((p: RBDProject) => p.id === state.selectedRBDProject);

  const updateProject = useCallback((updated: RBDProject) => {
    dispatch({ type: 'UPDATE_RBD_PROJECT', payload: { ...updated, updatedAt: new Date().toISOString() } });
  }, [dispatch]);

  const svgPoint = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
  }, []);

  const createProject = () => {
    if (!projName.trim()) return;
    const now = new Date().toISOString();
    const proj: RBDProject = { id: uuidv4(), name: projName, description: '', blocks: [], connections: [], createdAt: now, updatedAt: now };
    dispatch({ type: 'ADD_RBD_PROJECT', payload: proj });
    dispatch({ type: 'SET_SELECTED_RBD', payload: proj.id });
    setShowNewProject(false); setProjName('');
  };

  // ─── Drag-and-drop from palette ───
  const handlePaletteDragStart = (e: React.DragEvent, comp: Component) => {
    e.dataTransfer.setData(DRAG_KEY, comp.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_KEY)) e.preventDefault();
  };

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const compId = e.dataTransfer.getData(DRAG_KEY);
    if (!compId || !project) return;
    const comp = state.components.find((c: Component) => c.id === compId);
    if (!comp || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - BW / 2;
    const y = e.clientY - rect.top - BH / 2;
    const block: RBDNode = {
      id: uuidv4(), componentId: comp.id, componentName: comp.name,
      x: Math.max(0, x), y: Math.max(0, y), quantity: 1,
    };
    updateProject({ ...project, blocks: [...project.blocks, block] });
  }, [project, state.components, updateProject]);

  // ─── Eraser: click on canvas/wire ───
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (eraserMode) return; // let SVG handle it
    if (!connecting) { setSelectedBlock(null); setSelectedConnection(null); }
  };

  // ─── Block mouse drag (move) ───
  const handleBlockMouseDown = (e: React.MouseEvent, blockId: string) => {
    if (eraserMode) return;
    e.stopPropagation();
    const p = svgPoint(e);
    if (!p || !project) return;
    const block = project.blocks.find((b: RBDNode) => b.id === blockId);
    if (!block) return;
    setSelectedBlock(blockId);
    setSelectedConnection(null);
    setDragging(blockId);
    setDragOffset({ x: p.x - block.x, y: p.y - block.y });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const p = svgPoint(e);
    if (!p) return;

    if (connecting) {
      setConnectEnd({ x: p.x, y: p.y });
      return;
    }

    if (draggingElbow && project) {
      // Dragging the elbow point of a connection
      updateProject({
        ...project,
        connections: project.connections.map((l: RBDLink) =>
          l.id === draggingElbow ? { ...l, elbowX: Math.round(p.x) } : l
        ),
      });
      return;
    }

    if (dragging && project) {
      updateProject({
        ...project,
        blocks: project.blocks.map((b: RBDNode) =>
          b.id === dragging ? { ...b, x: Math.max(0, p.x - dragOffset.x), y: Math.max(0, p.y - dragOffset.y) } : b
        ),
      });
    }
  }, [dragging, dragOffset, project, updateProject, svgPoint, connecting, draggingElbow]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Finish elbow drag
    if (draggingElbow) {
      setDraggingElbow(null);
      return;
    }

    // Finish connection drag with snap-to-port
    if (connecting && project && svgRef.current) {
      const p = svgPoint(e);
      if (p) {
        // Check for snap to a port within radius
        const snap = findSnapPort(project.blocks, p.x, p.y, connecting.blockId);
        let targetBlock: RBDNode | null = null;
        let targetPort = 0;

        if (snap) {
          targetBlock = snap.block;
          targetPort = snap.port;
        } else {
          targetBlock = getBlockAtPoint(project.blocks, p.x, p.y);
          if (targetBlock && targetBlock.id !== connecting.blockId) {
            targetPort = getNearestPort(targetBlock, p.x, p.y);
          }
        }

        if (targetBlock && targetBlock.id !== connecting.blockId) {
          const link: RBDLink = {
            id: uuidv4(),
            sourceId: connecting.blockId, sourcePort: connecting.port,
            targetId: targetBlock.id, targetPort: targetPort,
            connectorType: drawConnector,
          };
          updateProject({ ...project, connections: [...project.connections, link] });
        }
      }
      setConnecting(null);
      setConnectEnd(null);
      return;
    }

    setDragging(null);
  }, [connecting, project, updateProject, svgPoint, drawConnector, draggingElbow]);

  // ─── Port mouse down: start connection drag ───
  const handlePortMouseDown = (e: React.MouseEvent, blockId: string, port: number) => {
    if (eraserMode) return;
    e.stopPropagation();
    e.preventDefault();
    if (!project) return;
    const p = svgPoint(e);
    setConnecting({ blockId, port });
    setConnectEnd(p ? { x: p.x, y: p.y } : null);
  };

  // ─── Elbow drag start ───
  const handleElbowMouseDown = (e: React.MouseEvent, linkId: string) => {
    e.stopPropagation();
    setDraggingElbow(linkId);
  };

  // ─── Delete ───
  const deleteBlock = (blockId: string) => {
    if (!project) return;
    updateProject({
      ...project,
      blocks: project.blocks.filter((b: RBDNode) => b.id !== blockId),
      connections: project.connections.filter((l: RBDLink) => l.sourceId !== blockId && l.targetId !== blockId),
    });
    setSelectedBlock(null);
  };

  const deleteSelected = () => {
    if (!project) return;
    if (selectedBlock) {
      deleteBlock(selectedBlock);
    } else if (selectedConnection) {
      deleteConnection(selectedConnection);
    }
  };

  const deleteConnection = (linkId: string) => {
    if (!project) return;
    updateProject({ ...project, connections: project.connections.filter((l: RBDLink) => l.id !== linkId) });
    setSelectedConnection(null);
  };

  const clearCanvas = () => {
    if (!project) return;
    if (!confirm('Clear all blocks and connections?')) return;
    updateProject({ ...project, blocks: [], connections: [] });
    setSelectedBlock(null); setSelectedConnection(null);
    setConnecting(null); setConnectEnd(null);
  };

  const cancelConnection = () => {
    setConnecting(null);
    setConnectEnd(null);
  };

  // ─── Copy / Paste / Duplicate ───
  const copySelectedBlock = () => {
    if (!project || !selectedBlock) return;
    const block = project.blocks.find((b: RBDNode) => b.id === selectedBlock);
    if (block) setCopyBuffer({ ...block });
  };

  const pasteBlock = () => {
    if (!project || !copyBuffer) return;
    const newBlock: RBDNode = {
      ...copyBuffer,
      id: uuidv4(),
      x: copyBuffer.x + 30,
      y: copyBuffer.y + 30,
    };
    updateProject({ ...project, blocks: [...project.blocks, newBlock] });
    setSelectedBlock(newBlock.id);
  };

  const duplicateSelected = () => {
    if (!project || !selectedBlock) return;
    const block = project.blocks.find((b: RBDNode) => b.id === selectedBlock);
    if (!block) return;
    const newBlock: RBDNode = { ...block, id: uuidv4(), x: block.x + 30, y: block.y + 30 };
    updateProject({ ...project, blocks: [...project.blocks, newBlock] });
    setSelectedBlock(newBlock.id);
  };

  // ─── No project selected ───
  if (!project) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {state.rbdProjects.length === 0 ? (
          <div className="canvas-empty">
            <h3>No RBD projects yet</h3>
            <p>Create your first Reliability Block Diagram</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowNewProject(true)}>+ New Project</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px' }}>
            {state.rbdProjects.map((p: RBDProject) => (
              <div key={p.id} className="card" style={{ width: '200px', cursor: 'pointer' }}
                onClick={() => dispatch({ type: 'SET_SELECTED_RBD', payload: p.id })}>
                <div className="card-body" style={{ padding: '12px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>{p.name}</div>
                  <div className="text-xs text-muted mt-2">{p.blocks.length} blocks · {p.connections.length} links</div>
                </div>
              </div>
            ))}
            <div className="card" style={{ width: '200px', cursor: 'pointer', borderStyle: 'dashed' }}
              onClick={() => setShowNewProject(true)}>
              <div className="card-body" style={{ padding: '12px', textAlign: 'center', color: 'var(--primary)' }}>+ New Project</div>
            </div>
          </div>
        )}
        {showNewProject && (
          <div className="modal-overlay" onClick={() => setShowNewProject(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h3>New RBD Project</h3>
                <button className="btn-icon" onClick={() => setShowNewProject(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Project Name</label>
                  <input className="form-control" value={projName} onChange={e => setProjName(e.target.value)}
                    placeholder="e.g. Pump System RBD" autoFocus
                    onKeyDown={e => e.key === 'Enter' && createProject()} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowNewProject(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={createProject}>Create</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Canvas ───
  return (
    <>
      {/* TOP TOOLBAR - centered */}
      <div className="rbd-top-toolbar" style={{ cursor: eraserMode ? 'cell' : 'default' }}>
        <div className="rbd-toolbar-center">
          <div className="rbd-toolbar-group">
            <button className={`rbd-tool-btn ${drawConnector === 'straight' ? 'active' : ''}`}
              onClick={() => { setDrawConnector('straight'); setEraserMode(false); }} title="Straight line connector">
              <svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="2"/></svg>
            </button>
            <button className={`rbd-tool-btn ${drawConnector === 'right-angle' ? 'active' : ''}`}
              onClick={() => { setDrawConnector('right-angle'); setEraserMode(false); }} title="Right-angle connector">
              <svg width="16" height="16" viewBox="0 0 16 16"><polyline points="2,14 8,14 8,2 14,2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div className="rbd-toolbar-sep" />
          <div className="rbd-toolbar-group">
            <button className="rbd-tool-btn" onClick={copySelectedBlock} disabled={!selectedBlock} title="Copy block">📋</button>
            <button className="rbd-tool-btn" onClick={pasteBlock} disabled={!copyBuffer} title="Paste block">📌</button>
            <button className="rbd-tool-btn" onClick={duplicateSelected} disabled={!selectedBlock} title="Duplicate block">🔁</button>
          </div>
          <div className="rbd-toolbar-sep" />
          <div className="rbd-toolbar-group">
            <button className={`rbd-tool-btn ${eraserMode ? 'active' : 'danger'}`}
              onClick={() => setEraserMode(!eraserMode)} title="Eraser: click wires to delete">✏️</button>
            <button className="rbd-tool-btn" onClick={clearCanvas} title="Clear all">⊠</button>
          </div>
          <div className="rbd-toolbar-sep" />
          <button className="btn btn-sm btn-ghost" style={{ fontSize: '10px', padding: '2px 8px' }}
            onClick={() => dispatch({ type: 'SET_SELECTED_RBD', payload: null })}>← Back</button>
        </div>
      </div>

      {/* Component palette panel */}
      <div className="rbd-palette">
        <div className="rbd-palette-title">Components</div>
        {state.components.length === 0 ? (
          <div className="rbd-palette-empty">Go to Components Database and add components first.</div>
        ) : (
          state.components.map((comp: Component) => (
            <div key={comp.id} className="rbd-palette-item"
              draggable
              onDragStart={e => handlePaletteDragStart(e, comp)}>
              <div className="rbd-palette-icon">⊡</div>
              <div className="rbd-palette-info">
                <div className="rbd-palette-name">{comp.name}</div>
                <div className="rbd-palette-meta">λ = {comp.failureRate.toExponential(2)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Canvas drop zone */}
      <div ref={canvasRef} style={{ position: 'absolute', top: '32px', left: 0, right: 0, bottom: 0, cursor: eraserMode ? 'not-allowed' : 'default' }}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}>
        <div className="canvas-grid-bg" />
        <svg ref={svgRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: eraserMode ? 'cell' : 'default' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setConnecting(null); setConnectEnd(null); setDragging(null); setDraggingElbow(null); }}
          onClick={handleCanvasClick}>

          <defs>
            <marker id="rbd-arrow" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0, 10 4, 0 8" fill="#58a6ff" />
            </marker>
          </defs>

          {/* Connections */}
          {project.connections.map((link: RBDLink) => {
            const src = project.blocks.find((b: RBDNode) => b.id === link.sourceId);
            const tgt = project.blocks.find((b: RBDNode) => b.id === link.targetId);
            if (!src || !tgt) return null;
            const [sx, sy] = portPos(src, link.sourcePort);
            const [tx, ty] = portPos(tgt, link.targetPort);
            const isSel = selectedConnection === link.id;
            const mode = link.connectorType || 'right-angle';
            const pathD = computePath(mode, sx, sy, tx, ty, link.elbowX);
            const isDraggingElbow = draggingElbow === link.id;

            // Elbow midpoint
            const elbowX = link.elbowX !== undefined ? link.elbowX : (sx + tx) / 2;
            const elbowY = sy;

            return (
              <g key={link.id}
                onClick={e => {
                  e.stopPropagation();
                  if (eraserMode) {
                    deleteConnection(link.id);
                  } else {
                    setSelectedConnection(link.id);
                    setSelectedBlock(null);
                  }
                }}
                style={{ cursor: eraserMode ? 'cell' : 'pointer' }}>
                <path d={pathD}
                  fill="none"
                  stroke={isSel ? '#ff6b6b' : '#58a6ff'}
                  strokeWidth={(isSel || isDraggingElbow) ? 3 : 2}
                  markerEnd="url(#rbd-arrow)" opacity="0.8" />
                <path d={pathD}
                  fill="none" stroke="transparent" strokeWidth="14" />

                {/* Draggable elbow dot on selected right-angle lines */}
                {isSel && mode === 'right-angle' && (
                  <g onMouseDown={e => handleElbowMouseDown(e, link.id)} style={{ cursor: 'grab' }}>
                    <circle cx={elbowX} cy={elbowY} r="6" fill="#58a6ff" stroke="#fff" strokeWidth="2" opacity="0.9" />
                    <circle cx={elbowX} cy={elbowY} r="3" fill="#fff" opacity="0.9" />
                    <rect x={elbowX - 12} y={elbowY - 12} width="24" height="24" fill="transparent" />
                  </g>
                )}
              </g>
            );
          })}

          {/* Preview line while dragging */}
          {connecting && connectEnd && (() => {
            const srcBlock = project.blocks.find((b: RBDNode) => b.id === connecting.blockId);
            if (!srcBlock) return null;
            const [sx, sy] = portPos(srcBlock, connecting.port);

            // Check snap preview
            const snap = findSnapPort(project.blocks, connectEnd.x, connectEnd.y, connecting.blockId);
            let endX = connectEnd.x;
            let endY = connectEnd.y;
            if (snap) {
              const [psx, psy] = portPos(snap.block, snap.port);
              endX = psx;
              endY = psy;
            }

            const previewPath = computePath(drawConnector, sx, sy, endX, endY);
            return (
              <>
                <path d={previewPath}
                  fill="none" stroke="#58a6ff" strokeWidth="2" strokeDasharray="6,4" opacity="0.7"
                  markerEnd="url(#rbd-arrow)" />
                {snap && (
                  <circle cx={endX} cy={endY} r={SNAP_RADIUS}
                    fill="none" stroke="#58a6ff" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.5" />
                )}
              </>
            );
          })()}

          {/* Blocks */}
          {project.blocks.map((block: RBDNode) => {
            const isSel = selectedBlock === block.id;
            const isHovered = hoveredBlock === block.id;
            const showPorts = isSel || isHovered || connecting !== null;
            return (
              <g key={block.id}
                transform={`translate(${block.x}, ${block.y})`}
                onMouseDown={e => handleBlockMouseDown(e, block.id)}
                onMouseEnter={() => setHoveredBlock(block.id)}
                onMouseLeave={() => { setHoveredBlock(null); setHoveredPort(null); }}>

                <rect width={BW} height={BH} rx="6"
                  fill={isSel ? 'rgba(88,166,255,.18)' : '#21262d'}
                  stroke={connecting ? '#58a6ff' : (isSel ? '#58a6ff' : '#484f58')}
                  strokeWidth={isSel ? 2 : 1.5}
                  style={{ cursor: eraserMode ? 'default' : (connecting ? 'crosshair' : 'move') }}
                  onMouseUp={(e) => {
                    if (connecting && connecting.blockId !== block.id) {
                      const snap = findSnapPort(project.blocks, connectEnd?.x || 0, connectEnd?.y || 0, connecting.blockId);
                      let targetPort = getNearestPort(block, connectEnd?.x || 0, connectEnd?.y || 0);
                      if (snap && snap.block.id === block.id) targetPort = snap.port;
                      const link: RBDLink = {
                        id: uuidv4(),
                        sourceId: connecting.blockId, sourcePort: connecting.port,
                        targetId: block.id, targetPort: targetPort,
                        connectorType: drawConnector,
                      };
                      updateProject({ ...project, connections: [...project.connections, link] });
                      setConnecting(null);
                      setConnectEnd(null);
                      e.stopPropagation();
                    }
                  }} />

                <text x={BW / 2} y={BH / 2 - 7}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#f0f6fc" fontSize="11" fontWeight="600">
                  {block.componentName.length > 18 ? block.componentName.slice(0, 18) + '..' : block.componentName}
                </text>
                <text x={BW / 2} y={BH / 2 + 9}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#8b949e" fontSize="9">
                  {(() => {
                    const comp = state.components.find((c: Component) => c.id === block.componentId);
                    return comp ? `λ=${comp.failureRate.toExponential(1)}` : 'No component';
                  })()}
                </text>

                {/* 8 ports */}
                {PORTS.map(([px, py], i) => {
                  const isPortHovered = hoveredPort?.blockId === block.id && hoveredPort?.port === i;
                  const isActivePort = connecting?.blockId === block.id && connecting?.port === i;
                  const isTargetMode = connecting !== null && connecting.blockId !== block.id;
                  const visible = showPorts || isPortHovered;
                  const r = (isActivePort || isPortHovered) ? 7 : 4;
                  return (
                    <circle key={i} cx={px} cy={py} r={r}
                      fill={isActivePort ? '#58a6ff' : (isPortHovered ? '#58a6ff' : '#21262d')}
                      stroke={isActivePort ? '#58a6ff' : (isPortHovered ? '#58a6ff' : (isTargetMode ? '#58a6ff' : '#484f58'))}
                      strokeWidth="1.5"
                      opacity={visible ? 1 : 0}
                      style={{ cursor: eraserMode ? 'default' : 'crosshair', transition: 'opacity 0.15s, r 0.1s' }}
                      onMouseEnter={() => setHoveredPort({ blockId: block.id, port: i })}
                      onMouseLeave={() => setHoveredPort(null)}
                      onMouseDown={e => handlePortMouseDown(e, block.id, i)}
                    />
                  );
                })}
              </g>
            );
          })}

          {project.blocks.length === 0 && (
            <text x="50%" y="50%" textAnchor="middle" fill="#8b949e" fontSize="13">
              Drag a component from the left panel onto the canvas
            </text>
          )}
        </svg>
      </div>

      {/* Bottom help bar */}
      <div className="canvas-help">
        {eraserMode
          ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Eraser active — click on any wire to delete it</span>
          : connecting
          ? <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Drag & release near a port to connect (snaps within range)</span>
          : <>Drag components · Drag ports to connect · Click a wire → drag its ● elbow to reshape</>
        }
      </div>

      {/* Block editor */}
      {selectedBlock && !connecting && !eraserMode && (() => {
        const block = project.blocks.find((b: RBDNode) => b.id === selectedBlock);
        if (!block) return null;
        return (
          <div className="rbd-editor">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>Block: {block.componentName}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className="btn btn-sm btn-ghost" onClick={duplicateSelected} title="Duplicate">🔁</button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteBlock(block.id)}>Delete</button>
              </div>
            </div>
            <div className="form-group">
              <label>Component</label>
              <select className="form-control" value={block.componentId}
                onChange={e => {
                  const comp = state.components.find((c: Component) => c.id === e.target.value);
                  if (comp && project) {
                    updateProject({
                      ...project,
                      blocks: project.blocks.map((b: RBDNode) =>
                        b.id === block.id ? { ...b, componentId: comp.id, componentName: comp.name } : b
                      ),
                    });
                  }
                }}>
                <option value="">— Select —</option>
                {state.components.map((c: Component) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input className="form-control" type="number" min="1" value={block.quantity}
                onChange={e => updateProject({
                  ...project,
                  blocks: project.blocks.map((b: RBDNode) =>
                    b.id === block.id ? { ...b, quantity: parseInt(e.target.value) || 1 } : b
                  ),
                })} />
            </div>
            {block.componentId && (() => {
              const comp = state.components.find((c: Component) => c.id === block.componentId);
              if (!comp) return null;
              return (
                <div style={{ marginTop: '10px', padding: '8px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: '10px' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Component Info</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', color: 'var(--text-secondary)' }}>
                    <span>λ:</span><span style={{ fontFamily: 'var(--font-mono)' }}>{comp.failureRate.toExponential(3)}</span>
                    <span>MTBF:</span><span>{comp.mtbf.toLocaleString(undefined, { maximumFractionDigits: 0 })} h</span>
                    <span>MTTR:</span><span>{comp.mttr} h</span>
                    <span>Category:</span><span>{comp.category}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}
    </>
  );
}