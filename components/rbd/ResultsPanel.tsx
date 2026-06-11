"use client";

import { RBDBlockData } from "@/lib/rbd-types";
import { calculateSystemResults, fmt } from "@/lib/rbd-calculations";
import { TrendingUp, AlertCircle } from "lucide-react";

interface ResultsPanelProps {
  blocks: RBDBlockData[];
}

export default function ResultsPanel({ blocks }: ResultsPanelProps) {
  const results = calculateSystemResults(blocks);

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TrendingUp size={14} className="text-blue-400" />
        <span className="text-slate-300 text-xs font-semibold uppercase tracking-widest">
          System Results
        </span>
      </div>

      {!results ? (
        <div className="flex items-center gap-2 text-slate-600 text-xs">
          <AlertCircle size={12} />
          <span>Add blocks to see results</span>
        </div>
      ) : (
        <>
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
            <ResultRow
              label="System MTBF"
              value={results.systemMTBF === Infinity ? "∞" : `${fmt(results.systemMTBF, 0)} h`}
              accent
            />
            <ResultRow
              label="System λ (f/h)"
              value={fmt(results.systemLambda, 8)}
            />
            <ResultRow
              label="System FPMH"
              value={fmt(results.systemFPMH, 4)}
            />
            <ResultRow
              label="System FIT"
              value={fmt(results.systemFIT, 2)}
            />
            {results.systemAvailability !== undefined && (
              <ResultRow
                label="System Availability"
                value={`${(results.systemAvailability * 100).toFixed(4)}%`}
                accent
              />
            )}
          </div>

          <div className="text-slate-600 text-[10px] space-y-1">
            <p>• {results.blockCount} block{results.blockCount > 1 ? "s" : ""} in series topology</p>
            <p>• Exponential failure law (constant λ)</p>
            <p>• Per EN 50126 / IEC 61078</p>
            {results.systemAvailability === undefined && (
              <p className="text-slate-700">• Add MTTR to all blocks for availability</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ResultRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-400 text-[10px]">{label}</span>
      <span className={`text-[11px] font-mono font-semibold ${accent ? "text-blue-300" : "text-slate-200"}`}>
        {value}
      </span>
    </div>
  );
}
