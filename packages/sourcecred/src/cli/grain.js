// @flow

import dedent from "../util/dedent";
import type {Command} from "./command";
import {distributionMarkdownSummary} from "../core/ledger/distributionSummary/distributionSummary";
import {allocationMarkdownSummary} from "../core/ledger/distributionSummary/allocationSummary";
import * as G from "../core/ledger/grain";
import {Instance} from "../api/instance/instance";
import {LocalInstance} from "../api/instance/localInstance";
import {grain} from "../api/main/grain";
import {executeGrainIntegration} from "../core/ledger/grainIntegration";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const grainCommand: Command = async (args, std) => {
  let simulation = false;
  let allowMultipleDistributionsPerInterval = false;
  const processedArgs = args.filter((arg) => {
    switch (arg) {
      case "-f":
      case "--force":
        allowMultipleDistributionsPerInterval = true;
        return false;
      case "-s":
      case "--simulation":
        simulation = true;
        return false;
      default:
        return true;
    }
  });
  if (processedArgs.length) {
    return die(
      std,
      "usage: sourcecred grain [--simulation | -s] [--force | -f]"
    );
  }

  const baseDir = process.cwd();
  const instance: Instance = new LocalInstance(baseDir);
  const grainInput = await instance.readGrainInput();
  grainInput.allowMultipleDistributionsPerInterval = allowMultipleDistributionsPerInterval;

  const {distributions, ledger} = await grain(grainInput);

  const integrationCurrency = grainInput.currencyDetails.integrationCurrency;
  const grainIntegration = grainInput.grainConfig.integration;
  if (integrationCurrency && grainIntegration) {
    distributions.forEach((distribution) => {
      const result = executeGrainIntegration(
        ledger,
        grainIntegration.function,
        distribution,
        integrationCurrency,
        false
      );
      if (result.grainIntegrationOutput)
        instance.writeGrainIntegrationOutput(
          result.grainIntegrationOutput,
          distribution
        );
    });
  }

  let totalDistributed = G.ZERO;
  const recipientIdentities = new Set();
  for (const {allocations} of distributions) {
    for (const {receipts} of allocations) {
      for (const {amount, id} of receipts) {
        totalDistributed = G.add(amount, totalDistributed);
        recipientIdentities.add(id);
      }
    }
  }

  std.out(
    (simulation ? `——SIMULATED DISTRIBUTION——\n` : ``) +
      `Distributed ${G.format(totalDistributed)} to ${
        recipientIdentities.size
      } identities in ${distributions.length} distributions` +
      `\n`
  );

  distributions.map((d) => {
    std.out(distributionMarkdownSummary(d, ledger, grainInput.currencyDetails));
    d.allocations.map((a) => {
      std.out(allocationMarkdownSummary(d, a, ledger));
    });
  });

  if (!simulation) {
    instance.writeLedger(ledger);
  }

  return 0;
};

export const grainHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred grain [--simulation | -s] [--force | -f]

      Distribute Grain (or whatever currency this Cred instance is tracking)
      for Cred intervals in which Grain was not already distributed.

      When the '--simulation' (-s) flag is provided, no grain will actually be distributed,
      allowing for testing the output of various configurations.

      When the '--force' (-f) flag is provided, it will overwrite the last distribution
      if a distribution already exists for the past interval.

      When run, this will identify all the completed Cred intervals (currently, weeks)
      and find the latest Cred interval for which there was no Grain distribution.
      Then, it will distribute Grain for all of them, making a corresponding change
      to the Ledger. This could result in zero or more distributions, depending on how
      many recent Cred intervals had no corresponding Grain distribution.

      Grain is distributed based on the configuration in the config/grain.json
      file. The fields are as follows:

      immediatePerWeek: The amount of grain to distribute for activity in the most
      recent period. (value type: integer)

      balancedPerWeek: The amount of grain to distribute according to all-time cred
      scores. (value type: integer)

      maxSimultaneousDistributions: The maximum number of distributions to create in
      a single 'sourcecred grain' call if distributions have been missed. If set to
      1, then the command will create at most one distribution. If unset, defaults
      to Infinity.
      (value type: integer)
      `.trimRight()
  );
  return 0;
};

export default grainCommand;
