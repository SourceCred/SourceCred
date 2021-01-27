// @flow

import {
  type Edge,
  type EdgesOptions,
  type Node,
  type EdgeAddressT,
  type NodeAddressT,
  type GraphComparison,
  type GraphJSON,
  compareGraphs,
  Graph,
} from "./graph";
import {type NodeWeight} from "./weights/nodeWeights";
import {type EdgeWeight} from "./weights/edgeWeights";
import {
  type WeightsComparison,
  type WeightsJSON,
  compareWeightsT,
} from "./weights/weightsT";
import {
  Weights,
  type WeightsI,
  fromJSON as fromWeightsJSON,
} from "./weights/weights";
import {toCompat, fromCompat, type Compatible} from "../util/compat";

/**
 * An entry in the array returned by AddressModule.toParts()
 */
export type AddressPart = string;

export type WeightedGraphJSON = {|
  graph: GraphJSON,
  weights: WeightsJSON,
|};

export type CompatibleWeightedGraphJSON = Compatible<WeightedGraphJSON>;

export type WeightedNode = {|
  +node: Node,
  +weight: NodeWeight,
|};

export type WeightedEdge = {|
  +edge: Edge,
  +weight: EdgeWeight,
|};

export type WeightedGraphComparison = {|
  graphComparison: GraphComparison,
  weightsComparison: WeightsComparison,
  weightedGraphsAreEqual: boolean,
|};

const COMPAT_INFO = {type: "sourcecred/weightedgraph", version: "0.1.0"};

/**
 * The WeightedGraph2 class is a replacement for the WeightedGraph type. This class
 * eliminates the need give every node and edge that exists a weight. Rather,
 * address prefixes can be assigned a weight and when a node or edge weight is
 * queried, the product of matching weights along the address chain is returned.
 *
 * Over the longer-term, WeightedGraph should be refactored out of existence and
 * WeightedGraph2 should completely replace it.
 */
export class WeightedGraph2 {
  _weights: WeightsI;
  _graph: Graph;

  constructor(graph?: Graph, weights?: WeightsI) {
    this._graph = graph ? graph : new Graph();
    this._weights = weights ? weights : Weights();
  }

  /**
   * Set the weight for a node address prefix.
   */
  setNodePrefixWeight(prefix: NodeAddressT, w: NodeWeight): this {
    this._weights.setNodeWeight(prefix, w);
    return this;
  }

  /**
   * Set the weights for an edge address prefix.
   */
  setEdgePrefixWeight(prefix: EdgeAddressT, w: EdgeWeight): this {
    this._weights.setEdgeWeight(prefix, w);
    return this;
  }

  /**
   * Add a node and optionally assign its weight. If a weight is not passed in,
   * the weight will default to 1.
   */
  addNode(n: Node, w?: NodeWeight): this {
    this._graph.addNode(n);
    if (w != null) this._weights.setNodeWeight(n.address, w);
    return this;
  }

  /**
   * Returns the WeightedNode matching a given NodeAddressT, if such a node
   * exists, or undefined otherwise.
   */
  node(n: NodeAddressT): ?WeightedNode {
    const node = this._graph.node(n);
    if (node) {
      return {
        node,
        weight: this.getNodeAddressWeight(n),
      };
    }
  }

  /**
   * Returns an iterator over all of the WeightedNodes in the graph.
   *
   * Optionally, the caller can provide a node prefix. If
   * provided, the iterator will only contain nodes matching that
   * prefix. See semantics of [Address.hasPrefix][1] for details.
   *
   * Clients must not modify the graph during iteration. If they do so, an
   * error may be thrown at the iteration call site.
   *
   * Nodes are yielded in address-sorted order.
   *
   * [1]: https://github.com/sourcecred/sourcecred/blob/7c7fa2d83d4fd5ba38efb2b2f4e0244235ac1312/src/core/address.js#L74
   */
  nodes(options?: {|+prefix: NodeAddressT|}): Iterator<WeightedNode> {
    return this._nodesIterator(options);
  }

  *_nodesIterator(options?: {|+prefix: NodeAddressT|}): Iterator<WeightedNode> {
    const nodes = this._graph.nodes(options);
    for (const node of nodes) {
      const weight = this.getNodeAddressWeight(node.address);
      yield {node, weight};
    }
  }

  /**
   * Add an edge and optionally assign its weight. If a prefix of the edge's
   * address doesn't have a weight assigned, the weight will default to 1.
   *
   * It is permitted to add an edge if its src or dst are not in the graph. See
   * the discussion of 'Dangling Edges' in the module docstring for semantics.
   *
   * It is an error to add an edge if a distinct edge with the same address
   * already exists in the graph (i.e., if the source or destination are
   * different).
   *
   * Adding an edge that already exists to the graph is a no-op. (This
   * operation is idempotent.)
   *
   * Returns `this` for chaining.
   */
  addEdge(e: Edge, w?: EdgeWeight): this {
    this._graph.addEdge(e);
    if (w != null) this._weights.setEdgeWeight(e.address, w);
    return this;
  }

  /**
   * Returns the WeightedEdge matching a given EdgeAddressT, if such an edge
   * exists, or null otherwise.
   */
  edge(e: EdgeAddressT): ?WeightedEdge {
    const edge = this._graph.edge(e);
    if (edge) {
      return {
        edge,
        weight: this.getEdgeAddressWeight(e),
      };
    }
  }

  /**
   * Returns an iterator over Weightededges in the graph, optionally filtered by
   * edge address prefix, source address prefix, and/or destination address
   * prefix.
   *
   * The caller must pass an options object with a boolean field `showDangling`,
   * which determines whether dangling edges will be included in the results.
   * The caller may also pass fields `addressPrefix`, `srcPrefix`, and `dstPrefix`
   * to perform prefix-based address filtering of edges that are returned.
   * (See the module docstring for more context on dangling edges.)
   *
   * Suppose that you want to find every WeightedEdge that represents authorship
   * by a user. If all authorship edges have the `AUTHORS_EDGE_PREFIX` prefix
   * and all user nodes have the `USER_NODE_PREFIX` prefix, then you could call:
   *
   * wg.edges({
   *  showDangling: true,  // or false, irrelevant for this example
   *  addressPrefix: AUTHORS_EDGE_PREFIX,
   *  srcPrefix: USER_NODE_PREFIX,
   * });
   *
   * In this example, as `dstPrefix` was left unset, it will default to
   * `NodeAddress.empty`, which is a prefix of every node address.
   *
   * Clients must not modify the graph during iteration. If they do so, an
   * error may be thrown at the iteration call site.
   *
   * The weightedEdges are yielded in sorted address order.
   */
  edges(options: EdgesOptions): Iterator<WeightedEdge> {
    return this._edgesIterator(options);
  }

  *_edgesIterator(options: EdgesOptions): Iterator<WeightedEdge> {
    const edges = this._graph.edges(options);
    for (const edge of edges) {
      const weight = this.getEdgeAddressWeight(edge.address);
      yield {edge, weight};
    }
  }

  /**
   * Return the weight of a Node address.
   */
  getNodeAddressWeight(n: NodeAddressT): NodeWeight {
    return this._weights.getNodeWeight(n);
  }

  /**
   * Return the weight of an Edge address.
   */
  getEdgeAddressWeight(e: EdgeAddressT): EdgeWeight {
    return this._weights.getEdgeWeight(e);
  }

  // Utilities

  /**
   * Produce a copy of this WeightedGraph.
   *
   * The copy is equal to the original, but distinct, so that they may be
   * modified independently.
   */
  copy(): WeightedGraph2 {
    return WeightedGraph2.merge([this]);
  }

  /**
   * Compute the union of the given WeightedGraphs. The result is a new
   * WeightedGraph that has all of the nodes and all of the edges from all the
   * inputs.
   *
   * If two of the given graphs have edges with the same address, the edges
   * must be equal (i.e. must have the same source and destination in each
   * graph). If this is not the case, an error will be thrown.
   *
   * Example usage:
   *
   * let wg1 = new WeightedGraph().addNode(a).addNode(b).addEdge(e);
   * let wg2 = new WeightedGraph().addNode(b).addNode(c).addEdge(f);
   * let wg3 = WeightedGraph.merge([g1, g2]);
   * Array.from(wg3.nodes()).length;  // 3
   * Array.from(wg3.edges()).length;  // 2
   * wg1 = new WeightedGraph().addNode(a).addNode(b).addEdge(x);
   * wg2 = new WeightedGraph().addNode(c);
   * wg3 = WeightedGraph.merge([g1, g2]);
   *
   * The newly created WeightedGraph is a separate instance from any of the
   * input WeightedGraphs, and may be mutated independently.
   */
  static merge(wgs: Iterable<WeightedGraph2>): WeightedGraph2 {
    const graphs: Array<Graph> = [];
    const weights: Array<WeightsI> = [];
    for (const wg of wgs) {
      graphs.push(wg._graph);
      weights.push(wg._weights);
    }
    return new WeightedGraph2(Graph.merge(graphs), Weights().merge(weights));
  }

  /**
   * Serialize a WeightedGraph into a plain JavaScript object.
   */
  toJSON(): CompatibleWeightedGraphJSON {
    const rawJSON = {
      graph: this._graph.toJSON(),
      weights: this._weights.toJSON(),
    };
    return toCompat(COMPAT_INFO, rawJSON);
  }

  /**
   * Deserializes a CompatibleWeightedGraphJSON into a new WeightedGraph.
   */
  static fromJSON(compatJson: CompatibleWeightedGraphJSON): WeightedGraph2 {
    const {graph, weights} = fromCompat<WeightedGraphJSON>(
      COMPAT_INFO,
      compatJson
    );
    return new WeightedGraph2(Graph.fromJSON(graph), fromWeightsJSON(weights));
  }
}

export function compareWeightedGraphs(
  wg1: WeightedGraph2,
  wg2: WeightedGraph2
): WeightedGraphComparison {
  const graphComparison = compareGraphs(wg1._graph, wg2._graph);
  const weightsComparison = compareWeightsT(
    wg1._weights.eject(),
    wg2._weights.eject()
  );
  return {
    graphComparison,
    weightsComparison,
    weightedGraphsAreEqual:
      graphComparison.graphsAreEqual && weightsComparison.weightsAreEqual,
  };
}
