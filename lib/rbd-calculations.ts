import { BlockType, RBDBlockData, BlockMetrics, SystemResults } from "./rbd-types";

/**
 * Convert any input mode to failure rate λ (failures/hour)
 */
export function toFailureRate(data: RBDBlockData): number {
  switch (data.inputMode) {
    case "mtbf":
      return data.mtbf && data.mtbf > 0 ? 1 / data.mtbf : 0;
    case "fr":
      return data.fr ?? 0;
    case "fpmh":
      return data.fpmh ? data.fpmh / 1_000_000 : 0;
    case "fit":
      return data.fit ? data.fit / 1_000_000_000 : 0;
    default:
      return 0;
  }
}

/**
 * Get all derived metrics for a block
 */
export function getBlockMetrics(data: RBDBlockData): BlockMetrics {
  const lambda = toFailureRate(data);
  const mtbf = lambda > 0 ? 1 / lambda : Infinity;
  const fpmh = lambda * 1_000_000;
  const fit = lambda * 1_000_000_000;

  let availability: number | undefined;
  if (data.mttr !== undefined && data.mttr > 0 && mtbf !== Infinity) {
    availability = mtbf / (mtbf + data.mttr);
  }

  return { lambda, mtbf, fpmh, fit, availability };
}

/**
 * Calculate the effective failure rate for a block based on its redundancy type.
 *
 * Single (series): λ_eff = λ
 *
 * 1oo2 (1-out-of-2 parallel, active redundancy):
 *   Both must fail → system unreliability = λ²·t²/2 (for short t)
 *   Approximation: λ_eff = λ² * MTBF = λ² / λ = λ   <-- this is wrong
 *   Correct approach using Markov/simplified:
 *   For active parallel 1oo2: λ_system ≈ λ² * MTBF_repair (if repair)
 *   For non-repairable: R(t) = 1 - (1-e^-λt)^2 = 2e^-λt - e^-2λt
 *   MTTF = integral R(t) = 2/λ - 1/(2λ) = 3/(2λ)
 *   Equivalent λ_eff = 2λ/3
 *
 * kooN (k-out-of-n active parallel, non-repairable):
 *   System fails when fewer than k units survive.
 *   System reliability: R_sys(t) = Σ_{i=k}^{n} C(n,i) * (e^-λt)^i * (1-e^-λt)^(n-i)
 *   MTTF = integral = Σ_{i=k}^{n} C(n,i) * (-1)^(n-i) * ... 
 *   Simplified: use MTTF = (1/λ) * Σ_{i=k}^{n} 1/i  [from standard formula]
 *   λ_eff = 1/MTTF
 */
export function effectiveLambda(data: RBDBlockData): number {
  const lambda = toFailureRate(data);
  if (lambda === 0) return 0;

  switch (data.blockType) {
    case "single":
      return lambda;

    case "1oo2": {
      // Active 1oo2: MTTF = 3/(2λ), so λ_eff = 2λ/3
      return (2 * lambda) / 3;
    }

    case "koon": {
      const k = data.k ?? 1;
      const n = data.n ?? 2;
      if (k >= n) return lambda; // degenerate: all must work = series
      if (k <= 0) return 0;      // degenerate: none need to work

      // MTTF_koon = (1/λ) * Σ_{i=k}^{n} C(n,i) * (-1)^(i-k) * C(i,k)^-1 ... 
      // Standard result: MTTF = (1/λ) * Σ_{j=k}^{n} 1/j * ... 
      // Exact formula: MTTF = (1/λ) * Σ_{i=1}^{n-k+1} (-1)^(i-1) * C(n-k, i-1) * C(n, k+i-1)^-1 * ... 
      // Simplest correct formula (Billinton & Allan): MTTF = (1/λ) * Σ_{j=k}^{n} C(n,j)*(-1)^(j-k)*C(n,k)^-1 ...
      // Use: MTTF(k,n) = (1/λ) * Σ_{i=0}^{n-k} (-1)^i * C(n-k, i) / (k+i)
      const mttf = koonMTTF(lambda, k, n);
      return mttf > 0 ? 1 / mttf : lambda;
    }

    default:
      return lambda;
  }
}

/**
 * Combinatorial: n choose k
 */
function choose(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

/**
 * MTTF for k-out-of-n active parallel (exponential, non-repairable)
 * MTTF = (1/λ) * Σ_{i=0}^{n-k} [(-1)^i * C(n-k, i) / (k+i)]
 * This is the standard closed-form result from reliability theory.
 */
function koonMTTF(lambda: number, k: number, n: number): number {
  let sum = 0;
  for (let i = 0; i <= n - k; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    sum += sign * choose(n - k, i) / (k + i);
  }
  return sum / lambda;
}

/**
 * Calculate system-level results from all blocks (series connection between blocks).
 * Each block may itself be redundant (1oo2 or koon).
 */
export function calculateSystemResults(blocks: RBDBlockData[]): SystemResults | null {
  if (blocks.length === 0) return null;

  // System failure rate = sum of effective lambdas (series combination of block groups)
  const systemLambda = blocks.reduce((sum, block) => {
    return sum + effectiveLambda(block);
  }, 0);

  const systemMTBF = systemLambda > 0 ? 1 / systemLambda : Infinity;
  const systemFPMH = systemLambda * 1_000_000;
  const systemFIT = systemLambda * 1_000_000_000;

  // System availability (requires MTTR on all blocks)
  let systemAvailability: number | undefined;
  const allHaveMTTR = blocks.every((b) => b.mttr !== undefined && b.mttr > 0);
  if (allHaveMTTR) {
    // Product of individual availabilities (series)
    systemAvailability = blocks.reduce((prod, block) => {
      const m = getBlockMetrics(block);
      return prod * (m.availability ?? 1);
    }, 1);
  }

  return {
    systemLambda,
    systemMTBF,
    systemFPMH,
    systemFIT,
    systemAvailability,
    blockCount: blocks.length,
  };
}

/**
 * Format a number to a sensible precision string.
 */
export function fmt(value: number, decimals = 4): string {
  if (!isFinite(value)) return "∞";
  if (value === 0) return "0";
  if (value < 0.0001) return value.toExponential(3);
  return value.toFixed(decimals);
}
