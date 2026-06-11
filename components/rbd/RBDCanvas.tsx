"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  EdgeChange,
  Node,
  BackgroundVariant,
  Panel,
  NodeMouseHandler,
  EdgeMouseHandler,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RBDBlockData, BlockType } from "@/lib/rbd-types";
import RBDNode from "./RBDNode";
import BlockContextMenu from "./BlockContextMenu";

const nodeTypes = { rbdBlock: RBDNode };

/* ── default edge style — orthogonal step edges ── */
const EDGE_DEFAULTS = {
  type:        "smoothstep",           // right-angle bends
  style:       { stroke: "#2e86c1", strokeWidth: 2 },
  markerEnd:   { type: MarkerType.ArrowClosed, color: "#2e86c1", width: 14, height: 14 },
  animated:    false,
};

/* ── selected edge style ── */
const EDGE_SELECTED = {
  style:     { stroke: "#f59e0b", strokeWidth: 2.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b", width: 14, height: 14 },
};

interface RBDCanvasProps {
  blocks: RBDBlockData[];
  selectedBlockId: string | null;
  onSelectBlock:  (id: string | null) => void;
  onOpenModal:    (id: string) => void;
  onDeleteBlock:  (id: string) => void;
  onAddBlock:     (type: BlockType) => void;
}

interface CtxMenu { blockId: string; x: number; y: number }

function blocksToNodes(blocks: RBDBlockData[], selectedId: string | null): Node[] {
  return blocks.map((block, i) => ({
    id:       block.id,
    type:     "rbdBlock",
    position: { x: 160 + i * 240, y: 140 },
    data:     { block, selected: block.id === selectedId },
    selected: block.id === selectedId,
  }));
}

function blocksToEdges(blocks: RBDBlockData[]): Edge[] {
  return blocks.slice(0, -1).map((block, i) => ({
    id:         `e-${block.id}-${blocks[i + 1].id}`,
    source:     block.id,
    target:     blocks[i + 1].id,
    sourceHandle: "right",
    targetHandle: "left",
    ...EDGE_DEFAULTS,
  }));
}

export default function RBDCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onOpenModal,
  onDeleteBlock,
  onAddBlock,
}: RBDCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    useMemo(() => blocksToNodes(blocks, selectedBlockId), [])
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    useMemo(() => blocksToEdges(blocks), [])
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu]               = useState<CtxMenu | null>(null);

  /* sync block data → nodes, preserve user-moved positions */
  useEffect(() => {
    setNodes((prev) => {
      const posMap: Record<string, { x: number; y: number }> = {};
      prev.forEach((n) => { posMap[n.id] = n.position; });
      return blocks.map((block, i) => ({
        id:       block.id,
        type:     "rbdBlock",
        position: posMap[block.id] ?? { x: 160 + i * 240, y: 140 },
        data:     { block, selected: block.id === selectedBlockId },
        selected: block.id === selectedBlockId,
      }));
    });
    /* only rebuild default edges for NEW blocks; don't clobber user-drawn edges */
    setEdges((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const defaultEdges = blocksToEdges(blocks);
      const toAdd = defaultEdges.filter((e) => !existingIds.has(e.id));
      /* remove edges whose source/target block no longer exists */
      const blockIds = new Set(blocks.map((b) => b.id));
      const kept = prev.filter((e) => blockIds.has(e.source) && blockIds.has(e.target));
      return [...kept, ...toAdd];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, selectedBlockId]);

  /* new connection drawn by user */
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => addEdge({ ...params, ...EDGE_DEFAULTS }, eds)),
    [setEdges]
  );

  /* click node = highlight, no panel */
  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => { setCtxMenu(null); onSelectBlock(node.id); },
    [onSelectBlock]
  );

  /* double-click = open modal */
  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => { setCtxMenu(null); onOpenModal(node.id); },
    [onOpenModal]
  );

  /* right-click node = context menu */
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setCtxMenu({ blockId: node.id, x: event.clientX, y: event.clientY });
      onSelectBlock(node.id);
    },
    [onSelectBlock]
  );

  /* click edge = select it (highlight amber) */
  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_, edge) => {
      setSelectedEdgeId((prev) => (prev === edge.id ? null : edge.id));
      onSelectBlock(null);          // deselect any node
    },
    [onSelectBlock]
  );

  /* pane click = deselect all */
  const onPaneClick = useCallback(() => {
    onSelectBlock(null);
    setSelectedEdgeId(null);
    setCtxMenu(null);
  }, [onSelectBlock]);

  /* keyboard */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEdgeId) {
          /* delete selected edge */
          setEdges((eds) => eds.filter((ed) => ed.id !== selectedEdgeId));
          setSelectedEdgeId(null);
        } else if (selectedBlockId) {
          onDeleteBlock(selectedBlockId);
        }
      }
      if (e.key === "Escape") { setCtxMenu(null); setSelectedEdgeId(null); }
    },
    [selectedEdgeId, selectedBlockId, onDeleteBlock, setEdges]
  );

  /* apply selection highlight to edges */
  const displayEdges = edges.map((e) =>
    e.id === selectedEdgeId
      ? { ...e, ...EDGE_SELECTED }
      : { ...e, ...EDGE_DEFAULTS }
  );

  return (
    <div className="w-full h-full outline-none relative" tabIndex={0} onKeyDown={onKeyDown}>
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        connectionMode={"loose" as any}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        style={{ background: "#1e293b" }}
        deleteKeyCode={null}          /* we handle delete ourselves */
        snapToGrid
        snapGrid={[16, 16]}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 0 }} />
        <MiniMap
          nodeColor={(node) => {
            const b = node.data?.block as RBDBlockData;
            if (b?.blockType === "1oo2") return "#1e8449";
            if (b?.blockType === "koon") return "#ca6f1e";
            return "#2e86c1";
          }}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 0 }}
        />

        {blocks.length === 0 && (
          <Panel position="top-center">
            <div className="mt-10 text-center pointer-events-none select-none">
              <div className="text-slate-500 text-sm font-medium">Canvas is empty</div>
              <div className="text-slate-600 text-xs mt-1">Click a block type in the left panel to add it</div>
            </div>
          </Panel>
        )}

        {blocks.length > 0 && (
          <Panel position="top-left">
            <div className="ml-2 mt-2 flex items-center gap-2 text-xs text-slate-500 pointer-events-none select-none">
              <span className="w-2 h-2 bg-green-500 inline-block" />
              <span>IN</span>
              <span className="text-slate-700">───</span>
              <span className="text-slate-400">{blocks.length} block{blocks.length !== 1 ? "s" : ""}</span>
              <span className="text-slate-700">───</span>
              <span className="w-2 h-2 bg-red-500 inline-block" />
              <span>OUT</span>
            </div>
          </Panel>
        )}

        <Panel position="bottom-left">
          <div className="text-slate-600 text-[10px] pointer-events-none select-none">
            Double-click / right-click block to edit · Click edge then Del to remove · Drag handle to connect
          </div>
        </Panel>
      </ReactFlow>

      {ctxMenu && (
        <BlockContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          blockId={ctxMenu.blockId}
          onEdit={()   => { onOpenModal(ctxMenu.blockId);  setCtxMenu(null); }}
          onDelete={()  => { onDeleteBlock(ctxMenu.blockId); setCtxMenu(null); }}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
