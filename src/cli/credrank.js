// @flow

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import {join as pathJoin} from "path";

import {credrank} from "../core/algorithm/credrank";
import {LoggingTaskReporter} from "../util/taskReporter";
import {MarkovProcessGraph} from "../core/markovProcessGraph";
import type {Command} from "./command";
import {loadFileWithDefault} from "../util/disk";
import {makePluginDir, loadInstanceConfig} from "./common";
import {
  type WeightedGraph,
  merge,
  fromJSON as weightedGraphFromJSON,
} from "../core/weightedGraph";
import {contractions as identityContractions} from "../ledger/identity";
import {Ledger} from "../ledger/ledger";

const DEFAULT_ALPHA = 0.1;
const DEFAULT_BETA = 0.4;
const DEFAULT_GAMMA_FORWARD = 0.1;
const DEFAULT_GAMMA_BACKWARD = 0.1;

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const credrankCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    return die(std, "usage: sourcecred credrank");
  }
  const taskReporter = new LoggingTaskReporter();
  taskReporter.start("credrank");

  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);

  const graphOutputPrefix = ["output", "graphs"];
  async function loadGraph(pluginName): Promise<WeightedGraph> {
    const outputDir = makePluginDir(baseDir, graphOutputPrefix, pluginName);
    const outputPath = pathJoin(outputDir, "graph.json");
    const graphJSON = JSON.parse(await fs.readFile(outputPath));
    return weightedGraphFromJSON(graphJSON);
  }

  taskReporter.start("load ledger");
  const ledgerPath = pathJoin(baseDir, "data", "ledger.json");
  const ledger = Ledger.parse(
    await loadFileWithDefault(ledgerPath, () => new Ledger().serialize())
  );
  taskReporter.finish("load ledger");

  taskReporter.start("merge graphs");
  const pluginNames = Array.from(config.bundledPlugins.keys());
  const graphs = await Promise.all(pluginNames.map(loadGraph));
  const weightedGraph = merge(graphs);
  taskReporter.finish("merge graphs");

  taskReporter.start("apply identities");
  const identities = ledger.accounts().map((a) => a.identity);
  const contractedGraph = weightedGraph.graph.contractNodes(
    identityContractions(identities)
  );
  const contractedWeightedGraph = {
    graph: contractedGraph,
    weights: weightedGraph.weights,
  };
  taskReporter.finish("apply identities");

  taskReporter.start("create Markov process graph");
  // TODO: Support loading transition probability params from config.
  const fibrationOptions = {
    scoringAddresses: new Set(identities.map((i) => i.address)),
    beta: DEFAULT_BETA,
    gammaForward: DEFAULT_GAMMA_FORWARD,
    gammaBackward: DEFAULT_GAMMA_BACKWARD,
  };
  const seedOptions = {
    alpha: DEFAULT_ALPHA,
  };
  const dependencyOptions = {
    policies: [],
  };
  const mpg = MarkovProcessGraph.new(contractedWeightedGraph, {
    fibration: fibrationOptions,
    seed: seedOptions,
    dependencies: dependencyOptions,
  });
  taskReporter.finish("create Markov process graph");

  taskReporter.start("run CredRank");
  const credGraph = await credrank(mpg);
  taskReporter.finish("run CredRank");

  taskReporter.start("write cred graph");
  const cgJson = stringify(credGraph.toJSON());
  const outputPath = pathJoin(baseDir, "output", "credGraph.json");
  await fs.writeFile(outputPath, cgJson);
  taskReporter.finish("write cred graph");

  return 0;
};

export default credrankCommand;
