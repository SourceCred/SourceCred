// @flow

import {type TimestampMs} from "../../util/timestamp";
import * as NullUtil from "../../util/null";
import {type IntervalSequence, intervalSequence} from "../interval";
import {Ledger} from "./ledger";
import {type AllocationPolicy} from "./policies";
import {CredGraph} from "../credrank/credGraph";
import {computeDistribution} from "./computeDistribution";
import {type Distribution} from "./distribution";
import {CredGrainView} from "../credGrainView";

export type DistributionPolicy = {|
  // Each distribution will include each of the specified allocation policies
  +allocationPolicies: $ReadOnlyArray<AllocationPolicy>,
  // How many old distributions we may create (e.g. if the project has never
  // had a Grain distribution in the past, do you want to create distributions
  // going back the whole history, or limit to only 1 or 2 recent distributions).
  +maxSimultaneousDistributions: number,
|};

/**
 * Iteratively compute and distribute Grain, based on the provided CredGraph,
 * into the provided Ledger, according to the specified DistributionPolicy.
 *
 * Here are some examples of how it works:
 *
 * - The last time there was a distribution was two days ago. Since then,
 *   no new Cred Intervals have been completed. This method will no-op.
 *
 * - The last time there was a distribution was last week. Since then, one new
 *   Cred Interval has been completed. The method will apply one Distribution.
 *
 * - The last time there was a distribution was a month ago. Since then, four
 *   Cred Intervals have been completed. The method will apply four Distributions,
 *   unless maxOldDistributions is set to a lower number (e.g. 2), in which case
 *   that maximum number of distributions will be applied.
 *
 * It returns the list of applied distributions, which may be helpful for
 * diagnostics, printing a summary, etc.
 */
export function applyDistributions(
  policy: DistributionPolicy,
  credGraph: CredGraph,
  ledger: Ledger,
  currentTimestamp: TimestampMs,
  allowMultipleDistributionsPerInterval: boolean
): $ReadOnlyArray<Distribution> {
  const credIntervals = credGraph.intervals();
  const distributionIntervals = _chooseDistributionIntervals(
    credIntervals,
    NullUtil.orElse(ledger.lastDistributionTimestamp(), -Infinity),
    currentTimestamp,
    policy.maxSimultaneousDistributions,
    allowMultipleDistributionsPerInterval
  );
  return distributionIntervals.map((interval) => {
    // Recompute for every endpoint because the Ledger will be in a different state
    // (wrt paid balances)

    //const accountsData = computeCredAccounts(ledger, credGraph);
    const credGrainData = CredGrainView.fromCredGraphAndLedger(
      credGraph,
      ledger
    );
    const distribution = computeDistribution(
      policy.allocationPolicies,
      credGrainData,
      interval.endTimeMs
    );
    ledger.distributeGrain(distribution);
    return distribution;
  });
}

export function _chooseDistributionIntervals(
  credIntervals: IntervalSequence,
  lastDistributionTimestamp: TimestampMs,
  currentTimestamp: TimestampMs,
  maxSimultaneousDistributions: number,
  allowMultipleDistributionsPerInterval: boolean
): IntervalSequence {
  // Slice off the final interval--we may assume that it is not yet finished.
  const completeIntervals = credIntervals.filter(
    (x) => x.endTimeMs <= currentTimestamp
  );
  const undistributedIntervals = completeIntervals.filter(
    (i) => i.endTimeMs > lastDistributionTimestamp
  );
  const sequence = undistributedIntervals.slice(
    undistributedIntervals.length - maxSimultaneousDistributions,
    undistributedIntervals.length
  );
  if (allowMultipleDistributionsPerInterval && !sequence.length)
    return intervalSequence(
      completeIntervals.slice(completeIntervals.length - 1)
    );
  return intervalSequence(sequence);
}
