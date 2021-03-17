// @flow
import * as pluginId from "../api/pluginId";
import {
  CredGraph,
  jsonParser as credGraphJsonParser,
} from "../core/credrank/credGraph";
import {
  type CurrencyDetails,
  parser as currencyParser,
  defaultCurrencyConfig,
} from "../api/currencyConfig";
import {LedgerManager} from "../api/ledgerManager";
import {rawParser as rawInstanceConfigParser} from "../api/rawInstanceConfig";
import {createLedgerDiskStorage} from "./utils/ledgerDiskStorage";
import * as Combo from "../util/combo";
import {NetworkStorage} from "../core/storage/network";
import {loadJson, loadJsonWithDefault} from "../util/storage";

export type LoadResult = LoadSuccess | LoadFailure;
export type LoadSuccess = {|
  +type: "SUCCESS",
  +ledgerManager: LedgerManager,
  +bundledPlugins: $ReadOnlyArray<pluginId.PluginId>,
  +hasBackend: boolean,
  +currency: CurrencyDetails,
  +credGraph: CredGraph | null,
|};
export type LoadFailure = {|+type: "FAILURE", +error: any|};

export type BackendConfig = {|+hasBackend: boolean|};
export const backendParser: Combo.Parser<BackendConfig> = Combo.object({
  hasBackend: Combo.boolean,
});

export async function load(): Promise<LoadResult> {
  // TODO (@topocount) refactor to better
  // utilize functional programming best practices.
  // Optional loads require some better organization
  // than ternaries. There's also a lot of repeated code here

  const diskStorage = createLedgerDiskStorage("data/ledger.json");
  const networkStorage = new NetworkStorage("");
  const ledgerManager = new LedgerManager({
    storage: diskStorage,
  });

  const queries = [
    loadJson(networkStorage, "sourcecred.json", rawInstanceConfigParser),
    loadJson(networkStorage, "static/server-info.json", backendParser),
    loadJsonWithDefault(
      networkStorage,
      "config/currencyDetails.json",
      currencyParser,
      defaultCurrencyConfig
    ),
    loadJsonWithDefault(
      networkStorage,
      "output/credGraph.json",
      Combo.fmap(credGraphJsonParser, (graphJson) =>
        CredGraph.fromJSON(graphJson)
      ),
      () => null
    ),
  ];
  try {
    const [
      {bundledPlugins},
      {hasBackend},
      currency,
      credGraph,
    ] = await Promise.all(queries);

    const ledgerResult = await ledgerManager.reloadLedger();
    if (ledgerResult.error) {
      return {
        type: "FAILURE",
        error: `Error processing ledger events: ${ledgerResult.error}`,
      };
    }
    return {
      type: "SUCCESS",
      bundledPlugins,
      ledgerManager,
      hasBackend,
      currency,
      credGraph,
    };
  } catch (e) {
    console.error(e);
    return {type: "FAILURE", error: e};
  }
}
