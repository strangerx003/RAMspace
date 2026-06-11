"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { RBDBlockData, BlockType } from "@/lib/rbd-types";
import BlockPalette from "@/components/rbd/BlockPalette";
import ResultsPanel from "@/components/rbd/ResultsPanel";
import RBDToolbar from "@/components/rbd/RBDToolbar";
import BlockModal from "@/components/rbd/BlockModal";
import { Plus, X } from "lucide-react";

const RBDCanvas = dynamic(() => import("@/components/rbd/RBDCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#1e293b]">
      <span className="text-slate-400 text-sm">Loading canvas…</span>
    </div>
  ),
});

/* ── per-tab state ── */
interface RBDTab {
  id: string;
  name: string;
  blocks: RBDBlockData[];
  selectedBlockId: string | null;
}

function makeTab(index: number): RBDTab {
  return { id: `tab-${Date.now()}-${index}`, name: `RBD ${index}`, blocks: [], selectedBlockId: null };
}

/* ── modal state ── */
interface ModalState {
  block: RBDBlockData;
  isNew: boolean;
}

/* ── empty block skeleton ── */
function blankBlock(blockType: BlockType, index: number): RBDBlockData {
  return {
    id:        `block-${Date.now()}`,
    name:      "",                    // user fills this
    blockType,
    inputMode: "mtbf",
    // no pre-filled values — user must enter
    k: blockType === "koon" ? 1 : undefined,
    n: blockType === "koon" ? 2 : undefined,
  };
}

export default function RBDModule() {
  const [tabs,        setTabs]        = useState<RBDTab[]>(() => [makeTab(1)]);
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const t = makeTab(1);
    setTabs([t]);
    return t.id;
  });
  const [modal, setModal] = useState<ModalState | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  /* ─── tab helpers ─── */
  const addTab = useCallback(() => {
    const t = makeTab(tabs.length + 1);
    setTabs((p) => [...p, t]);
    setActiveTabId(t.id);
  }, [tabs.length]);

  const closeTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs((p) => {
      if (p.length <= 1) return p;
      const next = p.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) setActiveTabId(next[next.length - 1].id);
      return next;
    });
  }, [activeTabId]);

  const duplicateTab = useCallback(() => {
    if (!activeTab) return;
    const t: RBDTab = {
      ...activeTab,
      id:    `tab-${Date.now()}`,
      name:  `${activeTab.name} (copy)`,
      blocks: activeTab.blocks.map((b) => ({ ...b, id: `${b.id}-c${Date.now()}` })),
      selectedBlockId: null,
    };
    setTabs((p) => [...p, t]);
    setActiveTabId(t.id);
  }, [activeTab]);

  const patchTab = useCallback((patch: Partial<RBDTab>) => {
    setTabs((p) => p.map((t) => (t.id === activeTabId ? { ...t, ...patch } : t)));
  }, [activeTabId]);

  /* ─── block helpers ─── */
  // Called from palette — opens modal immediately, block not yet committed
  const handleAddBlock = useCallback((blockType: BlockType) => {
    const blockCount = activeTab?.blocks.length ?? 0;
    setModal({ block: blankBlock(blockType, blockCount + 1), isNew: true });
  }, [activeTab?.blocks.length]);

  // Modal "Add Block" / "Save Changes"
  const handleModalSave = useCallback((updated: RBDBlockData) => {
    setTabs((p) => p.map((t) => {
      if (t.id !== activeTabId) return t;
      const exists = t.blocks.some((b) => b.id === updated.id);
      return {
        ...t,
        blocks: exists
          ? t.blocks.map((b) => (b.id === updated.id ? updated : b))
          : [...t.blocks, updated],
        selectedBlockId: updated.id,
      };
    }));
  }, [activeTabId]);

  const handleDeleteBlock = useCallback((id: string) => {
    setTabs((p) => p.map((t) =>
      t.id !== activeTabId ? t : {
        ...t,
        blocks:          t.blocks.filter((b) => b.id !== id),
        selectedBlockId: t.selectedBlockId === id ? null : t.selectedBlockId,
      }
    ));
  }, [activeTabId]);

  const handleSelectBlock = useCallback((id: string | null) => {
    patchTab({ selectedBlockId: id });
  }, [patchTab]);

  // Double-click or right-click → open modal for editing
  const handleOpenModal = useCallback((id: string) => {
    const block = activeTab?.blocks.find((b) => b.id === id);
    if (block) setModal({ block: { ...block }, isNew: false });
  }, [activeTab?.blocks]);

  const handleClear = useCallback(() => {
    patchTab({ blocks: [], selectedBlockId: null });
  }, [patchTab]);

  return (
    <div className="flex flex-col h-screen bg-[#111827]">
      {/* toolbar */}
      <RBDToolbar
        projectName={activeTab?.name ?? ""}
        onProjectNameChange={(name) => patchTab({ name })}
        blocks={activeTab?.blocks ?? []}
        onClear={handleClear}
        onDuplicate={duplicateTab}
      />

      {/* tab bar */}
      <div className="flex items-center bg-[#0a1120] border-b border-slate-700/60 px-2 min-h-[38px] overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-b-2 transition-all
              shrink-0 text-xs font-medium whitespace-nowrap select-none
              ${tab.id === activeTabId
                ? "border-blue-500 text-blue-300 bg-[#111827]"
                : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"}`}
          >
            <span className="max-w-[120px] truncate">{tab.name}</span>
            {tab.blocks.length > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold
                ${tab.id === activeTabId ? "bg-blue-600/30 text-blue-300" : "bg-slate-700 text-slate-500"}`}>
                {tab.blocks.length}
              </span>
            )}
            {tabs.length > 1 && (
              <button
                onClick={(e) => closeTab(tab.id, e)}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400
                  w-3.5 h-3.5 flex items-center justify-center rounded-sm hover:bg-red-500/10 transition-all"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addTab}
          title="New RBD tab"
          className="ml-1 w-7 h-7 flex items-center justify-center text-slate-600
            hover:text-slate-300 hover:bg-slate-700/50 rounded-md transition-all shrink-0"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* workspace */}
      <div className="flex flex-1 overflow-hidden">
        <BlockPalette onAddBlock={handleAddBlock} />

        <div className="flex-1 relative overflow-hidden">
          {activeTab && (
            <RBDCanvas
              key={activeTab.id}
              blocks={activeTab.blocks}
              selectedBlockId={activeTab.selectedBlockId}
              onSelectBlock={handleSelectBlock}
              onOpenModal={handleOpenModal}
              onDeleteBlock={handleDeleteBlock}
              onAddBlock={handleAddBlock}
            />
          )}
        </div>

        {/* always-visible results panel */}
        <div className="w-60 border-l border-slate-700/60 overflow-y-auto bg-[#0f172a] shrink-0">
          <ResultsPanel blocks={activeTab?.blocks ?? []} />
        </div>
      </div>

      {/* modal — renders on top of everything, blocks interaction */}
      {modal && (
        <BlockModal
          block={modal.block}
          isNew={modal.isNew}
          onSave={handleModalSave}
          onDelete={handleDeleteBlock}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
