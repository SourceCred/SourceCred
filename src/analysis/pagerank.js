// @flow

import {type Edge, Graph, NodeAddress, type NodeAddressT} from "../core/graph";
import {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_CONVERGENCE_THRESHOLD,
  DEFAULT_SYNTHETIC_LOOP_WEIGHT,
} from "../core/pagerankGraph";
import {
  distributionToNodeDistribution,
  createConnections,
  createOrderedSparseMarkovChain,
  type EdgeWeight,
} from "../core/attribution/graphToMarkovChain";
import {
  decompose,
  type PagerankNodeDecomposition,
} from "./pagerankNodeDecomposition";

import {scoreByConstantTotal} from "./nodeScore";

import {
  findStationaryDistribution,
  type PagerankParams,
  type PagerankOptions as CorePagerankOptions,
} from "../core/attribution/markovChain";
import {uniformDistribution} from "../core/attribution/distribution";

export type {NodeDistribution} from "../core/attribution/nodeDistribution";
export type {PagerankNodeDecomposition} from "./pagerankNodeDecomposition";
export type FullPagerankOptions = {|
  +selfLoopWeight: number,
  +verbose: boolean,
  +convergenceThreshold: number,
  +maxIterations: number,
  // Scores will be normalized so that scores sum to totalScore
  +totalScore: number,
  // Only nodes matching this prefix will count for normalization
  +totalScoreNodePrefix: NodeAddressT,
|};
export type PagerankOptions = $Shape<FullPagerankOptions>;

export type {EdgeWeight} from "../core/attribution/graphToMarkovChain";
export type EdgeEvaluator = (Edge) => EdgeWeight;

function defaultOptions(): PagerankOptions {
  return {
    verbose: false,
    selfLoopWeight: DEFAULT_SYNTHETIC_LOOP_WEIGHT,
    convergenceThreshold: DEFAULT_CONVERGENCE_THRESHOLD,
    maxIterations: DEFAULT_MAX_ITERATIONS,
    totalScore: 1000,
    totalScoreNodePrefix: NodeAddress.empty,
  };
}

export async function pagerank(
  graph: Graph,
  edgeWeight: EdgeEvaluator,
  options?: PagerankOptions
): Promise<PagerankNodeDecomposition> {
  const fullOptions = {
    ...defaultOptions(),
    ...(options || {}),
  };
  const connections = createConnections(
    graph,
    edgeWeight,
    fullOptions.selfLoopWeight
  );
  const osmc = createOrderedSparseMarkovChain(connections);
  const params: PagerankParams = {
    chain: osmc.chain,
    alpha: 0,
    pi0: uniformDistribution(osmc.chain.length),
    seed: uniformDistribution(osmc.chain.length),
  };
  const coreOptions: CorePagerankOptions = {
    verbose: fullOptions.verbose,
    convergenceThreshold: fullOptions.convergenceThreshold,
    maxIterations: fullOptions.maxIterations,
    yieldAfterMs: 30,
  };
  const distributionResult = await findStationaryDistribution(
    params,
    coreOptions
  );
  const pi = distributionToNodeDistribution(
    osmc.nodeOrder,
    distributionResult.pi
  );
  const scores = scoreByConstantTotal(
    pi,
    fullOptions.totalScore,
    fullOptions.totalScoreNodePrefix
  );
  return decompose(scores, connections);
}
