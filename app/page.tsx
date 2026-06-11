"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import RBDModule from "@/components/modules/RBDModule";
import ComingSoon from "@/components/ComingSoon";

export type ModuleKey =
  | "rbd"
  | "ram-analysis"
  | "fmeca"
  | "lcc"
  | "spare-parts"
  | "reliability-calc"
  | "fta"
  | "ram-monitoring"
  | "ram-demo";

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleKey>("rbd");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeModule={activeModule} onModuleChange={setActiveModule} />
      <main className="flex-1 overflow-hidden">
        {activeModule === "rbd" && <RBDModule />}
        {activeModule !== "rbd" && <ComingSoon module={activeModule} />}
      </main>
    </div>
  );
}
