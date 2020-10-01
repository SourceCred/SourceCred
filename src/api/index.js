// @flow

import deepFreeze from "deep-freeze";

// Exports for calling SourceCred code programmatically. Both the
// structure and the contents of this API are experimental and subject
// to change.
import * as address from "../core/address";
import * as discourseAddress from "../plugins/discourse/address";
import * as discourseDeclaration from "../plugins/discourse/declaration";
import * as discordDeclaration from "../plugins/experimental-discord/declaration";
import * as initiativesDeclaration from "../plugins/initiatives/declaration";
import * as githubDeclaration from "../plugins/github/declaration";
import * as githubEdges from "../plugins/github/edges";
import * as githubNodes from "../plugins/github/nodes";
import * as graph from "../core/graph";
import * as weightedGraph from "../core/weightedGraph";
import * as weights from "../core/weights";
import * as graphToMarkovChain from "../core/algorithm/graphToMarkovChain";
import * as markovChain from "../core/algorithm/markovChain";
import * as credView from "../analysis/credView";
import * as credData from "../analysis/credData";
import * as credResult from "../analysis/credResult";
import * as ledger from "../ledger/ledger";
import * as grain from "../ledger/grain";
import * as identity from "../ledger/identity";

const api = {
  core: {
    address,
    algorithm: {
      markovChain,
      graphToMarkovChain,
    },
    graph,
    weightedGraph,
    weights,
  },
  analysis: {
    credView,
    credData,
    credResult,
  },
  ledger: {
    ledger,
    identity,
    grain,
  },
  plugins: {
    github: {
      declaration: githubDeclaration,
      edges: githubEdges,
      nodes: githubNodes,
    },
    discourse: {
      address: discourseAddress,
      declaration: discourseDeclaration,
    },
    discord: {
      declaration: discordDeclaration,
    },
    initiatives: {
      declaration: initiativesDeclaration,
    },
  },
};

export default (deepFreeze(api): typeof api);
