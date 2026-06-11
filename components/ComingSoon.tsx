"use client";

import { ModuleKey } from "@/app/page";
import { Clock, Construction } from "lucide-react";

const moduleLabels: Record<ModuleKey, string> = {
  rbd: "Reliability Block Diagram",
  "ram-analysis": "RAM Analysis / Prediction",
  fmeca: "FMECA",
  lcc: "Life Cycle Cost",
  "spare-parts": "Spare Parts Analysis",
  "reliability-calc": "Reliability Calculations",
  fta: "Fault Tree Analysis",
  "ram-monitoring": "RAM Monitoring / Performance",
  "ram-demo": "RAM Demonstration",
};

export default function ComingSoon({ module }: { module: ModuleKey }) {
  return (
    <div className="flex items-center justify-center h-full bg-[#111827]">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto">
          <Construction size={32} className="text-slate-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-200 mb-1">
            {moduleLabels[module]}
          </h2>
          <p className="text-slate-500 text-sm">This module is under development.</p>
        </div>
        <div className="flex items-center gap-2 justify-center text-slate-600 text-xs">
          <Clock size={12} />
          <span>Coming soon</span>
        </div>
      </div>
    </div>
  );
}
