// @flow

import type {GrainIntegrationFunction} from "../core/ledger/grainIntegration";
import * as C from "../util/combo";

import {csvIntegration} from "sc-grainIntegration-csv";

export type GrainIntegration = {|
  name: string,
  function: GrainIntegrationFunction,
|};

export function bundledGrainIntegrations(
  integration: string
): GrainIntegrationFunction {
  switch (integration) {
    case "csv":
      return csvIntegration;
    default:
      throw new Error(
        "grain integration not found; enter a valid `integration` value in config/grain.json"
      );
  }
}

export const parser: C.Parser<GrainIntegration> = C.fmap(
  C.exactly(["csv"]),
  (integrationKey) => ({
    name: integrationKey,
    function: bundledGrainIntegrations(integrationKey),
  })
);
