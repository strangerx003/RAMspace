"use client";

import { useState } from "react";
import { RBDBlockData } from "@/lib/rbd-types";
import { calculateSystemResults, getBlockMetrics, effectiveLambda, fmt } from "@/lib/rbd-calculations";
import { Download, Trash2, FileSpreadsheet, FileText, ChevronDown, Copy } from "lucide-react";

interface RBDToolbarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  blocks: RBDBlockData[];
  onClear: () => void;
  onDuplicate?: () => void;
}

export default function RBDToolbar({
  projectName,
  onProjectNameChange,
  blocks,
  onClear,
  onDuplicate,
}: RBDToolbarProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const handleExportExcel = async () => {
    setExportMenuOpen(false);
    const XLSX = (await import("xlsx")).default;
    const results = calculateSystemResults(blocks);

    // Block data sheet
    const blockRows = blocks.map((block, i) => {
      const m = getBlockMetrics(block);
      const eff = effectiveLambda(block);
      return {
        "No.": i + 1,
        "Block Name": block.name,
        "Block Type": block.blockType === "koon"
          ? `${block.k ?? 1}oo${block.n ?? 2}`
          : block.blockType,
        "MTBF (h)": m.mtbf === Infinity ? "∞" : m.mtbf.toFixed(0),
        "λ (f/h)": m.lambda.toExponential(4),
        "FPMH": m.fpmh.toFixed(4),
        "FIT": m.fit.toFixed(2),
        "MTTR (h)": block.mttr ?? "N/A",
        "Availability (%)": m.availability !== undefined
          ? (m.availability * 100).toFixed(4)
          : "N/A",
        "Effective λ (FPMH)": (eff * 1e6).toFixed(4),
      };
    });

    const systemRow = results
      ? [{
          "Parameter": "System MTBF (h)",
          "Value": results.systemMTBF === Infinity ? "∞" : results.systemMTBF.toFixed(0),
        }, {
          "Parameter": "System λ (f/h)",
          "Value": results.systemLambda.toExponential(4),
        }, {
          "Parameter": "System FPMH",
          "Value": results.systemFPMH.toFixed(4),
        }, {
          "Parameter": "System FIT",
          "Value": results.systemFIT.toFixed(2),
        }, {
          "Parameter": "System Availability (%)",
          "Value": results.systemAvailability !== undefined
            ? (results.systemAvailability * 100).toFixed(4)
            : "N/A",
        }]
      : [];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(blockRows);
    const ws2 = XLSX.utils.json_to_sheet(systemRow);

    XLSX.utils.book_append_sheet(wb, ws1, "RBD Blocks");
    XLSX.utils.book_append_sheet(wb, ws2, "System Results");

    XLSX.writeFile(wb, `${projectName.replace(/\s+/g, "_")}_RBD.xlsx`);
  };

  const handleExportPDF = async () => {
    setExportMenuOpen(false);
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const results = calculateSystemResults(blocks);

    const doc = new jsPDF({ orientation: "landscape" });

    // Title
    doc.setFontSize(16);
    doc.setTextColor(30, 60, 114);
    doc.text("RAMspace — Reliability Block Diagram Report", 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Project: ${projectName}`, 14, 27);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 33);
    doc.text(`Standard: EN 50126 / IEC 61078`, 14, 39);

    // Block table
    const blockHead = [
      ["No.", "Name", "Type", "MTBF (h)", "λ (f/h)", "FPMH", "FIT", "MTTR (h)", "Avail. (%)", "Eff. λ (FPMH)"]
    ];
    const blockBody = blocks.map((block, i) => {
      const m = getBlockMetrics(block);
      const eff = effectiveLambda(block);
      return [
        i + 1,
        block.name,
        block.blockType === "koon" ? `${block.k ?? 1}oo${block.n ?? 2}` : block.blockType,
        m.mtbf === Infinity ? "∞" : m.mtbf.toFixed(0),
        m.lambda.toExponential(4),
        m.fpmh.toFixed(4),
        m.fit.toFixed(2),
        block.mttr ?? "N/A",
        m.availability !== undefined ? (m.availability * 100).toFixed(4) : "N/A",
        (eff * 1e6).toFixed(4),
      ];
    });

    autoTable(doc, {
      head: blockHead,
      body: blockBody,
      startY: 48,
      theme: "grid",
      headStyles: { fillColor: [30, 60, 114], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [240, 244, 255] },
    });

    // System results
    if (results) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? 120;
      doc.setFontSize(12);
      doc.setTextColor(30, 60, 114);
      doc.text("System Results", 14, finalY + 14);

      autoTable(doc, {
        head: [["Parameter", "Value"]],
        body: [
          ["System MTBF (h)", results.systemMTBF === Infinity ? "∞" : results.systemMTBF.toFixed(0)],
          ["System λ (f/h)", results.systemLambda.toExponential(4)],
          ["System FPMH", results.systemFPMH.toFixed(4)],
          ["System FIT", results.systemFIT.toFixed(2)],
          ["System Availability (%)", results.systemAvailability !== undefined
            ? (results.systemAvailability * 100).toFixed(4) : "N/A"],
        ],
        startY: finalY + 18,
        theme: "grid",
        headStyles: { fillColor: [30, 60, 114], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 1: { fontStyle: "bold" } },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `RAMspace · Page ${i} of ${pageCount} · ${new Date().toLocaleDateString()}`,
        14,
        doc.internal.pageSize.height - 8
      );
    }

    doc.save(`${projectName.replace(/\s+/g, "_")}_RBD_Report.pdf`);
  };

  return (
    <div className="h-12 flex items-center gap-3 px-4 bg-[#0f172a] border-b border-slate-700/60 shrink-0">
      {/* Project name */}
      <input
        type="text"
        value={projectName}
        onChange={(e) => onProjectNameChange(e.target.value)}
        className="bg-transparent border-b border-slate-700 text-slate-200 text-sm font-medium
          focus:outline-none focus:border-blue-500 px-1 py-0.5 min-w-0 w-56 transition-colors"
        placeholder="Project name..."
      />

      <div className="h-5 w-px bg-slate-700 mx-1" />

      {/* Block count badge */}
      <span className="text-xs text-slate-500">
        {blocks.length} block{blocks.length !== 1 ? "s" : ""}
      </span>

      <div className="flex-1" />

      {/* Duplicate tab */}
      {onDuplicate && (
        <button
          onClick={onDuplicate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200
            border border-slate-600/50 hover:border-slate-500 rounded-md transition-all"
          title="Duplicate this RBD as a new tab"
        >
          <Copy size={12} />
          Duplicate
        </button>
      )}

      {/* Clear */}
      <button
        onClick={onClear}
        disabled={blocks.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400/70 hover:text-red-400 
          border border-red-500/20 hover:border-red-500/40 rounded-md transition-all
          disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Trash2 size={12} />
        Clear
      </button>

      {/* Export dropdown */}
      <div className="relative">
        <button
          onClick={() => setExportMenuOpen((v) => !v)}
          disabled={blocks.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white 
            rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
        >
          <Download size={12} />
          Export
          <ChevronDown size={11} className={`transition-transform ${exportMenuOpen ? "rotate-180" : ""}`} />
        </button>

        {exportMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setExportMenuOpen(false)}
            />
            <div className="absolute right-0 top-10 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-44 overflow-hidden">
              <button
                onClick={handleExportExcel}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-200 
                  hover:bg-slate-700 transition-colors"
              >
                <FileSpreadsheet size={14} className="text-green-400" />
                Export to Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-200 
                  hover:bg-slate-700 transition-colors"
              >
                <FileText size={14} className="text-red-400" />
                Export to PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
