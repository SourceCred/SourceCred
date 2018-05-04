// @flow

import deepEqual from "lodash.isequal";
import stringify from "json-stable-stringify";
import type {Address, Addressable, AddressMapJSON} from "./address";
import {AddressMap} from "./address";

export type Node<+T> = {|
  +address: Address,
  +payload: T,
|};

export type Edge<+T> = {|
  +address: Address,
  +src: Address,
  +dst: Address,
  +payload: T,
|};

export type GraphJSON<NP, EP> = {|
  +nodes: AddressMapJSON<Node<NP>>,
  +edges: AddressMapJSON<Edge<EP>>,
|};

export class Graph<NP, EP> {
  _nodes: AddressMap<Node<NP>>;
  _edges: AddressMap<Edge<EP>>;

  // The keyset of each of the following fields should equal the keyset
  // of `_nodes`. If `e` is an edge from `u` to `v`, then `e.address`
  // should appear exactly once in `_outEdges[u.address]` and exactly
  // once in `_inEdges[v.address]` (and every entry in `_inEdges` and
  // `_outEdges` should be of this form).
  _outEdges: AddressMap<{|+address: Address, +edges: Address[]|}>;
  _inEdges: AddressMap<{|+address: Address, +edges: Address[]|}>;

  constructor() {
    this._nodes = new AddressMap();
    this._edges = new AddressMap();
    this._outEdges = new AddressMap();
    this._inEdges = new AddressMap();
  }

  copy(): Graph<$Supertype<NP>, $Supertype<EP>> {
    return Graph.mergeConservative(new Graph(), this);
  }

  equals(that: Graph<NP, EP>): boolean {
    return this._nodes.equals(that._nodes) && this._edges.equals(that._edges);
  }

  toJSON(): GraphJSON<NP, EP> {
    return {
      nodes: this._nodes.toJSON(),
      edges: this._edges.toJSON(),
    };
  }

  static fromJSON<NP, EP>(json: GraphJSON<NP, EP>): Graph<NP, EP> {
    const result = new Graph();
    AddressMap.fromJSON(json.nodes)
      .getAll()
      .forEach((node) => {
        result.addNode(node);
      });
    AddressMap.fromJSON(json.edges)
      .getAll()
      .forEach((edge) => {
        result.addEdge(edge);
      });
    return result;
  }

  _lookupEdges(
    map: AddressMap<{|+address: Address, +edges: Address[]|}>,
    key: Address
  ): Address[] {
    const result = map.get(key);
    return result ? result.edges : [];
  }

  addNode(node: Node<NP>): Graph<NP, EP> {
    if (node == null) {
      throw new Error(`node is ${String(node)}`);
    }
    const existingNode = this.node(node.address);
    if (existingNode !== undefined) {
      if (deepEqual(existingNode, node)) {
        return this;
      } else {
        throw new Error(
          `node at address ${JSON.stringify(
            node.address
          )} exists with distinct contents`
        );
      }
    }
    this._nodes.add(node);
    this._outEdges.add({
      address: node.address,
      edges: this._lookupEdges(this._outEdges, node.address),
    });
    this._inEdges.add({
      address: node.address,
      edges: this._lookupEdges(this._inEdges, node.address),
    });
    return this;
  }

  removeNode(address: Address): this {
    this._nodes.remove(address);
    return this;
  }

  addEdge(edge: Edge<EP>): Graph<NP, EP> {
    if (edge == null) {
      throw new Error(`edge is ${String(edge)}`);
    }
    const existingEdge = this.edge(edge.address);
    if (existingEdge !== undefined) {
      if (deepEqual(existingEdge, edge)) {
        return this;
      } else {
        throw new Error(
          `edge at address ${JSON.stringify(
            edge.address
          )} exists with distinct contents`
        );
      }
    }
    this._edges.add(edge);

    const theseOutEdges = this._lookupEdges(this._outEdges, edge.src);
    theseOutEdges.push(edge.address);
    this._outEdges.add({address: edge.src, edges: theseOutEdges});

    const theseInEdges = this._lookupEdges(this._inEdges, edge.dst);
    theseInEdges.push(edge.address);
    this._inEdges.add({address: edge.dst, edges: theseInEdges});

    return this;
  }

  removeEdge(address: Address): this {
    // TODO(perf): This is linear in the degree of the endpoints of the
    // edge. Consider storing in non-list form.
    const edge = this.edge(address);
    if (edge) {
      [
        this._lookupEdges(this._inEdges, edge.dst),
        this._lookupEdges(this._outEdges, edge.src),
      ].forEach((edges) => {
        const index = edges.findIndex((ea) => deepEqual(ea, address));
        if (index !== -1) {
          edges.splice(index, 1);
        }
      });
    }
    this._edges.remove(address);
    return this;
  }

  node(address: Address): Node<NP> {
    return this._nodes.get(address);
  }

  edge(address: Address): Edge<EP> {
    return this._edges.get(address);
  }

  /**
   * Find the neighborhood of the node at the given address.
   *
   * By neighborhood, we mean every `{edge, neighbor}` such that edge
   * has `nodeAddress` as either `src` or `dst`, and `neighbor` is the
   * address at the other end of the edge.
   *
   * The returned neighbors are filtered according to the `options`. Callers
   * can filter by nodeType, edgeType, and whether it should be an "IN" edge
   * (i.e. the provided node is the dst), an "OUT" edge (i.e. provided node is
   * the src), or "ANY".
   */
  neighborhood(
    nodeAddress: Address,
    options?: {|
      +nodeType?: string,
      +edgeType?: string,
      +direction?: "IN" | "OUT" | "ANY",
    |}
  ): {+edge: Edge<EP>, +neighbor: Address}[] {
    if (nodeAddress == null) {
      throw new Error(`address is ${String(nodeAddress)}`);
    }

    let result: {+edge: Edge<EP>, +neighbor: Address}[] = [];
    const direction = (options != null && options.direction) || "ANY";

    if (direction === "ANY" || direction === "IN") {
      let inNeighbors = this._lookupEdges(this._inEdges, nodeAddress).map(
        (e) => {
          const edge = this.edge(e);
          return {edge, neighbor: edge.src};
        }
      );

      result = result.concat(inNeighbors);
    }

    if (direction === "ANY" || direction === "OUT") {
      let outNeighbors = this._lookupEdges(this._outEdges, nodeAddress).map(
        (e) => {
          const edge = this.edge(e);
          return {edge, neighbor: edge.dst};
        }
      );

      if (direction === "ANY") {
        // If direction is ANY, we already counted self-referencing edges as
        // an inNeighbor
        outNeighbors = outNeighbors.filter(
          ({edge}) => !deepEqual(edge.src, edge.dst)
        );
      }

      result = result.concat(outNeighbors);
    }
    if (options != null && options.edgeType != null) {
      const edgeType = options.edgeType;
      result = result.filter(({edge}) => edge.address.type === edgeType);
    }
    if (options != null && options.nodeType != null) {
      const nodeType = options.nodeType;
      result = result.filter(({neighbor}) => neighbor.type === nodeType);
    }
    return result;
  }

  /**
   * Get nodes in the graph, in unspecified order.
   *
   * If filter is provided, it will return only nodes with the requested type.
   */
  nodes(filter?: {type?: string}): Node<NP>[] {
    let nodes = this._nodes.getAll();
    if (filter != null && filter.type != null) {
      const typeFilter = filter.type;
      nodes = nodes.filter((n) => n.address.type === typeFilter);
    }
    return nodes;
  }

  /**
   * Gets edges in the graph, in unspecified order.
   *
   * If filter is provided, it will return only edges with the requested type.
   */
  edges(filter?: {type?: string}): Edge<EP>[] {
    let edges = this._edges.getAll();
    if (filter != null && filter.type != null) {
      const typeFilter = filter.type;
      edges = edges.filter((e) => e.address.type === typeFilter);
    }
    return edges;
  }

  /**
   * Merge two graphs. When two nodes have the same address, a resolver
   * function will be called with the two nodes; the resolver should
   * return a new node with the same address, which will take the place
   * of the two nodes in the new graph. Edges have similar behavior.
   *
   * The existing graph objects are not modified.
   */
  static merge<NP, EP, N1: NP, E1: EP, N2: NP, E2: EP>(
    g1: Graph<N1, E1>,
    g2: Graph<N2, E2>,
    nodeResolver: (Node<N1>, Node<N2>) => Node<NP>,
    edgeResolver: (Edge<E1>, Edge<E2>) => Edge<EP>
  ): Graph<NP, EP> {
    const result: Graph<NP, EP> = new Graph();
    g1.nodes().forEach((node) => {
      if (g2.node(node.address) !== undefined) {
        const resolved = nodeResolver(node, g2.node(node.address));
        result.addNode(resolved);
      } else {
        result.addNode(node);
      }
    });
    g2.nodes().forEach((node) => {
      if (result.node(node.address) === undefined) {
        result.addNode(node);
      }
    });
    g1.edges().forEach((edge) => {
      if (g2.edge(edge.address) !== undefined) {
        const resolved = edgeResolver(edge, g2.edge(edge.address));
        result.addEdge(resolved);
      } else {
        result.addEdge(edge);
      }
    });
    g2.edges().forEach((edge) => {
      if (result.edge(edge.address) === undefined) {
        result.addEdge(edge);
      }
    });
    return result;
  }

  /**
   * Merge two graphs, assuming that if `g1` and `g2` both have a node
   * with a given address, then the nodes are deep-equal (and the same
   * for edges). If this assumption does not hold, this function will
   * raise an error.
   */
  static mergeConservative<NP, EP, N1: NP, E1: EP, N2: NP, E2: EP>(
    g1: Graph<N1, E1>,
    g2: Graph<N2, E2>
  ): Graph<NP, EP> {
    function conservativeResolver<T: Addressable>(
      kinds: string /* used for an error message on mismatch */,
      a: T,
      b: T
    ): T {
      if (deepEqual(a, b)) {
        return a;
      } else {
        throw new Error(
          `distinct ${kinds} with address ${JSON.stringify(a.address)}`
        );
      }
    }
    const result: Graph<NP, EP> = Graph.merge(
      g1,
      g2,
      (u, v) => conservativeResolver("nodes", u, v),
      (e, f) => conservativeResolver("edges", e, f)
    );
    return result;
  }

  /**
   * Equivalent to
   *
   *     graphs.reduce((g, h) => Graph.mergeConservative(g, h), new Graph()),
   *
   * but uses a mutable accumulator for improved performance.
   */
  static mergeManyConservative<NP, EP>(
    graphs: $ReadOnlyArray<Graph<$Subtype<NP>, $Subtype<EP>>>
  ): Graph<NP, EP> {
    const result = new Graph();
    graphs.forEach((graph) => {
      graph.nodes().forEach((node) => {
        result.addNode(node);
      });
      graph.edges().forEach((edge) => {
        result.addEdge(edge);
      });
    });
    return result;
  }
}

export function edgeID(src: Address, dst: Address): string {
  return stringify([src, dst]);
}
