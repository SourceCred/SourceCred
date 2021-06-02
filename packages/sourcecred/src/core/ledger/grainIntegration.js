// @flow

import {Ledger, type PayoutAddress, type CurrencyId} from "./ledger";
import {type Distribution} from "./distribution";
import {getDistributionBalances} from "./distributionSummary/distributionSummary.js";
import {type Currency} from "./currency.js";
import {type IdentityId} from "../identity";
import * as NullUtil from "../../util/null";
import * as G from "./grain";

type Transfer = {|
  payoutAddress: PayoutAddress,
  amount: G.Grain,
  memo: string,
|};

export type PayoutDistributions = Array<[PayoutAddress, G.Grain]>;
export type PayoutAddressToId = Map<PayoutAddress, IdentityId>;
export type TransferredGrain = Array<Transfer>;
export type GrainIntegrationOutput = {|
  fileName: string,
  content: string,
|};

export type PayoutResult = {|
  // Amounts that are actually distributed by the integration.
  // If Grain balances are tracked in the ledger, these will be recorded as
  // transfers in the ledger to the "sink" Identity.
  transferredGrain: TransferredGrain,
  // output files and content
  outputFile?: GrainIntegrationOutput,
|};

export type IntegrationConfig = {|
  // This determines whether contemporary grain balances are tracked by the ledger.
  // `true` is effectively the current state of the ledger.
  // `false` sets all grain balances to zero and disables transfers. This
  // is utilized to enforce the existence of token balances outside of the
  // ledger. Importantly, Grain Receipts from allocations are still tracked,
  // because some grain distribution strategies rely on this information.
  accountingEnabled: boolean,
  // This enables a new ledger event where all distributions after this
  // config is enabled should have a matching "Integration" event. If not,
  // an interface should prompt admin interface users that they haven't
  // distributed funds via a configured integration
  processDistributions: boolean,
  currency: Currency,
|};

/**
 * This function definition is implemented by Grain Integrations.
 * Grain integrations allow distributions to be executed programmatically
 * beyond the ledger. However, an integration might have some side-effects
 * that require the ledger to be updated, and it therefore has the option of
 * returning a list of of ledger operations. The ledger will update the ledger
 * if accounting is enabled. Otherwise, grain balances will be tracked
 * elsewhere.
 */
export type GrainIntegrationFunction = (
  PayoutDistributions,
  IntegrationConfig
) => PayoutResult;

///////////////////
// Helper functions
///////////////////

// TODO @topocount: Refactor interface using instance/config properties
// after grainConfig is updated to include The payout currency details and
// sink identity
export function executeGrainIntegration(
  ledger: Ledger,
  integration: GrainIntegrationFunction,
  distribution: Distribution,
  currency: Currency,
  processDistributions: boolean,
  sink?: IdentityId,
  // TODO (@topocount) setup accounting config in ledger and remove this config
  // which is just for proof-of-concept
  accountingEnabled?: boolean = false
): {ledger: Ledger, grainIntegrationOutput?: GrainIntegrationOutput} {
  const {payoutDistributions, payoutAddressToId} = buildDistributionIndexes(
    ledger,
    distribution,
    JSON.stringify(currency)
  );
  // Need to receive actual allocations so users don't lose funds if
  // decimals are truncated in L2 or in some other environment that must modify
  // the fixed-point amount for some reason.
  let result;
  try {
    result = integration(payoutDistributions, {
      currency,
      accountingEnabled,
      processDistributions,
    });
    if (processDistributions) ledger.markDistributionExecuted(distribution.id);
  } catch (e) {
    throw new Error(`Grain Integration failed: ${e}`);
  }
  if (result && sink && accountingEnabled && processDistributions) {
    const {transferredGrain} = result;
    for (const {payoutAddress, amount, memo} of transferredGrain) {
      const recipientId = payoutAddressToId.get(payoutAddress);
      if (!recipientId)
        throw new Error(`Invalid recipient address: ${payoutAddress}`);
      ledger.transferGrain({
        from: recipientId,
        to: sink,
        amount,
        memo: `Integrated Distribution: ${memo}`,
      });
    }
  }
  return {ledger, grainIntegrationOutput: result.outputFile};
}

export function buildDistributionIndexes(
  ledger: Ledger,
  distribution: Distribution,
  currencyId: CurrencyId
): {
  payoutDistributions: PayoutDistributions,
  payoutAddressToId: PayoutAddressToId,
} {
  const payoutDistributionMap = new Map();
  const payoutAddressToId = new Map();
  const balances = getDistributionBalances(distribution);
  for (const [id, amount] of balances.entries()) {
    const {payoutAddresses, identity} = ledger.account(id);
    const address = payoutAddresses.get(currencyId);
    if (!address) continue;
    // need to allow for identities that have since been merged to still claim
    // funds if accounts are merged between a grain distribution and a
    // grainIntegration call.
    const total = NullUtil.orElse(payoutDistributionMap.get(address), G.ZERO);
    payoutDistributionMap.set(address, G.add(amount, total));
    payoutAddressToId.set(address, identity.id);
  }

  const payoutDistributions = Array.from(payoutDistributionMap.entries());

  return {payoutDistributions, payoutAddressToId};
}
