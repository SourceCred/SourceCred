// @flow

import {type DistributionPolicy} from "../core/ledger/applyDistributions";
import * as C from "../util/combo";
import * as NullUtil from "../util/null";
import {
  type AllocationPolicy,
  policyConfigParser,
} from "../core/ledger/policies";
import {fromInteger as toNonnegativeGrain} from "../core/ledger/nonnegativeGrain";
import {toDiscount} from "../core/ledger/policies/recent";
import {type Name, parser as nameParser} from "../core/identity/name";
import {
  type GrainIntegration,
  parser as bundledGrainIntegrationParser,
} from "./bundledGrainIntegrations";
export type GrainConfig = {|
  +immediatePerWeek?: number, // (deprecated)
  +balancedPerWeek?: number, // (deprecated)
  +recentPerWeek?: number, // (deprecated)
  +recentWeeklyDecayRate?: number, // (deprecated)
  +allocationPolicies?: $ReadOnlyArray<AllocationPolicy>,
  +maxSimultaneousDistributions?: number,
  +sinkIdentity?: Name,
  +processDistributions?: boolean,
  +integration?: GrainIntegration,
|};

export const parser: C.Parser<GrainConfig> = C.object(
  {},
  {
    allocationPolicies: C.array<AllocationPolicy>(policyConfigParser),
    maxSimultaneousDistributions: C.number,
    immediatePerWeek: C.number,
    balancedPerWeek: C.number,
    recentPerWeek: C.number,
    recentWeeklyDecayRate: C.number,
    sinkIdentity: nameParser,
    processDistributions: C.boolean,
    integration: bundledGrainIntegrationParser,
  }
);

/**
 * Create a DistributionPolicy from GrainConfig, checking that config
 * fields can form valid policies.
 *
 * Moving forward, policies will need to be passed in the `allocationPolicies`
 * parameter; however to avoid backcompatability issues, we optionally allow
 * the deprecated fields for the time being.
 */
export function toDistributionPolicy(x: GrainConfig): DistributionPolicy {
  const allocationPolicies = NullUtil.orElse(x.allocationPolicies, []);

  const immediatePerWeek = NullUtil.orElse(x.immediatePerWeek, 0);
  const recentPerWeek = NullUtil.orElse(x.recentPerWeek, 0);
  const balancedPerWeek = NullUtil.orElse(x.balancedPerWeek, 0);

  if (!isNonnegativeInteger(immediatePerWeek)) {
    throw new Error(
      `immediate budget must be nonnegative integer, got ${immediatePerWeek}`
    );
  }
  if (!isNonnegativeInteger(recentPerWeek)) {
    throw new Error(
      `recent budget must be nonnegative integer, got ${recentPerWeek}`
    );
  }
  if (!isNonnegativeInteger(balancedPerWeek)) {
    throw new Error(
      `balanced budget must be nonnegative integer, got ${balancedPerWeek}`
    );
  }

  const allocationPoliciesDeprecated = [];
  if (immediatePerWeek > 0) {
    allocationPoliciesDeprecated.push({
      budget: toNonnegativeGrain(immediatePerWeek),
      policyType: "IMMEDIATE",
      numIntervalsLookback: 1, // TODO(eli): no customization until after #2600.
    });
  }
  if (recentPerWeek > 0) {
    const {recentWeeklyDecayRate} = x;
    if (recentWeeklyDecayRate == null) {
      throw new Error(`no recentWeeklyDecayRate specified for recent policy`);
    }
    allocationPoliciesDeprecated.push({
      budget: toNonnegativeGrain(recentPerWeek),
      policyType: "RECENT",
      discount: toDiscount(recentWeeklyDecayRate),
    });
  }
  if (balancedPerWeek > 0) {
    allocationPoliciesDeprecated.push({
      budget: toNonnegativeGrain(balancedPerWeek),
      policyType: "BALANCED",
    });
  }
  const maxSimultaneousDistributions = NullUtil.orElse(
    x.maxSimultaneousDistributions,
    Infinity
  );
  return {
    allocationPolicies: allocationPolicies.concat(allocationPoliciesDeprecated),
    maxSimultaneousDistributions,
  };
}

function isNonnegativeInteger(x: number): boolean {
  return x >= 0 && isFinite(x) && Math.floor(x) === x;
}
