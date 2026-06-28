/* ===== Shared Types for RAMSspace ===== */

export interface Component {
  id: string;
  name: string;
  category: ComponentCategory;
  manufacturer: string;
  model: string;
  description: string;
  failureRate: number;
  mtbf: number;
  mttr: number;
  mttf: number;
  distributionType: DistributionType;
  betaParam: number;
  etaParam: number;
  cost: number;
  criticality: Criticality;
  missionTime: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type ComponentCategory = 'mechanical' | 'electrical' | 'electronic' | 'hydraulic' | 'pneumatic' | 'software' | 'sensor' | 'actuator' | 'structural' | 'other';
export type DistributionType = 'exponential' | 'weibull' | 'normal' | 'lognormal';
export type Criticality = 'low' | 'medium' | 'high' | 'critical';

/* ===== RBD Types ===== */
export interface RBDProject {
  id: string;
  name: string;
  description: string;
  blocks: RBDNode[];
  connections: RBDLink[];
  createdAt: string;
  updatedAt: string;
}

export interface RBDNode {
  id: string;
  componentId: string;
  componentName: string;
  x: number;
  y: number;
  quantity: number;
}

export interface RBDLink {
  id: string;
  sourceId: string;
  sourcePort: number;
  targetId: string;
  targetPort: number;
  connectorType?: 'straight' | 'right-angle';
  elbowX?: number;
}

/* ===== RAM Analysis Types ===== */
export interface RAMProject {
  id: string;
  name: string;
  description: string;
  componentIds: string[];
  missionTime: number;
  results: RAMResults | null;
  createdAt: string;
  updatedAt: string;
}

export interface RAMResults {
  systemReliability: number;
  systemAvailability: number;
  systemMaintainability: number;
  systemMTBF: number;
  systemMTTR: number;
  systemMTTF: number;
  systemFailureRate: number;
  componentResults: ComponentRAMResult[];
  reliabilityOverTime: TimePoint[];
  availabilityOverTime: TimePoint[];
}

export interface ComponentRAMResult {
  componentId: string;
  componentName: string;
  reliability: number;
  availability: number;
  maintainability: number;
  failureRate: number;
  mtbf: number;
  mttr: number;
}

export interface TimePoint { time: number; value: number; }

/* ===== FTA Types ===== */
export interface FTAProject {
  id: string;
  name: string;
  description: string;
  topEvent: FTANode | null;
  createdAt: string;
  updatedAt: string;
}

export interface FTANode {
  id: string;
  name: string;
  type: FTANodeType;
  gateType: FTAGateType;
  componentId?: string;
  failureRate?: number;
  probability?: number;
  children: FTANode[];
  x: number;
  y: number;
}

export type FTANodeType = 'top-event' | 'intermediate' | 'basic-event' | 'undeveloped';
export type FTAGateType = 'AND' | 'OR' | 'XOR' | 'NOT' | 'K-of-N' | '';

/* ===== Module IDs ===== */
export type ModuleId =
  | 'rbd'
  | 'ram'
  | 'fmeca'
  | 'lcc'
  | 'spares'
  | 'reliability'
  | 'fta'
  | 'monitoring'
  | 'demonstration'
  | 'components-db';
