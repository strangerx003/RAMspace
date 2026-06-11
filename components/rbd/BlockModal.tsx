"use client";

import { useState, useEffect, useRef } from "react";
import { RBDBlockData, BlockType, InputMode } from "@/lib/rbd-types";
import { getBlockMetrics, effectiveLambda, fmt } from "@/lib/rbd-calculations";
import { X, Trash2, AlertCircle } from "lucide-react";

interface BlockModalProps {
  block: RBDBlockData;
  isNew?: boolean;                    // true → opened right after creation
  onSave:   (block: RBDBlockData) => void;
  onDelete: (id: string) => void;
  onClose:  () => void;
}

const inputModes: { value: InputMode; label: string; unit: string; placeholder: string }[] = [
  { value: "mtbf", label: "MTBF",          unit: "hours",   placeholder: "e.g. 50 000" },
  { value: "fr",   label: "Failure Rate λ", unit: "f/h",     placeholder: "e.g. 0.00002" },
  { value: "fpmh", label: "FPMH",           unit: "f/10⁶h",  placeholder: "e.g. 20" },
  { value: "fit",  label: "FIT",            unit: "f/10⁹h",  placeholder: "e.g. 20 000" },
];

const blockTypes: { value: BlockType; label: string; desc: string }[] = [
  { value: "single", label: "Single (1oo1)", desc: "No redundancy — series element" },
  { value: "1oo2",   label: "1oo2 Parallel", desc: "1 of 2 must work (active redundancy)" },
  { value: "koon",   label: "KooN Voting",   desc: "K of N units must work" },
];

const HEADER_COLOR: Record<BlockType, string> = {
  single: "#1d4ed8",
  "1oo2": "#065f46",
  koon:   "#92400e",
};

export default function BlockModal({
  block,
  isNew = false,
  onSave,
  onDelete,
  onClose,
}: BlockModalProps) {
  const [local, setLocal] = useState<RBDBlockData>({ ...block });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  /* auto-focus name field on open */
  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 80);
  }, []);

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const push = (patch: Partial<RBDBlockData>) =>
    setLocal((prev) => ({ ...prev, ...patch }));

  const currentValue = (): string => {
    switch (local.inputMode) {
      case "mtbf": return local.mtbf?.toString() ?? "";
      case "fr":   return local.fr?.toString()   ?? "";
      case "fpmh": return local.fpmh?.toString() ?? "";
      case "fit":  return local.fit?.toString()  ?? "";
    }
  };

  const handleValueChange = (raw: string) => {
    const num = raw === "" ? undefined : parseFloat(raw);
    switch (local.inputMode) {
      case "mtbf": push({ mtbf: num }); break;
      case "fr":   push({ fr: num });   break;
      case "fpmh": push({ fpmh: num }); break;
      case "fit":  push({ fit: num });  break;
    }
    setErrors((e) => ({ ...e, value: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!local.name.trim()) e.name = "Block name is required";
    const v = currentValue();
    if (!v || parseFloat(v) <= 0) e.value = "Enter a positive value";
    if (local.blockType === "koon") {
      const k = local.k ?? 1, n = local.n ?? 2;
      if (k < 1) e.k = "K must be ≥ 1";
      if (n < 2) e.n = "N must be ≥ 2";
      if (k >= n) e.k = "K must be less than N";
    }
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave(local);
    onClose();
  };

  const metrics  = getBlockMetrics(local);
  const effL     = effectiveLambda(local);
  const hasValue = parseFloat(currentValue()) > 0;

  const redundancyLabel =
    local.blockType === "single" ? "1oo1"
    : local.blockType === "1oo2" ? "1oo2"
    : `${local.k ?? 1}oo${local.n ?? 2}`;

  return (
    /* ── backdrop ── */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── modal card ── */}
      <div
        className="relative flex flex-col rounded-xl shadow-2xl overflow-hidden"
        style={{ width: 520, maxHeight: "90vh", background: "#0f172a", border: "1px solid #334155" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* coloured header bar */}
        <div
          style={{ background: HEADER_COLOR[local.blockType], padding: "12px 18px" }}
          className="flex items-center justify-between shrink-0"
        >
          <div>
            <div className="text-white text-sm font-bold">
              {isNew ? "New Block — Enter Details" : "Edit Block"}
            </div>
            <div className="text-white/60 text-xs mt-0.5">
              {redundancyLabel} · {local.blockType === "koon" ? `${local.k ?? 1}oo${local.n ?? 2}` : local.blockType}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10 rounded-md p-1 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* ── Block Name ── */}
          <Field label="Block Name" error={errors.name} required>
            <input
              ref={nameRef}
              type="text"
              value={local.name}
              onChange={(e) => { push({ name: e.target.value }); setErrors((er) => ({ ...er, name: "" })); }}
              placeholder="e.g. Traction Motor Controller"
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100
                focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 placeholder-slate-600"
            />
          </Field>

          {/* ── Block Type ── */}
          <Field label="Block Type / Redundancy">
            <div className="grid grid-cols-3 gap-2">
              {blockTypes.map((bt) => (
                <label
                  key={bt.value}
                  className={`flex flex-col gap-1 p-2.5 rounded-lg border cursor-pointer transition-all
                    ${local.blockType === bt.value
                      ? "border-blue-500 bg-blue-600/10"
                      : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/60"}`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="blockType"
                      value={bt.value}
                      checked={local.blockType === bt.value}
                      onChange={() => push({ blockType: bt.value })}
                      className="accent-blue-500"
                    />
                    <span className="text-slate-200 text-xs font-semibold">{bt.label}</span>
                  </div>
                  <span className="text-slate-500 text-[10px] pl-5">{bt.desc}</span>
                </label>
              ))}
            </div>
          </Field>

          {/* ── KooN K / N ── */}
          {local.blockType === "koon" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="K — minimum required" error={errors.k} required>
                <input
                  type="number" min={1}
                  value={local.k ?? ""}
                  onChange={(e) => { push({ k: parseInt(e.target.value) || 1 }); setErrors((er) => ({ ...er, k: "" })); }}
                  className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100
                    focus:outline-none focus:border-amber-500"
                  placeholder="e.g. 2"
                />
              </Field>
              <Field label="N — total units" error={errors.n} required>
                <input
                  type="number" min={2} max={20}
                  value={local.n ?? ""}
                  onChange={(e) => { push({ n: parseInt(e.target.value) || 2 }); setErrors((er) => ({ ...er, n: "" })); }}
                  className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100
                    focus:outline-none focus:border-amber-500"
                  placeholder="e.g. 3"
                />
              </Field>
            </div>
          )}

          {/* ── Input Mode + Value ── */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Input Mode">
              <select
                value={local.inputMode}
                onChange={(e) => push({ inputMode: e.target.value as InputMode })}
                className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100
                  focus:outline-none focus:border-blue-500"
              >
                {inputModes.map((m) => (
                  <option key={m.value} value={m.value}>{m.label} ({m.unit})</option>
                ))}
              </select>
            </Field>
            <Field
              label={`${inputModes.find((m) => m.value === local.inputMode)?.label} value`}
              error={errors.value}
              required
            >
              <input
                type="number"
                min={0}
                step="any"
                value={currentValue()}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder={inputModes.find((m) => m.value === local.inputMode)?.placeholder}
                className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 font-mono
                  focus:outline-none focus:border-blue-500 placeholder-slate-600"
              />
            </Field>
          </div>

          {/* ── MTTR ── */}
          <Field label="MTTR — Mean Time To Repair (hours)" hint="Optional — required for availability calculation">
            <input
              type="number"
              min={0}
              step="any"
              value={local.mttr?.toString() ?? ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                push({ mttr: isNaN(v) ? undefined : v });
              }}
              placeholder="e.g. 8"
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 font-mono
                focus:outline-none focus:border-blue-500 placeholder-slate-600"
            />
          </Field>

          {/* ── Live Derived Metrics ── */}
          {hasValue && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
              <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-3 font-semibold">
                Derived Metrics — live preview
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <DRow label="MTBF"       value={metrics.mtbf === Infinity ? "∞" : `${fmt(metrics.mtbf, 0)} h`} bold />
                <DRow label="λ (f/h)"    value={fmt(metrics.lambda, 8)} />
                <DRow label="FPMH"       value={fmt(metrics.fpmh, 4)} />
                <DRow label="FIT"        value={fmt(metrics.fit, 2)} />
                {local.blockType !== "single" && (
                  <DRow label={`λ_eff (${redundancyLabel})`} value={`${fmt(effL * 1e6, 4)} fpmh`} accent />
                )}
                {metrics.availability !== undefined && (
                  <DRow label="Availability" value={`${(metrics.availability * 100).toFixed(4)}%`} accent />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700/60 bg-slate-900/60 shrink-0">
          <button
            onClick={() => { onDelete(local.id); onClose(); }}
            className="flex items-center gap-1.5 text-red-500/70 hover:text-red-400 text-sm
              px-3 py-1.5 rounded-md hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={13} />
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-slate-400 hover:text-slate-200 rounded-md
                border border-slate-700 hover:border-slate-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-1.5 text-sm font-semibold text-white rounded-md
                bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              {isNew ? "Add Block" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── small helpers ── */
function Field({
  label, hint, error, required, children,
}: {
  label: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && !error && <span className="text-slate-600 text-[10px]">{hint}</span>}
      {error && (
        <span className="flex items-center gap-1 text-red-400 text-[10px]">
          <AlertCircle size={10} /> {error}
        </span>
      )}
    </div>
  );
}

function DRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500 text-[11px]">{label}</span>
      <span className={`text-[11px] font-mono font-semibold ${accent ? "text-blue-300" : bold ? "text-slate-100" : "text-slate-300"}`}>
        {value}
      </span>
    </div>
  );
}
