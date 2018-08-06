// @flow

import deepEqual from "lodash.isequal";
import sortBy from "lodash.sortby";

import {makeAddressModule, type AddressModule} from "./address";
import {toCompat, fromCompat, type Compatible} from "../util/compat";
import * as NullUtil from "../util/null";

export opaque type NodeAddressT: string = string;
export opaque type EdgeAddressT: string = string;
export const NodeAddress: AddressModule<NodeAddressT> = (makeAddressModule({
  name: "NodeAddress",
  nonce: "N",
  otherNonces: new Map().set("E", "EdgeAddress"),
}): AddressModule<string>);
export const EdgeAddress: AddressModule<EdgeAddressT> = (makeAddressModule({
  name: "EdgeAddress",
  nonce: "E",
  otherNonces: new Map().set("N", "NodeAddress"),
}): AddressModule<string>);

export type Edge = {|
  +address: EdgeAddressT,
  +src: NodeAddressT,
  +dst: NodeAddressT,
|};

// TODO: We should come up with a clear contract here, and
// probably defaultWeights should not live in this type.
// Discussion at #465
export type EdgeType = {|
  +forwardName: string,
  +backwardName: string,
  +prefix: EdgeAddressT,
|};

export type NodeType = {|
  +name: string,
  +prefix: NodeAddressT,
  +defaultWeight: number,
|};

const COMPAT_INFO = {type: "sourcecred/graph", version: "0.4.0"};

export type Neighbor = {|+node: NodeAddressT, +edge: Edge|};

export opaque type DirectionT = Symbol;
export const Direction: {|
  +IN: DirectionT,
  +OUT: DirectionT,
  +ANY: DirectionT,
|} = Object.freeze({
  IN: Symbol("IN"),
  OUT: Symbol("OUT"),
  ANY: Symbol("ANY"),
});

export type NeighborsOptions = {|
  +direction: DirectionT,
  +nodePrefix: NodeAddressT,
  +edgePrefix: EdgeAddressT,
|};

export type EdgesOptions = {|
  +addressPrefix: EdgeAddressT,
  +srcPrefix: NodeAddressT,
  +dstPrefix: NodeAddressT,
|};

type AddressJSON = string[]; // Result of calling {Node,Edge}Address.toParts
type Integer = number;
type IndexedEdgeJSON = {|
  +address: AddressJSON,
  +srcIndex: Integer,
  +dstIndex: Integer,
|};

export opaque type GraphJSON = Compatible<{|
  +nodes: AddressJSON[],
  +edges: IndexedEdgeJSON[],
|}>;

type ModificationCount = number;

export class Graph {
  _nodes: Set<NodeAddressT>;
  _edges: Map<EdgeAddressT, Edge>;
  _inEdges: Map<NodeAddressT, Edge[]>;
  _outEdges: Map<NodeAddressT, Edge[]>;

  checkInvariants() {
    if (this._invariantsLastChecked.when !== this._modificationCount) {
      let failure: ?string = null;
      try {
        this._checkInvariants();
      } catch (e) {
        failure = e.message;
      } finally {
        this._invariantsLastChecked = {
          when: this._modificationCount,
          failure,
        };
      }
    }
    if (this._invariantsLastChecked.failure != null) {
      throw new Error(this._invariantsLastChecked.failure);
    }
  }

  _checkInvariants() {
    // Definition. A node `n` is in the graph if `_nodes.has(n)`.
    //
    // Definition. An edge `e` is in the graph if `e` is deep-equal to
    // `_edges.get(e.address)`.
    //
    // Definition. A *logical value* is an equivalence class of ECMAScript
    // values modulo deep equality (or, from context, an element of such a
    // class).

    // Invariant 1. For a node `n`, if `n` is in the graph, then
    // `_inEdges.has(n)` and `_outEdges.has(n)`. The values of
    // `_inEdges.get(n)` and `_outEdges.get(n)` are arrays of `Edge`s.
    for (const node of this._nodes) {
      if (!this._inEdges.has(node)) {
        throw new Error(`missing in-edges for ${NodeAddress.toString(node)}`);
      }
      if (!this._outEdges.has(node)) {
        throw new Error(`missing out-edges for ${NodeAddress.toString(node)}`);
      }
    }

    // Invariant 2. For an edge address `a`, if `_edges.has(a)` and
    // `_edges.get(a) === e`, then:
    //  1. `e.address` equals `a`;
    //  2. `e.src` is in the graph;
    //  3. `e.dst` is in the graph;
    //  4. `_inEdges.get(e.dst)` contains `e`; and
    //  5. `_outEdges.get(e.src)` contains `e`.
    //
    // We check 2.1, 2.2, and 2.3 here, and check 2.4 and 2.5 later for
    // improved performance.
    for (const [address, edge] of this._edges.entries()) {
      if (edge.address !== address) {
        throw new Error(
          `bad edge address: ${edgeToString(edge)} does not match ${address}`
        );
      }
      if (!this._nodes.has(edge.src)) {
        throw new Error(`missing src for edge: ${edgeToString(edge)}`);
      }
      if (!this._nodes.has(edge.dst)) {
        throw new Error(`missing dst for edge: ${edgeToString(edge)}`);
      }
    }

    // Invariant 3. Suppose that `_inEdges.has(n)` and, let `es` be
    // `_inEdges.get(n)`. Then
    //  1. `n` is in the graph;
    //  2. `es` contains any logical value at most once;
    //  3. if `es` contains `e`, then `e` is in the graph; and
    //  4. if `es` contains `e`, then `e.dst === n`.
    //
    // Invariant 4. Suppose that `_outEdges.has(n)` and, let `es` be
    // `_outEdges.get(n)`. Then
    //  1. `n` is in the graph;
    //  2. `es` contains any logical value at most once;
    //  3. if `es` contains `e`, then `e` is in the graph; and
    //  4. if `es` contains `e`, then `e.src === n`.
    //
    // Note that Invariant 3.2 is equivalent to the following:
    //
    //     Invariant 3.2*. If `a` is an address, then there is at most
    //     one index `i` such that `es[i].address` is `a`.
    //
    // It is immediate that 3.2* implies 3.2. To see that 3.2 implies
    // 3.2*, suppose that `i` and `j` are such that `es[i].address` and
    // `es[j].address` are both `a`. Then, by Invariant 3.3, each of
    // `es[i]` and `es[j]` is in the graph, so each is deep-equal to
    // `_edges.get(a)`. Therefore, `es[i]` and `es[j]` are deep-equal to
    // each other. By 3.2, `es` contains a logical value at most once,
    // so `i` must be equal to `j`.
    //
    // Therefore, it is valid to verify that 3.2*, which we will do. The
    // same logic of course applies to Invariant 4.2.
    const inEdgesSeen: Set<EdgeAddressT> = new Set();
    const outEdgesSeen: Set<EdgeAddressT> = new Set();
    for (const {seen, map, baseNodeAccessor, kind} of [
      {
        seen: inEdgesSeen,
        map: this._inEdges,
        baseNodeAccessor: (e) => e.dst,
        kind: "in-edge",
      },
      {
        seen: outEdgesSeen,
        map: this._outEdges,
        baseNodeAccessor: (e) => e.src,
        kind: "out-edge",
      },
    ]) {
      for (const [base, edges] of map.entries()) {
        if (!this._nodes.has(base)) {
          // 3.1/4.1
          throw new Error(
            `spurious ${kind}s for ${NodeAddress.toString(base)}`
          );
        }
        for (const edge of edges) {
          // 3.2/4.2
          if (seen.has(edge.address)) {
            throw new Error(`duplicate ${kind}: ${edgeToString(edge)}`);
          }
          seen.add(edge.address);
          const expected = this._edges.get(edge.address);
          // 3.3/4.3
          if (!deepEqual(edge, expected)) {
            if (expected == null) {
              throw new Error(`spurious ${kind}: ${edgeToString(edge)}`);
            } else {
              const vs = `${edgeToString(edge)} vs. ${edgeToString(expected)}`;
              throw new Error(`bad ${kind}: ${vs}`);
            }
          }
          // 3.4/4.4
          const expectedBase = baseNodeAccessor(edge);
          if (base !== baseNodeAccessor(edge)) {
            throw new Error(
              `bad ${kind}: ${edgeToString(edge)} should be ` +
                `should be anchored at ${NodeAddress.toString(expectedBase)}`
            );
          }
        }
      }
    }

    // We now return to check 2.4 and 2.5, with the help of the
    // structures that we have built up in checking Invariants 3 and 4.
    for (const edge of this._edges.values()) {
      // That `_inEdges.get(n)` contains `e` for some `n` is sufficient
      // to show that `_inEdges.get(e.dst)` contains `e`: if `n` were
      // something other than `e.dst`, then we would have a failure of
      // invariant 3.4, which would have been caught earlier. Likewise
      // for `_outEdges`.
      if (!inEdgesSeen.has(edge.address)) {
        throw new Error(`missing in-edge: ${edgeToString(edge)}`);
      }
      if (!outEdgesSeen.has(edge.address)) {
        throw new Error(`missing out-edge: ${edgeToString(edge)}`);
      }
    }
  }

  _maybeCheckInvariants() {
    if (process.env.NODE_ENV === "test") {
      // TODO(perf): If this method becomes really slow, we can disable
      // it on specific tests wherein we construct large graphs.
      this.checkInvariants();
    }
  }

  // Incremented each time that any change is made to the graph. Used to
  // check for comodification and to avoid needlessly checking
  // invariants.
  _modificationCount: ModificationCount;
  _invariantsLastChecked: {|+when: ModificationCount, +failure: ?string|};

  constructor(): void {
    this._modificationCount = 0;
    this._invariantsLastChecked = {
      when: -1,
      failure: "Invariants never checked",
    };
    this._nodes = new Set();
    this._edges = new Map();
    this._inEdges = new Map();
    this._outEdges = new Map();
    this._maybeCheckInvariants();
  }

  _checkForComodification(since: ModificationCount) {
    // TODO(perf): Consider eliding this in production.
    const now = this._modificationCount;
    if (now === since) {
      this._maybeCheckInvariants();
      return;
    }
    if (now > since) {
      throw new Error("Concurrent modification detected");
    }
    if (now < since) {
      throw new Error(
        "Invariant violation: expected modification count in the future"
      );
    }
    this._maybeCheckInvariants();
  }

  _markModification() {
    // TODO(perf): Consider eliding this in production.
    if (this._modificationCount >= Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `Graph cannot be modified more than ${this._modificationCount} times.`
      );
    }
    this._modificationCount++;
    this._maybeCheckInvariants();
  }

  addNode(a: NodeAddressT): this {
    NodeAddress.assertValid(a);
    if (!this._nodes.has(a)) {
      this._nodes.add(a);
      this._inEdges.set(a, []);
      this._outEdges.set(a, []);
    }
    this._markModification();
    this._maybeCheckInvariants();
    return this;
  }

  removeNode(a: NodeAddressT): this {
    NodeAddress.assertValid(a);
    const existingInEdges = this._inEdges.get(a) || [];
    const existingOutEdges = this._outEdges.get(a) || [];
    const existingEdges = existingInEdges.concat(existingOutEdges);
    if (existingEdges.length > 0) {
      const strAddress = NodeAddress.toString(a);
      const strExampleEdge = edgeToString(existingEdges[0]);
      throw new Error(
        `Attempted to remove ${strAddress}, which is incident to ${
          existingEdges.length
        } edge(s), e.g.: ${strExampleEdge}`
      );
    }
    this._inEdges.delete(a);
    this._outEdges.delete(a);
    this._nodes.delete(a);
    this._markModification();
    this._maybeCheckInvariants();
    return this;
  }

  hasNode(a: NodeAddressT): boolean {
    NodeAddress.assertValid(a);
    const result = this._nodes.has(a);
    this._maybeCheckInvariants();
    return result;
  }

  nodes(options?: {|+prefix: NodeAddressT|}): Iterator<NodeAddressT> {
    const prefix = options != null ? options.prefix : NodeAddress.empty;
    if (prefix == null) {
      throw new Error(`Invalid prefix: ${String(prefix)}`);
    }
    const result = this._nodesIterator(this._modificationCount, prefix);
    this._maybeCheckInvariants();
    return result;
  }

  *_nodesIterator(
    initialModificationCount: ModificationCount,
    prefix: NodeAddressT
  ): Iterator<NodeAddressT> {
    for (const node of this._nodes) {
      if (NodeAddress.hasPrefix(node, prefix)) {
        this._checkForComodification(initialModificationCount);
        this._maybeCheckInvariants();
        yield node;
      }
    }
    this._checkForComodification(initialModificationCount);
    this._maybeCheckInvariants();
  }

  addEdge(edge: Edge): this {
    NodeAddress.assertValid(edge.src, "edge.src");
    NodeAddress.assertValid(edge.dst, "edge.dst");
    EdgeAddress.assertValid(edge.address, "edge.address");

    const srcMissing = !this._nodes.has(edge.src);
    const dstMissing = !this._nodes.has(edge.dst);
    if (srcMissing || dstMissing) {
      const missingThing = srcMissing ? "src" : "dst";
      throw new Error(`Missing ${missingThing} on edge: ${edgeToString(edge)}`);
    }
    const existingEdge = this._edges.get(edge.address);
    if (existingEdge != null) {
      if (
        existingEdge.src !== edge.src ||
        existingEdge.dst !== edge.dst ||
        existingEdge.address !== edge.address
      ) {
        const strEdge = edgeToString(edge);
        const strExisting = edgeToString(existingEdge);
        throw new Error(
          `conflict between new edge ${strEdge} and existing ${strExisting}`
        );
      }
    } else {
      this._edges.set(edge.address, edge);
      const inEdges = NullUtil.get(this._inEdges.get(edge.dst));
      const outEdges = NullUtil.get(this._outEdges.get(edge.src));
      inEdges.push(edge);
      outEdges.push(edge);
    }
    this._edges.set(edge.address, edge);
    this._markModification();
    this._maybeCheckInvariants();
    return this;
  }

  removeEdge(address: EdgeAddressT): this {
    EdgeAddress.assertValid(address);
    const edge = this._edges.get(address);
    if (edge != null) {
      this._edges.delete(address);
      const inEdges = NullUtil.get(this._inEdges.get(edge.dst));
      const outEdges = NullUtil.get(this._outEdges.get(edge.src));
      // TODO(perf): This is linear in the degree of the endpoints of the
      // edge. Consider storing in non-list form (e.g., `_inEdges` and
      // `_outEdges` could be `Map<NodeAddressT, Set<EdgeAddressT>>`).
      [inEdges, outEdges].forEach((edges) => {
        const index = edges.findIndex((edge) => edge.address === address);
        if (index === -1) {
          const strAddress = EdgeAddress.toString(address);
          throw new Error(
            `Invariant violation when removing edge@${strAddress}`
          );
        }
        edges.splice(index, 1);
      });
    }
    this._markModification();
    this._maybeCheckInvariants();
    return this;
  }

  hasEdge(address: EdgeAddressT): boolean {
    EdgeAddress.assertValid(address);
    const result = this._edges.has(address);
    this._maybeCheckInvariants();
    return result;
  }

  edge(address: EdgeAddressT): ?Edge {
    EdgeAddress.assertValid(address);
    const result = this._edges.get(address);
    this._maybeCheckInvariants();
    return result;
  }

  edges(options?: EdgesOptions): Iterator<Edge> {
    if (options == null) {
      options = {
        addressPrefix: EdgeAddress.empty,
        srcPrefix: NodeAddress.empty,
        dstPrefix: NodeAddress.empty,
      };
    }
    if (options.addressPrefix == null) {
      throw new Error(
        `Invalid address prefix: ${String(options.addressPrefix)}`
      );
    }
    if (options.srcPrefix == null) {
      throw new Error(`Invalid src prefix: ${String(options.srcPrefix)}`);
    }
    if (options.dstPrefix == null) {
      throw new Error(`Invalid dst prefix: ${String(options.dstPrefix)}`);
    }
    const result = this._edgesIterator(this._modificationCount, options);
    this._maybeCheckInvariants();
    return result;
  }

  *_edgesIterator(
    initialModificationCount: ModificationCount,
    options: EdgesOptions
  ): Iterator<Edge> {
    for (const edge of this._edges.values()) {
      if (
        EdgeAddress.hasPrefix(edge.address, options.addressPrefix) &&
        NodeAddress.hasPrefix(edge.src, options.srcPrefix) &&
        NodeAddress.hasPrefix(edge.dst, options.dstPrefix)
      ) {
        this._checkForComodification(initialModificationCount);
        this._maybeCheckInvariants();
        yield edge;
      }
    }
    this._checkForComodification(initialModificationCount);
    this._maybeCheckInvariants();
  }

  neighbors(node: NodeAddressT, options: NeighborsOptions): Iterator<Neighbor> {
    if (!this.hasNode(node)) {
      throw new Error(`Node does not exist: ${NodeAddress.toString(node)}`);
    }
    const result = this._neighbors(node, options, this._modificationCount);
    this._maybeCheckInvariants();
    return result;
  }

  *_neighbors(
    node: NodeAddressT,
    options: NeighborsOptions,
    initialModificationCount: ModificationCount
  ): Iterator<Neighbor> {
    const nodeFilter = (n) => NodeAddress.hasPrefix(n, options.nodePrefix);
    const edgeFilter = (e) => EdgeAddress.hasPrefix(e, options.edgePrefix);
    const direction = options.direction;
    const adjacencies: {edges: Edge[], direction: string}[] = [];
    if (direction === Direction.IN || direction === Direction.ANY) {
      const inEdges = NullUtil.get(this._inEdges.get(node));
      adjacencies.push({edges: inEdges, direction: "IN"});
    }
    if (direction === Direction.OUT || direction === Direction.ANY) {
      const outEdges = NullUtil.get(this._outEdges.get(node));
      adjacencies.push({edges: outEdges, direction: "OUT"});
    }

    for (const adjacency of adjacencies) {
      for (const edge of adjacency.edges) {
        if (direction === Direction.ANY && adjacency.direction === "IN") {
          if (edge.src === edge.dst) {
            continue; // don't yield loop edges twice.
          }
        }
        const neighborNode = adjacency.direction === "IN" ? edge.src : edge.dst;
        if (nodeFilter(neighborNode) && edgeFilter(edge.address)) {
          this._checkForComodification(initialModificationCount);
          this._maybeCheckInvariants();
          yield {edge, node: neighborNode};
        }
      }
    }
    this._checkForComodification(initialModificationCount);
    this._maybeCheckInvariants();
  }

  equals(that: Graph): boolean {
    if (!(that instanceof Graph)) {
      throw new Error(`Expected Graph, got ${String(that)}`);
    }
    const result =
      deepEqual(this._nodes, that._nodes) &&
      deepEqual(this._edges, that._edges);
    this._maybeCheckInvariants();
    return result;
  }

  copy(): Graph {
    const result = Graph.merge([this]);
    this._maybeCheckInvariants();
    return result;
  }

  toJSON(): GraphJSON {
    const sortedNodes = Array.from(this.nodes()).sort();
    const nodeToSortedIndex = new Map();
    sortedNodes.forEach((node, i) => {
      nodeToSortedIndex.set(node, i);
    });
    const sortedEdges = sortBy(Array.from(this.edges()), (x) => x.address);
    const indexedEdges = sortedEdges.map(({src, dst, address}) => {
      const srcIndex = NullUtil.get(nodeToSortedIndex.get(src));
      const dstIndex = NullUtil.get(nodeToSortedIndex.get(dst));
      return {srcIndex, dstIndex, address: EdgeAddress.toParts(address)};
    });
    const rawJSON = {
      nodes: sortedNodes.map((x) => NodeAddress.toParts(x)),
      edges: indexedEdges,
    };
    const result = toCompat(COMPAT_INFO, rawJSON);
    this._maybeCheckInvariants();
    return result;
  }

  static fromJSON(json: GraphJSON): Graph {
    const {nodes: nodesJSON, edges} = fromCompat(COMPAT_INFO, json);
    const result = new Graph();
    const nodes = nodesJSON.map((x) => NodeAddress.fromParts(x));
    nodes.forEach((n) => result.addNode(n));
    edges.forEach(({address, srcIndex, dstIndex}) => {
      const src = nodes[srcIndex];
      const dst = nodes[dstIndex];
      result.addEdge({address: EdgeAddress.fromParts(address), src, dst});
    });
    return result;
  }

  static merge(graphs: Iterable<Graph>): Graph {
    const result = new Graph();
    for (const graph of graphs) {
      for (const node of graph.nodes()) {
        result.addNode(node);
      }
      for (const edge of graph.edges()) {
        result.addEdge(edge);
      }
    }
    return result;
  }
}

export function edgeToString(edge: Edge): string {
  const address = EdgeAddress.toString(edge.address);
  const src = NodeAddress.toString(edge.src);
  const dst = NodeAddress.toString(edge.dst);
  return `{address: ${address}, src: ${src}, dst: ${dst}}`;
}

/**
 * Convert an edge to an object whose fields are human-readable strings.
 * This is useful for storing edges in human-readable formats that
 * should not include NUL characters, such as Jest snapshots.
 */
export function edgeToStrings(
  edge: Edge
): {|
  +address: string,
  +src: string,
  +dst: string,
|} {
  return {
    address: EdgeAddress.toString(edge.address),
    src: NodeAddress.toString(edge.src),
    dst: NodeAddress.toString(edge.dst),
  };
}

export function edgeToParts(
  edge: Edge
): {|+addressParts: string[], +srcParts: string[], +dstParts: string[]|} {
  const addressParts = EdgeAddress.toParts(edge.address);
  const srcParts = NodeAddress.toParts(edge.src);
  const dstParts = NodeAddress.toParts(edge.dst);
  return {addressParts, srcParts, dstParts};
}
