// @flow

import * as uuid from "../../util/uuid";
import {type TimestampMs} from "../../util/timestamp";
import {type AllocationIdentity, computeAllocation} from "./grainAllocation";
import {type AllocationPolicy} from "./policies";
import {type CredGrainView} from "../credGrainView";
import {type Distribution} from "./distribution";

/**
 * Compute a single Distribution using CredAccountData.
 *
 * The distribution will include the provided policies.
 * It will be computed using only Cred intervals that are finished as of the
 * effectiveTimestamp.
 *
 * Note: This method is untested as it is just a bit of plubming; flow gives me
 * confidence that the semantics are correct. The helper method
 * _allocationIdentities is tested, as it handles some naunces e.g. slicing
 * down the cred interval data.
 */
export function computeDistribution(
  policies: $ReadOnlyArray<AllocationPolicy>,
  credGrainData: CredGrainView,
  effectiveTimestamp: TimestampMs
): Distribution {
  const allocationIdentities = _allocationIdentities(
    credGrainData,
    effectiveTimestamp
  );
  const allocations = policies.map((p) =>
    computeAllocation(p, allocationIdentities)
  );
  const distribution = {
    id: uuid.random(),
    allocations,
    credTimestamp: effectiveTimestamp,
  };
  return distribution;
}

export function _allocationIdentities(
  credGrainData: CredGrainView,
  effectiveTimestamp: TimestampMs
): $ReadOnlyArray<AllocationIdentity> {
  const activeParticipants = credGrainData
    .participants()
    .filter((participant) => participant.active);

  const allocationIdentities = activeParticipants.map((x) => ({
    id: x.identity.id,
    paid: x.grainEarned,
    cred: x.credPerInterval,
  }));
  const numIntervals = credGrainData
    .intervals()
    .filter((x) => x.endTimeMs <= effectiveTimestamp).length;
  const timeSlicedAllocationIdentities = allocationIdentities.map((x) => ({
    id: x.id,
    paid: x.paid,
    cred: x.cred.slice(0, numIntervals),
  }));
  return timeSlicedAllocationIdentities;
}
