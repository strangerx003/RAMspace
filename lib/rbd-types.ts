export type BlockType = "single" | "1oo2" | "koon";

export type InputMode = "mtbf" | "fr" | "fpmh" | "fit";

export interface RBDBlockData {
  id: string;
  name: string;
  blockType: BlockType;
  inputMode: InputMode;
  mtbf?: number;        // hours
  fr?: number;          // failures per hour (λ)
  fpmh?: number;        // failures per million hours
  fit?: number;         // failures in 10^9 hours
  mttr?: number;        // Mean Time To Repair (hours) - optional for availability
  // k and n for koon
  k?: number;
  n?: number;
}

// Derived reliability metrics for a block
export interface BlockMetrics {
  lambda: number;       // failure rate (failures/hour)
  mtbf: number;         // hours
  fpmh: number;
  fit: number;
  availability?: number; // if MTTR is given
}

// System-level results
export interface SystemResults {
  systemLambda: number;   // total system failure rate
  systemMTBF: number;     // hours
  systemFPMH: number;
  systemFIT: number;
  systemAvailability?: number;
  blockCount: number;
}
