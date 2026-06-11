"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { RBDBlockData } from "@/lib/rbd-types";
import { getBlockMetrics, effectiveLambda, fmt } from "@/lib/rbd-calculations";

interface RBDNodeData {
  block: RBDBlockData;
  selected: boolean;
  [key: string]: unknown;
}

/* ── square dimensions — sharp edges (rx=0) ── */
const SQ     = 76;   // square side px
const OFFSET = 8;    // stacking offset per layer

/* ── colour per type ── */
const COLOR = {
  single: { fill: "#1a5276", stroke: "#2e86c1", back: "#154360", selStroke: "#5dade2" },
  "1oo2": { fill: "#145a32", stroke: "#1e8449", back: "#0b3d20", selStroke: "#27ae60" },
  koon:   { fill: "#6e2f0a", stroke: "#ca6f1e", back: "#4a1f06", selStroke: "#f0a500" },
} as const;

function layerCount(block: RBDBlockData): number {
  if (block.blockType === "single") return 1;
  if (block.blockType === "1oo2")   return 2;
  return Math.min(block.n ?? 2, 4);
}

function RBDNode({ data, selected }: NodeProps) {
  const { block } = data as RBDNodeData;
  const c       = COLOR[block.blockType];
  const metrics = getBlockMetrics(block);
  const effL    = effectiveLambda(block);
  const layers  = layerCount(block);

  /* canvas size: layers push squares up-right */
  const svgW = SQ + (layers - 1) * OFFSET;
  const svgH = SQ + (layers - 1) * OFFSET;

  /* the top-front square's top-left corner */
  const topX = (layers - 1) * OFFSET;
  const topY = 0;

  const redundancyLabel =
    block.blockType === "single" ? "1oo1"
    : block.blockType === "1oo2" ? "1oo2"
    : `${block.k ?? 1}oo${block.n ?? 2}`;

  /* handle positions — centred on the front square's left/right mid */
  const handleTop  = topY + SQ / 2;
  const handleTopPct = `${((handleTop / svgH) * 100).toFixed(1)}%`;

  const nodeW = svgW + 24; // room for handles on each side

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        userSelect:    "none",
        width:         nodeW,
        position:      "relative",
      }}
    >
      {/* ── 4 connection handles: top / bottom / left / right ── */}
      {/* Left — centre of front square */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          top:        handleTopPct,
          left:       (nodeW - svgW) / 2 + topX,
          background: "#60a5fa",
          border:     "2px solid #0f172a",
          width: 10, height: 10,
          borderRadius: 2,          /* square handle */
        }}
      />
      {/* Right — centre of front square */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{
          top:        handleTopPct,
          right:      (nodeW - svgW) / 2,
          background: "#60a5fa",
          border:     "2px solid #0f172a",
          width: 10, height: 10,
          borderRadius: 2,
        }}
      />
      {/* Top — centre of front square */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        style={{
          top:   0,
          left:  (nodeW - svgW) / 2 + topX + SQ / 2,
          background: "#60a5fa",
          border: "2px solid #0f172a",
          width: 10, height: 10,
          borderRadius: 2,
        }}
      />
      {/* Bottom — centre of front square */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        style={{
          bottom: "auto",
          top:    svgH,
          left:   (nodeW - svgW) / 2 + topX + SQ / 2,
          background: "#60a5fa",
          border: "2px solid #0f172a",
          width: 10, height: 10,
          borderRadius: 2,
        }}
      />

      {/* ── SVG stacked squares — sharp corners ── */}
      <svg
        width={nodeW}
        height={svgH}
        style={{ overflow: "visible", display: "block" }}
      >
        {/* Draw back layers first (bottom of stack) */}
        {Array.from({ length: layers }).map((_, i) => {
          const layerIdx = layers - 1 - i;   // 0 = frontmost
          /* back layers shift left and down */
          const ox = topX - layerIdx * OFFSET;
          const oy = layerIdx * OFFSET;
          const isFront = layerIdx === 0;

          return (
            <g key={i}>
              {/* shadow offset */}
              <rect
                x={ox + (nodeW - svgW) / 2 + 3}
                y={oy + 3}
                width={SQ} height={SQ}
                rx={0} ry={0}
                fill="rgba(0,0,0,0.4)"
              />
              {/* square — SHARP edges: rx=0 */}
              <rect
                x={ox + (nodeW - svgW) / 2}
                y={oy}
                width={SQ} height={SQ}
                rx={0} ry={0}
                fill={isFront ? c.fill : c.back}
                stroke={isFront && selected ? c.selStroke : c.stroke}
                strokeWidth={isFront ? (selected ? 2.5 : 1.8) : 1}
                strokeOpacity={isFront ? 1 : 0.6}
              />

              {/* redundancy badge inside front square */}
              {isFront && (
                <>
                  <rect
                    x={ox + (nodeW - svgW) / 2 + SQ / 2 - 20}
                    y={oy + SQ - 18}
                    width={40} height={14}
                    rx={0}
                    fill="rgba(0,0,0,0.5)"
                  />
                  <text
                    x={ox + (nodeW - svgW) / 2 + SQ / 2}
                    y={oy + SQ - 6}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={800}
                    fontFamily="'Courier New', monospace"
                    fill={selected ? c.selStroke : "#e2e8f0"}
                    letterSpacing={0.5}
                  >
                    {redundancyLabel}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* selection highlight on front square */}
        {selected && (
          <rect
            x={(nodeW - svgW) / 2 + topX}
            y={topY}
            width={SQ} height={SQ}
            rx={0} ry={0}
            fill="none"
            stroke={c.selStroke}
            strokeWidth={3}
            strokeOpacity={0.4}
          />
        )}
      </svg>

      {/* ── label + metrics below the stack ── */}
      <div
        style={{
          marginTop:     10,
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          gap:           3,
          width:         Math.max(nodeW, 150),
          textAlign:     "center",
        }}
      >
        {/* Block name */}
        <span
          style={{
            color:        "#f1f5f9",
            fontSize:     13,
            fontWeight:   700,
            whiteSpace:   "nowrap",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            maxWidth:     200,
          }}
        >
          {block.name || <span style={{ color: "#475569", fontStyle: "italic" }}>Unnamed</span>}
        </span>

        {/* Metrics box */}
        <div
          style={{
            background:    "rgba(15,23,42,0.88)",
            border:        "1px solid #334155",
            borderRadius:  0,          /* sharp metric box too */
            padding:       "5px 10px",
            display:       "flex",
            flexDirection: "column",
            gap:           3,
            minWidth:      148,
          }}
        >
          <MRow label="MTBF"      value={metrics.mtbf === Infinity ? "∞" : `${fmt(metrics.mtbf, 0)} h`} hi />
          <MRow label="Fail. Rate" value={`${fmt(metrics.fpmh, 3)} fpmh`} />
          <MRow label="FIT"       value={fmt(metrics.fit, 1)} />
          {block.blockType !== "single" && (
            <MRow label="λ_eff" value={`${fmt(effL * 1e6, 3)} fpmh`} accent />
          )}
          {metrics.availability !== undefined && (
            <MRow label="Avail." value={`${(metrics.availability * 100).toFixed(3)}%`} accent />
          )}
        </div>
      </div>
    </div>
  );
}

function MRow({ label, value, hi, accent }: { label: string; value: string; hi?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ color: "#64748b", fontSize: 10, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{
        fontSize:   10,
        fontFamily: "'Courier New', monospace",
        fontWeight: hi ? 700 : 500,
        color:      accent ? "#93c5fd" : hi ? "#e2e8f0" : "#94a3b8",
        whiteSpace: "nowrap",
      }}>
        {value}
      </span>
    </div>
  );
}

export default memo(RBDNode);
