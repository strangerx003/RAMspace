"use client";

import { useEffect, useRef } from "react";
import { Settings, Trash2, Copy } from "lucide-react";

interface BlockContextMenuProps {
  x: number;
  y: number;
  blockId: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function BlockContextMenu({
  x,
  y,
  onEdit,
  onDelete,
  onClose,
}: BlockContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Adjust position to stay in viewport
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(x, window.innerWidth - 180),
    top: Math.min(y, window.innerHeight - 120),
    zIndex: 9999,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-44 overflow-hidden py-1"
    >
      <div className="px-3 py-1.5 border-b border-slate-700 mb-1">
        <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">
          Block Actions
        </span>
      </div>
      <button
        onClick={onEdit}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-200 
          hover:bg-slate-700 transition-colors"
      >
        <Settings size={13} className="text-blue-400" />
        Edit Properties
      </button>
      <div className="h-px bg-slate-700 mx-2 my-1" />
      <button
        onClick={onDelete}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 
          hover:bg-red-500/10 transition-colors"
      >
        <Trash2 size={13} />
        Delete Block
      </button>
    </div>
  );
}
