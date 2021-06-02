// @flow

import {Instance} from "./instance";
import {type CredrankInput, type CredrankOutput} from "../main/credrank";
import {type GraphInput, type GraphOutput} from "../main/graph";
import {type GrainInput} from "../main/grain";
import {type AnalysisInput, type AnalysisOutput} from "../main/analysis";
import {
  type WeightsT,
  parser as weightsParser,
  empty as emptyWeights,
} from "../../core/weights";
import {join as pathJoin} from "path";
import stringify from "json-stable-stringify";
import {
  type WeightedGraph,
  type WeightedGraphJSON,
  fromJSON as weightedGraphFromJSON,
  toJSON as weightedGraphToJSON,
} from "../../core/weightedGraph";
import {
  loadJson,
  loadFileWithDefault,
  loadJsonWithDefault,
} from "../../util/storage";
import {mkdirx} from "../../util/disk";
import {parser as configParser, type InstanceConfig} from "../instanceConfig";
import {Ledger} from "../../core/ledger/ledger";
import {
  parser as dependenciesParser,
  type DependenciesConfig,
} from "../dependenciesConfig";
import {type Budget} from "../../core/mintBudget";
import {parser as pluginBudgetParser} from "../pluginBudgetConfig";
import {
  CredGraph,
  parser as credGraphParser,
} from "../../core/credrank/credGraph";
import {DiskStorage} from "../../core/storage/disk";
import {WritableZipStorage} from "../../core/storage/zip";
import {encode} from "../../core/storage/textEncoding";
import * as Combo from "../../util/combo";
import type {PluginDirectoryContext} from "../plugin";
import {type GrainConfig, parser as grainConfigParser} from "../grainConfig";
import {
  parser as currencyConfigParser,
  type CurrencyDetails,
} from "../currencyConfig";
import {defaultCurrencyConfig} from "../currencyConfig";
import {type CredAccountData} from "../../core/ledger/credAccounts";
import {
  type PersonalAttributionsConfig,
  personalAttributionsConfigParser,
} from "../config/personalAttributionsConfig";
import type {GrainIntegrationOutput} from "../../core/ledger/grainIntegration";
import type {Distribution} from "../../core/ledger/distribution";

const DEPENDENCIES_PATH: $ReadOnlyArray<string> = [
  "config",
  "dependencies.json",
];
const WEIGHT_OVERRIDES_PATH: $ReadOnlyArray<string> = [
  "config",
  "weights.json",
];
const BUDGET_PATH: $ReadOnlyArray<string> = ["config", "pluginBudgets.json"];
const GRAIN_PATH: $ReadOnlyArray<string> = ["config", "grain.json"];
const CURRENCY_PATH: $ReadOnlyArray<string> = [
  "config",
  "currencyDetails.json",
];
const PERSONAL_ATTRIBUTIONS_PATH: $ReadOnlyArray<string> = [
  "config",
  "personalAttributions.json",
];
const INSTANCE_CONFIG_PATH: $ReadOnlyArray<string> = ["sourcecred.json"];
const CREDGRAPH_PATH: $ReadOnlyArray<string> = [
  "output",
  "credGraph.json.gzip",
];
const GRAPHS_DIRECTORY: $ReadOnlyArray<string> = ["output", "graphs"];
const GRAPHS_PATH: $ReadOnlyArray<string> = ["graph.json.gzip"];
const LEDGER_PATH: $ReadOnlyArray<string> = ["data", "ledger.json"];
const ACCOUNTS_PATH: $ReadOnlyArray<string> = ["output", "accounts.json"];
const GRAIN_INTEGRATION_DIRECTORY: $ReadOnlyArray<string> = [
  "output",
  "grainIntegration",
];

/**
This is an Instance implementation that reads and writes using relative paths
on the local disk.
 */
export class LocalInstance implements Instance {
  _baseDirectory: string;
  _storage: DiskStorage;
  _zipStorage: WritableZipStorage;

  constructor(baseDirectory: string) {
    this._baseDirectory = baseDirectory;
    this._storage = new DiskStorage(baseDirectory);
    this._zipStorage = new WritableZipStorage(this._storage);
  }

  //////////////////////////////
  //  Interface Functions
  //////////////////////////////

  async readGraphInput(): Promise<GraphInput> {
    const [instanceConfig, ledger] = await Promise.all([
      this.readInstanceConfig(),
      this.readLedger(),
    ]);
    const plugins = [];
    for (const plugin of instanceConfig.bundledPlugins.values()) {
      plugins.push({
        plugin,
        directoryContext: this.pluginDirectoryContext(plugin.id),
      });
    }
    return {
      plugins,
      ledger,
    };
  }

  async readCredrankInput(): Promise<CredrankInput> {
    const [
      pluginGraphs,
      ledger,
      weightOverrides,
      dependencies,
      pluginsBudget,
      personalAttributions,
    ] = await Promise.all([
      this.readPluginGraphs(),
      this.readLedger(),
      this.readWeightOverrides(),
      this.readDependencies(),
      this.readPluginsBudget(),
      this.readPersonalAttributions(),
    ]);
    return {
      pluginGraphs,
      ledger,
      weightOverrides,
      dependencies,
      pluginsBudget,
      personalAttributions,
    };
  }

  async readGrainInput(): Promise<GrainInput> {
    const [
      credGraph,
      ledger,
      grainConfig,
      currencyDetails,
    ] = await Promise.all([
      this.readCredGraph(),
      this.readLedger(),
      this.readGrainConfig(),
      this.readCurrencyDetails(),
    ]);
    return {
      credGraph,
      ledger,
      grainConfig,
      currencyDetails,
    };
  }

  async readAnalysisInput(): Promise<AnalysisInput> {
    const [credGraph, ledger] = await Promise.all([
      this.readCredGraph(),
      this.readLedger(),
    ]);
    return {
      credGraph,
      ledger,
    };
  }

  async readWeightedGraphForPlugin(pluginId: string): Promise<WeightedGraph> {
    const outputPath = pathJoin(
      this.createPluginGraphDirectory(pluginId),
      ...GRAPHS_PATH
    );
    const graphJSON = await loadJson(
      this._zipStorage,
      outputPath,
      ((Combo.raw: any): Combo.Parser<WeightedGraphJSON>)
    );
    return weightedGraphFromJSON(graphJSON);
  }

  async readCredGraph(): Promise<CredGraph> {
    const credGraphPath = pathJoin(...CREDGRAPH_PATH);
    return loadJson(this._zipStorage, credGraphPath, credGraphParser);
  }

  async readLedger(): Promise<Ledger> {
    const ledgerPath = pathJoin(...LEDGER_PATH);
    return loadFileWithDefault(this._storage, ledgerPath, () =>
      new Ledger().serialize()
    ).then((result) => Ledger.parse(result));
  }

  async writeGrainIntegrationOutput(
    output: GrainIntegrationOutput,
    distribution: Distribution
  ): Promise<void> {
    mkdirx(pathJoin(...GRAIN_INTEGRATION_DIRECTORY));
    const credDateString = new Date(
      distribution.credTimestamp
      // utilise the `SE` datestring format since it appears like `YYYY-MM-DD`
      // with numbers and is therefore easy to sort on and human-readable.
    ).toLocaleDateString("en-SE");
    const grainIntegrationPath = pathJoin(
      ...GRAIN_INTEGRATION_DIRECTORY,
      credDateString + "_" + output.fileName
    );
    this._storage.set(grainIntegrationPath, encode(output.content));
  }

  async writeGraphOutput(graphOutput: GraphOutput): Promise<void> {
    await Promise.all([
      this.writeLedger(graphOutput.ledger),
      ...graphOutput.pluginGraphs.map(({pluginId, weightedGraph}) =>
        this.writePluginGraph(pluginId, weightedGraph)
      ),
    ]);
  }

  async writeCredrankOutput(credrankOutput: CredrankOutput): Promise<void> {
    await Promise.all([
      this.writeLedger(credrankOutput.ledger),
      this.writeCredGraph(credrankOutput.credGraph),
      this.writeDependenciesConfig(credrankOutput.dependencies),
      this.writePersonalAttributionsConfig(credrankOutput.personalAttributions),
    ]);
  }

  async writeAnalysisOutput(analysisOutput: AnalysisOutput): Promise<void> {
    await Promise.all([this.writeCredAccounts(analysisOutput.accounts)]);
  }

  async writeLedger(ledger: Ledger): Promise<void> {
    const ledgerPath = pathJoin(...LEDGER_PATH);
    return this._storage.set(ledgerPath, encode(ledger.serialize()));
  }

  //////////////////////////////
  //  Private Functions
  //////////////////////////////

  async readInstanceConfig(): Promise<InstanceConfig> {
    const pluginsConfigPath = pathJoin(...INSTANCE_CONFIG_PATH);
    return loadJson(this._storage, pluginsConfigPath, configParser);
  }

  async readPluginGraphs(): Promise<Array<WeightedGraph>> {
    const instanceConfig = await this.readInstanceConfig();
    const pluginNames = Array.from(instanceConfig.bundledPlugins.keys());
    return await Promise.all(
      pluginNames.map(async (name) => {
        const outputDir = this.createPluginDirectory(GRAPHS_DIRECTORY, name);
        const outputPath = pathJoin(outputDir, ...GRAPHS_PATH);
        const graphJSON = await loadJson(
          this._zipStorage,
          outputPath,
          ((Combo.raw: any): Combo.Parser<WeightedGraphJSON>)
        );
        return weightedGraphFromJSON(graphJSON);
      })
    );
  }

  async readWeightOverrides(): Promise<WeightsT> {
    const weightsPath = pathJoin(...WEIGHT_OVERRIDES_PATH);
    return loadJsonWithDefault(
      this._storage,
      weightsPath,
      weightsParser,
      emptyWeights
    );
  }

  async readDependencies(): Promise<DependenciesConfig> {
    const dependenciesPath = pathJoin(...DEPENDENCIES_PATH);
    return loadJsonWithDefault(
      this._storage,
      dependenciesPath,
      dependenciesParser,
      () => []
    );
  }

  async readPluginsBudget(): Promise<Budget | null> {
    const budgetPath = pathJoin(...BUDGET_PATH);
    return loadJsonWithDefault(
      this._storage,
      budgetPath,
      pluginBudgetParser,
      () => null
    );
  }

  async readGrainConfig(): Promise<GrainConfig> {
    const grainConfigPath = pathJoin(...GRAIN_PATH);
    return loadJson(this._storage, grainConfigPath, grainConfigParser);
  }

  async readCurrencyDetails(): Promise<CurrencyDetails> {
    const currencyDetailsPath = pathJoin(...CURRENCY_PATH);
    return loadJsonWithDefault(
      this._storage,
      currencyDetailsPath,
      currencyConfigParser,
      defaultCurrencyConfig
    );
  }

  async readPersonalAttributions(): Promise<PersonalAttributionsConfig> {
    const path = pathJoin(...PERSONAL_ATTRIBUTIONS_PATH);
    return loadJsonWithDefault(
      this._storage,
      path,
      personalAttributionsConfigParser,
      () => []
    );
  }

  createPluginDirectory(
    components: $ReadOnlyArray<string>,
    pluginId: string
  ): string {
    const idParts = pluginId.split("/");
    if (idParts.length !== 2) {
      throw new Error(`Bad plugin name: ${pluginId}`);
    }
    const [pluginOwner, pluginName] = idParts;
    const pathComponents = [...components, pluginOwner, pluginName];
    let path = this._baseDirectory;
    for (const pc of pathComponents) {
      path = pathJoin(path, pc);
      mkdirx(path);
    }
    return pathJoin(...pathComponents);
  }

  createPluginGraphDirectory(pluginId: string): string {
    return this.createPluginDirectory(GRAPHS_DIRECTORY, pluginId);
  }

  pluginDirectoryContext(pluginName: string): PluginDirectoryContext {
    const cacheDir = this.createPluginDirectory(["cache"], pluginName);
    const configDir = this.createPluginDirectory(
      ["config", "plugins"],
      pluginName
    );
    return {
      configDirectory() {
        return configDir;
      },
      cacheDirectory() {
        return cacheDir;
      },
    };
  }

  async writeCredGraph(credGraph: CredGraph): Promise<void> {
    const cgJson = stringify(credGraph.toJSON());
    const outputPath = pathJoin(...CREDGRAPH_PATH);
    return this._zipStorage.set(outputPath, encode(cgJson));
  }

  async writePluginGraph(
    pluginId: string,
    weightedGraph: WeightedGraph
  ): Promise<void> {
    const serializedGraph = encode(
      stringify(weightedGraphToJSON(weightedGraph))
    );
    const outputDir = this.createPluginGraphDirectory(pluginId);
    const outputPath = pathJoin(outputDir, ...GRAPHS_PATH);
    return this._zipStorage.set(outputPath, serializedGraph);
  }

  async writeDependenciesConfig(
    dependenciesConfig: DependenciesConfig
  ): Promise<void> {
    const dependenciesPath = pathJoin(...DEPENDENCIES_PATH);
    return this._storage.set(
      dependenciesPath,
      stringify(dependenciesConfig, {space: 4})
    );
  }

  async writePersonalAttributionsConfig(
    config: PersonalAttributionsConfig
  ): Promise<void> {
    const path = pathJoin(...PERSONAL_ATTRIBUTIONS_PATH);
    return this._storage.set(path, stringify(config, {space: 4}));
  }

  async writeCredAccounts(credAccounts: CredAccountData): Promise<void> {
    const accountsPath = pathJoin(...ACCOUNTS_PATH);
    return this._storage.set(accountsPath, encode(stringify(credAccounts)));
  }
}
