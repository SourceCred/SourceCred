// @flow
import {WeightedGraph2 as WG, compareWeightedGraphs} from "./weightedGraph2";
import {type EdgeWeight} from "./weights/edgeWeights";
import {type NodeWeight} from "./weights/nodeWeights";
import {Graph} from "./graph";

import * as GraphUtil from "./graphTestUtil";

describe("src/core/weightedGraph2", () => {
  function getWG(graph?: Graph): WG {
    return new WG(graph);
  }
  function testWg(graph?: Graph) {
    const node1 = GraphUtil.node("test");
    const node2 = GraphUtil.node("test2");
    return {
      wg: getWG(graph),
      node1,
      node2,
      nodeWeight: 5,
      edge: GraphUtil.edge("edge1", node1, node2),
      edgeWeight: {forwards: 2, backwards: 2},
      defaultEdgeWeight: {forwards: 1, backwards: 1},
      defaultNodeWeight: 1,
    };
  }
  describe("constructor", () => {
    it("can be instantiated without args", () => {
      getWG();
    });
    it("can be instantiated with a valid graph param", () => {
      const g = new Graph();
      getWG(g);
    });
  });
  describe("setNodePrefixWeight", () => {
    it("can set the weight for a node prefix", () => {
      const {wg, node1, nodeWeight} = testWg();
      const result = wg.setNodePrefixWeight(node1.address, nodeWeight);
      expect(result.getNodeAddressWeight(node1.address)).toEqual(nodeWeight);
    });
    it("can overwrite an existing weight", () => {
      const {wg, node1, nodeWeight, defaultNodeWeight} = testWg();
      wg.setNodePrefixWeight(
        node1.address,
        defaultNodeWeight
      ).setNodePrefixWeight(node1.address, nodeWeight);
      expect(wg.getNodeAddressWeight(node1.address)).toEqual(nodeWeight);
    });
  });
  describe("setEdgePrefixWeight", () => {
    it("can set the weight for an edge prefix", () => {
      const {wg, edge, edgeWeight} = testWg();
      wg.setEdgePrefixWeight(edge.address, edgeWeight);
      expect(wg.getEdgeAddressWeight(edge.address)).toEqual(edgeWeight);
    });
    it("can overwrite an existing weight", () => {
      const {wg, edge, edgeWeight} = testWg();
      const newWeight = {forwards: 4, backwards: 4};
      wg.setEdgePrefixWeight(edge.address, edgeWeight).setEdgePrefixWeight(
        edge.address,
        newWeight
      );
      expect(wg.getEdgeAddressWeight(edge.address)).toEqual(newWeight);
    });
  });
  describe("addNode", () => {
    it("adds an node", () => {
      const {node1, wg, defaultNodeWeight} = testWg();
      wg.addNode(node1);
      expect(wg._graph.node(node1.address)).toEqual(node1);
      expect(wg.getNodeAddressWeight(node1.address)).toEqual(defaultNodeWeight);
    });
    it("can add a duplicated node", () => {
      const {node1, wg, defaultNodeWeight} = testWg();
      wg.addNode(node1).addNode(node1);
      expect(wg._graph.node(node1.address)).toEqual(node1);
      expect(wg.getNodeAddressWeight(node1.address)).toEqual(defaultNodeWeight);
    });
    it("cannot modify an existing node", () => {
      const {node1, wg, node2} = testWg();
      const changedNode = {...node1, description: node2.description};
      const thunk = () => wg.addNode(node1).addNode(changedNode);
      expect(thunk).toThrow("conflict between new node");
    });
    it("accepts a configured weight", () => {
      const {node1, wg, nodeWeight} = testWg();
      wg.addNode(node1, nodeWeight);
      expect(wg._graph.node(node1.address)).toEqual(node1);
      expect(wg.getNodeAddressWeight(node1.address)).toEqual(nodeWeight);
    });
  });
  describe("node", () => {
    it("returns a node with the default weight if one exists", () => {
      const {node1, wg, defaultNodeWeight} = testWg();
      wg.addNode(node1);
      expect(wg.node(node1.address)).toEqual({
        node: node1,
        weight: defaultNodeWeight,
      });
    });
    it("returns an node with the configured weight if one exists", () => {
      const {node1, wg, nodeWeight} = testWg();
      wg.addNode(node1, nodeWeight);
      expect(wg.node(node1.address)).toEqual({node: node1, weight: nodeWeight});
    });
    it("returns a node with a product of weights on its prefixes", () => {
      const {wg, nodeWeight, node1, defaultNodeWeight} = testWg();
      function nodeProduct(ws: $ReadOnlyArray<NodeWeight>): NodeWeight {
        return ws.reduce(
          (totalWeight, nextWeight) => totalWeight * nextWeight,
          defaultNodeWeight
        );
      }
      const subNode1 = GraphUtil.partsNode(["test", "two"]);
      wg.setNodePrefixWeight(node1.address, nodeWeight);
      wg.addNode(subNode1, nodeWeight);
      expect(wg.node(subNode1.address)).toEqual({
        node: subNode1,
        weight: nodeProduct([nodeWeight, nodeWeight]),
      });
    });
    it("returns undefined if no node exists", () => {
      const {node1, wg} = testWg();
      expect(wg.node(node1.address)).toBe(undefined);
    });
  });
  describe("nodes", () => {
    it("returns an array of nodes", () => {
      const {node1, wg, defaultNodeWeight} = testWg();
      wg.addNode(node1);
      expect(Array.from(wg.nodes())).toEqual([
        {node: node1, weight: defaultNodeWeight},
      ]);
    });
  });
  describe("addEdge", () => {
    it("adds an edge", () => {
      const {edge, wg, defaultEdgeWeight} = testWg();
      wg.addEdge(edge);
      expect(wg._graph.edge(edge.address)).toEqual(edge);
      expect(wg.getEdgeAddressWeight(edge.address)).toEqual(defaultEdgeWeight);
    });
    it("can add a duplicated edge", () => {
      const {edge, wg, defaultEdgeWeight} = testWg();
      wg.addEdge(edge).addEdge(edge);
      expect(wg._graph.edge(edge.address)).toEqual(edge);
      expect(wg.getEdgeAddressWeight(edge.address)).toEqual(defaultEdgeWeight);
    });
    it("cannot modify an existing edge", () => {
      const {edge, wg, node2} = testWg();
      const changedEdge = {...edge, src: node2.address};
      const thunk = () => wg.addEdge(edge).addEdge(changedEdge);
      expect(thunk).toThrow("conflict between new edge");
    });
    it("accepts a configured weight", () => {
      const {edge, wg, edgeWeight} = testWg();
      wg.addEdge(edge, edgeWeight);
      expect(wg._graph.edge(edge.address)).toEqual(edge);
      expect(wg.getEdgeAddressWeight(edge.address)).toEqual(edgeWeight);
    });
  });
  describe("edge", () => {
    it("returns an edge with the default weight if one exists", () => {
      const {edge, wg, defaultEdgeWeight} = testWg();
      wg.addEdge(edge);
      expect(wg.edge(edge.address)).toEqual({edge, weight: defaultEdgeWeight});
    });
    it("returns an edge with the configured weight if one exists", () => {
      const {edge, wg, edgeWeight} = testWg();
      wg.addEdge(edge, edgeWeight);
      expect(wg.edge(edge.address)).toEqual({edge, weight: edgeWeight});
    });
    it("returns an edge with a product of weights on its prefixes", () => {
      const {wg, edgeWeight, node1, node2, edge, defaultEdgeWeight} = testWg();
      function edgeProduct(ws: $ReadOnlyArray<EdgeWeight>): EdgeWeight {
        return ws.reduce(
          (totalWeight, nextWeight) => ({
            forwards: totalWeight.forwards * nextWeight.forwards,
            backwards: totalWeight.backwards * nextWeight.backwards,
          }),
          defaultEdgeWeight
        );
      }
      const edge2 = GraphUtil.partsEdge(["edge1", "two"], node1, node2);
      wg.setEdgePrefixWeight(edge.address, edgeWeight);
      wg.addEdge(edge2, edgeWeight);
      expect(wg.edge(edge2.address)).toEqual({
        edge: edge2,
        weight: edgeProduct([edgeWeight, edgeWeight]),
      });
    });
    it("returns undefined if no edge exists", () => {
      const {edge, wg} = testWg();
      expect(wg.edge(edge.address)).toBe(undefined);
    });
  });
  describe("edges", () => {
    const defaultOptions = {showDangling: true};
    it("returns an array of edges", () => {
      const {edge, wg, defaultEdgeWeight} = testWg();
      wg.addEdge(edge);
      expect(Array.from(wg.edges(defaultOptions))).toEqual([
        {edge, weight: defaultEdgeWeight},
      ]);
    });
  });
  describe("merge and copy", () => {
    it("merges two WeightedGraph2's", () => {
      const {wg: wg1, node1, node2, nodeWeight, defaultNodeWeight} = testWg();
      const wg2 = wg1.copy();
      wg1.addNode(node1, nodeWeight);
      wg2.addNode(node2);
      expect(compareWeightedGraphs(wg1, wg2).weightedGraphsAreEqual).toBe(
        false
      );
      const wg3 = WG.merge([wg1, wg2]);
      expect(wg3.node(node1.address)).toEqual({
        node: node1,
        weight: nodeWeight,
      });
      expect(wg3.node(node1.address)).toEqual({
        node: node1,
        weight: nodeWeight,
      });
      expect(wg3.node(node2.address)).toEqual({
        node: node2,
        weight: defaultNodeWeight,
      });
    });
    it("copy creates an identical, distinct WeightedGraph instance", () => {
      const {wg: wg1, node1, node2, nodeWeight, edge, edgeWeight} = testWg();
      wg1.addNode(node1, nodeWeight).addNode(node2).addEdge(edge, edgeWeight);
      const wg2 = wg1.copy();
      expect(compareWeightedGraphs(wg1, wg2).weightedGraphsAreEqual).toBe(true);
      expect(wg1).not.toBe(wg2);
      const subNode1 = GraphUtil.partsNode(["test", "two"]);
      wg2.addNode(subNode1, nodeWeight);
      // ensure wg1 is not also updated
      expect(compareWeightedGraphs(wg1, wg2).weightedGraphsAreEqual).toBe(
        false
      );
    });
  });
  describe("JSON", () => {
    it("toJSON and fromJSON serialize and deserialize correctly", () => {
      const {wg: wg1, node1, node2, nodeWeight, edge, edgeWeight} = testWg();
      wg1.addNode(node1, nodeWeight).addNode(node2).addEdge(edge, edgeWeight);
      const wg2 = WG.fromJSON(wg1.toJSON());
      expect(compareWeightedGraphs(wg1, wg2).weightedGraphsAreEqual).toBe(true);
    });
  });
});
