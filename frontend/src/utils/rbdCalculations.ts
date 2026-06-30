import type { Component, RBDNode, RBDLink, RBDCalculationResult, RBDSystemResults } from '../types';

function combination(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  r = Math.min(r, n - r);
  let result = 1;
  for (let i = 1; i <= r; i++) {
    result = result * (n - r + i) / i;
  }
  return result;
}

function factorial(x: number): number {
  if (x <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= x; i++) result *= i;
  return result;
}

/**
 * Calculate k-out-of-n active redundancy with repair.
 * 
 * 1-out-of-n (pure parallel): λs = n! × λ^n / µ^(n-1), MTTRs = MTTR/n
 * k-out-of-n (1<r<n):        λs = C(n,k) × λ^k / µ^(k-1), MTTRs = MTTR/k
 *   where k = n - r + 1
 * Series (n=r=1):             λs = λ, MTTRs = MTTR
 */
function calcRedundancy(n: number, r: number, lambda: number, mttr: number) {
  const mu = mttr > 0 ? 1 / mttr : 1;

  if (n === r) {
    return { lambda_s: lambda, mttr_s: mttr };
  }

  if (r === 1) {
    // Pure parallel (all must fail)
    return {
      lambda_s: factorial(n) * Math.pow(lambda, n) / Math.pow(mu, n - 1),
      mttr_s: mttr / n,
    };
  }

  // k-out-of-n
  const k = n - r + 1;
  return {
    lambda_s: combination(n, k) * Math.pow(lambda, k) / Math.pow(mu, k - 1),
    mttr_s: mttr / k,
  };
}

/**
 * Detect parallel islands from the connection graph.
 * Parallel blocks are those that share the same source+target chain.
 *
 * For example: A→B and A→C and B→D and C→D means B and C are in parallel.
 */
function findParallelGroups(blocks: RBDNode[], connections: RBDLink[]): { blockIds: string[] }[] {
  // Build adjacency from block to its successors
  const successors = new Map<string, Set<string>>();
  const predecessors = new Map<string, Set<string>>();

  for (const b of blocks) {
    successors.set(b.id, new Set());
    predecessors.set(b.id, new Set());
  }

  for (const c of connections) {
    successors.get(c.sourceId)?.add(c.targetId);
    predecessors.get(c.targetId)?.add(c.sourceId);
  }

  // Find "split points" - a source that connects to multiple targets
  // and those targets all merge back to the same downstream point
  const groups: { blockIds: string[] }[] = [];
  const seen = new Set<string>();

  for (const src of blocks) {
    const succs = successors.get(src.id);
    if (!succs || succs.size < 2) continue;

    const succArray = [...succs];

    // Check if all successors share a common downstream target
    // i.e. find if there exists a merge point reachable from all succs
    for (let i = 0; i < succArray.length; i++) {
      const targetsI = successors.get(succArray[i]);
      if (!targetsI) continue;

      for (let j = i + 1; j < succArray.length; j++) {
        const targetsJ = successors.get(succArray[j]);
        if (!targetsJ) continue;

        // Find common merge point
        const common = [...targetsI].filter(t => targetsJ.has(t));
        if (common.length > 0) {
          const pair = [succArray[i], succArray[j]].sort();
          const key = pair.join('_');
          if (!seen.has(key)) {
            groups.push({ blockIds: [succArray[i], succArray[j]] });
            seen.add(key);
          }
        }
      }
    }
  }

  // Handle k-out-of-n from block redundancyType (user-configured parallel in a single block)
  for (const block of blocks) {
    if (block.redundancyType === 'k-out-of-n' && block.totalUnits > 1) {
      // Already handled by calcRedundancy - just use as a single series element
    }
  }

  return groups;
}

/**
 * Get the series chain order of blocks (topologically sorted).
 * Simply returns blocks in connection order, starting from blocks with no incoming connections.
 */
function getSeriesOrder(blocks: RBDNode[], connections: RBDLink[]): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const b of blocks) {
    inDegree.set(b.id, 0);
    adj.set(b.id, []);
  }

  for (const c of connections) {
    adj.get(c.sourceId)?.push(c.targetId);
    inDegree.set(c.targetId, (inDegree.get(c.targetId) || 0) + 1);
  }

  // Topological sort (handles linear series chains)
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) || []) {
      const newDeg = (inDegree.get(next) || 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  // Add any remaining blocks not in the chain
  for (const b of blocks) {
    if (!order.includes(b.id)) order.push(b.id);
  }

  return order;
}

/**
 * Calculate block result respecting both redundancy type and quantity.
 */
export function calcBlockResult(
  block: RBDNode,
  component: Component | undefined
): RBDCalculationResult {
  const lambda = component?.failureRate ?? 0;
  const mttr = component?.mttr ?? 1;
  const mu = mttr > 0 ? 1 / mttr : 1;

  let n: number, r: number;

  if (block.redundancyType === 'k-out-of-n') {
    n = block.totalUnits;
    r = block.minRequired;
  } else {
    n = 1;
    r = 1;
  }

  const res = calcRedundancy(n, r, lambda, mttr);

  // Apply quantity multiplier (multiple identical blocks in series in this position)
  const qty = Math.max(block.quantity, 1);
  const lambda_s = res.lambda_s * qty;
  const mttr_s = res.mttr_s; // MTTR unchanged for series duplicates
  const mtbf_s = lambda_s > 0 ? 1 / lambda_s : Infinity;
  const lambda_mttr_product = lambda_s * mttr_s;

  return {
    blockId: block.id,
    componentName: block.componentName,
    n,
    r,
    lambda,
    mttr,
    mu,
    lambda_s: isFinite(lambda_s) ? lambda_s : 0,
    mtbf_s: isFinite(mtbf_s) ? mtbf_s : 0,
    mttr_s: isFinite(mttr_s) ? mttr_s : 0,
    lambda_mttr_product: isFinite(lambda_mttr_product) ? lambda_mttr_product : 0,
  };
}

/**
 * Calculate system-level results from blocks + connections.
 * Detects parallel topology from connections and combines parallel blocks
 * into k-out-of-n groups before series summation.
 */
export function calcSystemResults(
  blocks: RBDNode[],
  components: Component[],
  connections?: RBDLink[]
): RBDSystemResults {
  const areaResults: RBDCalculationResult[] = [];

  if (blocks.length === 0) {
    return {
      areaResults: [],
      totalLambda: 0,
      totalMTBF: 0,
      totalMTTR: 0,
      availability: 0,
    };
  }

  if (!connections || connections.length === 0) {
    // No connections = all blocks are independent series elements
    for (const block of blocks) {
      const comp = components.find(c => c.id === block.componentId);
      const result = calcBlockResult(block, comp);
      areaResults.push(result);
    }
  } else {
    // Detect parallel groups from connections
    const parallelGroups = findParallelGroups(blocks, connections);
    const parallelBlockIds = new Set<string>();
    for (const g of parallelGroups) {
      for (const bid of g.blockIds) parallelBlockIds.add(bid);
    }

    // Get series order
    const order = getSeriesOrder(blocks, connections);

    // Process blocks in order, combining parallel groups
    const processed = new Set<string>();

    for (const blockId of order) {
      if (processed.has(blockId)) continue;

      if (parallelBlockIds.has(blockId)) {
        // Find the parallel group this block belongs to
        const group = parallelGroups.find(g => g.blockIds.includes(blockId));
        if (group) {
          // All blocks in group are identical in parallel (1oo2, 1oo3, etc.)
          const groupBlocks = group.blockIds.map(id => blocks.find(b => b.id === id)!).filter(Boolean);
          const n = groupBlocks.length;
          const r = 1; // 1-out-of-n (all parallel blocks are 1ooN by default)

          if (groupBlocks.length > 0) {
            const comp = components.find(c => c.id === groupBlocks[0].componentId);
            const lambda = comp?.failureRate ?? 0;
            const mttr = comp?.mttr ?? 1;

            const res = calcRedundancy(n, r, lambda, mttr);

            areaResults.push({
              blockId: `parallel_${group.blockIds.join('_')}`,
              componentName: `${groupBlocks[0].componentName} (${n} parallel)`,
              n,
              r,
              lambda,
              mttr,
              mu: mttr > 0 ? 1 / mttr : 1,
              lambda_s: isFinite(res.lambda_s) ? res.lambda_s : 0,
              mtbf_s: isFinite(res.lambda_s) && res.lambda_s > 0 ? 1 / res.lambda_s : 0,
              mttr_s: isFinite(res.mttr_s) ? res.mttr_s : 0,
              lambda_mttr_product: isFinite(res.lambda_s * res.mttr_s) ? res.lambda_s * res.mttr_s : 0,
            });

            for (const bid of group.blockIds) processed.add(bid);
          }
        }
      } else {
        // Regular series block
        const block = blocks.find(b => b.id === blockId);
        if (block && !processed.has(block.id)) {
          const comp = components.find(c => c.id === block.componentId);
          const result = calcBlockResult(block, comp);
          areaResults.push(result);
          processed.add(block.id);
        }
      }
    }

    // Handle blocks not in the connection chain
    for (const block of blocks) {
      if (!processed.has(block.id)) {
        const comp = components.find(c => c.id === block.componentId);
        const result = calcBlockResult(block, comp);
        areaResults.push(result);
        processed.add(block.id);
      }
    }
  }

  const totalLambda = areaResults.reduce((sum, r) => sum + r.lambda_s, 0);
  const totalMTBF = totalLambda > 0 ? 1 / totalLambda : Infinity;
  const totalLambdaMTTRProduct = areaResults.reduce((sum, r) => sum + r.lambda_mttr_product, 0);
  const totalMTTR = totalLambda > 0 ? totalLambdaMTTRProduct / totalLambda : 0;
  const availability = isFinite(totalMTBF) && totalMTBF + totalMTTR > 0
    ? totalMTBF / (totalMTBF + totalMTTR)
    : 0;

  return {
    areaResults,
    totalLambda,
    totalMTBF: isFinite(totalMTBF) ? totalMTBF : 0,
    totalMTTR: isFinite(totalMTTR) ? totalMTTR : 0,
    availability: isFinite(availability) ? availability : 0,
  };
}