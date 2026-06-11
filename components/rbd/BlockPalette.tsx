"use client";

import { BlockType } from "@/lib/rbd-types";
import { Plus } from "lucide-react";

const SQ = 36;
const OFF = 5;

const COLORS = {
  single: { fill: "#1a5276", stroke: "#2e86c1" },
  "1oo2": { fill: "#145a32", stroke: "#1e8449" },
  koon:   { fill: "#7d6608", stroke: "#d4ac0d" },
};

interface PaletteProps {
  onAddBlock: (type: BlockType) => void;
}

const items: { type: BlockType; label: string; layers: number; badge: string; desc: string }[] = [
  { type: "single", label: "Single Block", layers: 1, badge: "1oo1", desc: "Series — no redundancy"       },
  { type: "1oo2",   label: "1oo2 Block",   layers: 2, badge: "1oo2", desc: "Active 1-of-2 redundancy"    },
  { type: "koon",   label: "KooN Block",   layers: 4, badge: "KooN", desc: "K-of-N voting redundancy"    },
];

export default function BlockPalette({ onAddBlock }: PaletteProps) {
  return (
    <div className="w-44 border-r border-slate-700/60 bg-[#0f172a] flex flex-col overflow-y-auto shrink-0">
      <div className="px-3 pt-4 pb-1">
        <div className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest mb-1">
          Block Library
        </div>
        <p className="text-slate-600 text-[10px] leading-relaxed">
          Click to add to canvas
        </p>
      </div>

      <div className="px-2 py-3 space-y-3">
        {items.map((item) => {
          const c = COLORS[item.type];
          const svgW = SQ + (item.layers - 1) * OFF;
          const svgH = SQ + (item.layers - 1) * OFF;

          return (
            <button
              key={item.type}
              onClick={() => onAddBlock(item.type)}
              className="w-full text-left rounded-lg border border-slate-700/60 bg-slate-800/30
                hover:bg-slate-700/40 hover:border-slate-600 transition-all duration-150 p-3 group"
            >
              {/* Stacked square preview */}
              <div className="flex justify-center mb-2" style={{ height: svgH + 4 }}>
                <svg width={svgW} height={svgH} style={{ overflow: "visible" }}>
                  {Array.from({ length: item.layers }).map((_, i) => {
                    const idx = item.layers - 1 - i;
                    const ox  = (item.layers - 1 - idx) * OFF;
                    const oy  = idx * OFF;
                    return (
                      <rect
                        key={i}
                        x={ox} y={oy}
                        width={SQ} height={SQ}
                        rx={3}
                        fill={c.fill}
                        stroke={c.stroke}
                        strokeWidth={1.5}
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Label + badge */}
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-200 text-xs font-semibold">{item.label}</span>
                <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-bold">
                  {item.badge}
                </span>
              </div>
              <p className="text-slate-500 text-[10px] mt-0.5">{item.desc}</p>

              <div className="mt-1.5 flex items-center gap-1 text-slate-600 group-hover:text-slate-400 transition-colors">
                <Plus size={9} />
                <span className="text-[9px]">Add to canvas</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-auto px-3 py-3 border-t border-slate-700/60">
        <p className="text-slate-600 text-[9px] leading-relaxed">
          Blocks connect in series. Each group may be internally redundant.
        </p>
      </div>
    </div>
  );
}
