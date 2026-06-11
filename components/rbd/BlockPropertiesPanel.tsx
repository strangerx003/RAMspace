"use client";

import { useState, useEffect } from "react";
import { RBDBlockData, BlockType, InputMode } from "@/lib/rbd-types";
import { getBlockMetrics, effectiveLambda, fmt } from "@/lib/rbd-calculations";
import { Trash2, Settings, X } from "lucide-react";

interface BlockPropertiesPanelProps {
  block: RBDBlockData | null;
  onUpdate: (block: RBDBlockData) => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}

const blockTypeOptions: { value: BlockType; label: string; desc: string }[] = [
  { value: "single", label: "Single (1oo1)", desc: "Series — no redundancy" },
  { value: "1oo2", label: "1oo2 Parallel", desc: "Active — 1 of 2 must work" },
  { value: "koon", label: "KooN Voting", desc: "K of N must work" },
];

const inputModeOptions: { value: InputMode; label: string; placeholder: string }[] = [
  { value: "mtbf", label: "MTBF (hours)", placeholder: "e.g. 50000" },
  { value: "fr", label: "Failure Rate λ (f/h)", placeholder: "e.g. 0.00002" },
  { value: "fpmh", label: "FPMH (f/10⁶h)", placeholder: "e.g. 20" },
  { value: "fit", label: "FIT (f/10⁹h)", placeholder: "e.g. 20000" },
];

export default function BlockPropertiesPanel({
  block,
  onUpdate,
  onDelete,
  onClose,
}: BlockPropertiesPanelProps) {
  const [local, setLocal] = useState<RBDBlockData | null>(block);

  useEffect(() => {
    setLocal(block);
  }, [block?.id]);

  if (!local || !block) {
    return (
      <div className="p-4 border-b border-slate-700/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-slate-500" />
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
              Properties
            </span>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-slate-600 hover:text-slate-300 p-1 rounded hover:bg-slate-700">
              <X size={13} />
            </button>
          )}
        </div>
        <p className="text-slate-600 text-xs">No block selected.</p>
      </div>
    );
  }

  const metrics = getBlockMetrics(local);
  const effLambda = effectiveLambda(local);

  const push = (patch: Partial<RBDBlockData>) => {
    const updated = { ...local, ...patch };
    setLocal(updated);
    onUpdate(updated);
  };

  const inputField = inputModeOptions.find((o) => o.value === local.inputMode)!;
  const currentValue = (() => {
    switch (local.inputMode) {
      case "mtbf": return local.mtbf?.toString() ?? "";
      case "fr": return local.fr?.toString() ?? "";
      case "fpmh": return local.fpmh?.toString() ?? "";
      case "fit": return local.fit?.toString() ?? "";
    }
  })();

  const handleValueChange = (raw: string) => {
    const val = parseFloat(raw);
    const num = isNaN(val) ? undefined : val;
    switch (local.inputMode) {
      case "mtbf": push({ mtbf: num }); break;
      case "fr": push({ fr: num }); break;
      case "fpmh": push({ fpmh: num }); break;
      case "fit": push({ fit: num }); break;
    }
  };

  return (
    <div className="p-4 border-b border-slate-700/60 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-slate-400" />
          <span className="text-slate-300 text-xs font-semibold uppercase tracking-widest">
            Block Properties
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDelete(local.id)}
            className="text-red-500/70 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"
            title="Delete block"
          >
            <Trash2 size={13} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded hover:bg-slate-700"
              title="Close panel"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-slate-400 text-[10px] uppercase tracking-wider mb-1">
          Block Name
        </label>
        <input
          type="text"
          value={local.name}
          onChange={(e) => push({ name: e.target.value })}
          className="w-full bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-sm text-slate-200 
            focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
        />
      </div>

      {/* Block Type */}
      <div>
        <label className="block text-slate-400 text-[10px] uppercase tracking-wider mb-1">
          Block Type / Redundancy
        </label>
        <div className="space-y-1.5">
          {blockTypeOptions.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-2.5 p-2 rounded-md border cursor-pointer transition-colors
                ${local.blockType === opt.value
                  ? "border-blue-500/50 bg-blue-600/10"
                  : "border-slate-700 hover:border-slate-600"}`}
            >
              <input
                type="radio"
                name="blockType"
                value={opt.value}
                checked={local.blockType === opt.value}
                onChange={() => push({ blockType: opt.value as BlockType })}
                className="mt-0.5 accent-blue-500"
              />
              <div>
                <div className="text-slate-200 text-xs font-medium">{opt.label}</div>
                <div className="text-slate-500 text-[10px]">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* KooN parameters */}
      {local.blockType === "koon" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-slate-400 text-[10px] uppercase tracking-wider mb-1">
              K (required)
            </label>
            <input
              type="number"
              min={1}
              max={local.n ?? 2}
              value={local.k ?? 1}
              onChange={(e) => push({ k: parseInt(e.target.value) || 1 })}
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-200
                focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-[10px] uppercase tracking-wider mb-1">
              N (total)
            </label>
            <input
              type="number"
              min={2}
              max={20}
              value={local.n ?? 2}
              onChange={(e) => push({ n: parseInt(e.target.value) || 2 })}
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-200
                focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
        </div>
      )}

      {/* Input mode selector */}
      <div>
        <label className="block text-slate-400 text-[10px] uppercase tracking-wider mb-1">
          Input Mode
        </label>
        <select
          value={local.inputMode}
          onChange={(e) => push({ inputMode: e.target.value as InputMode })}
          className="w-full bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-sm text-slate-200
            focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
        >
          {inputModeOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Value input */}
      <div>
        <label className="block text-slate-400 text-[10px] uppercase tracking-wider mb-1">
          {inputField.label}
        </label>
        <input
          type="number"
          value={currentValue}
          placeholder={inputField.placeholder}
          min={0}
          step="any"
          onChange={(e) => handleValueChange(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-sm text-slate-200 font-mono
            focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
        />
      </div>

      {/* MTTR */}
      <div>
        <label className="block text-slate-400 text-[10px] uppercase tracking-wider mb-1">
          MTTR (hours) <span className="text-slate-600 normal-case">— optional, for availability</span>
        </label>
        <input
          type="number"
          value={local.mttr?.toString() ?? ""}
          placeholder="e.g. 8"
          min={0}
          step="any"
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            push({ mttr: isNaN(val) ? undefined : val });
          }}
          className="w-full bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-sm text-slate-200 font-mono
            focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
        />
      </div>

      {/* Derived metrics for this block */}
      <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50">
        <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-2">
          Derived Metrics (this block)
        </div>
        <div className="space-y-1">
          <MetricLine label="MTBF" value={`${fmt(metrics.mtbf, 0)} h`} />
          <MetricLine label="λ (f/h)" value={fmt(metrics.lambda, 8)} />
          <MetricLine label="FPMH" value={fmt(metrics.fpmh, 4)} />
          <MetricLine label="FIT" value={fmt(metrics.fit, 2)} />
          {local.blockType !== "single" && (
            <MetricLine
              label={`λ_eff (${local.blockType === "1oo2" ? "1oo2" : `${local.k ?? 1}oo${local.n ?? 2}`})`}
              value={`${fmt(effLambda * 1e6, 4)} fpmh`}
              highlight
            />
          )}
          {metrics.availability !== undefined && (
            <MetricLine
              label="Availability"
              value={`${(metrics.availability * 100).toFixed(4)}%`}
              highlight
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MetricLine({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 text-[10px]">{label}</span>
      <span className={`text-[10px] font-mono ${highlight ? "text-blue-300" : "text-slate-300"}`}>
        {value}
      </span>
    </div>
  );
}
