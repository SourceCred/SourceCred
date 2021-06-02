// @flow

const payoutDistributionToCsv = require("./distributionToCsv");
// TODO (@topocount) enable cross-package Flow type and interface imports from
// packages/sourcecred. This does NOT mean we should import functions from
// packages/sourcecred though, since that'll create a circular depedency.
// Code we want to import from core needs to be split out into it's own
// package first.
const csvIntegration /*: any */ = (payoutDistributions, _unused_config) => {
  const csvString = payoutDistributionToCsv(payoutDistributions);

  const timestamp = Date.now();

  return {
    transferredGrain: [],
    outputFile: {
      // The timestamp suffix is used to enforce uniqueness of filenames
      // Human-readable dates will be prefixed in SourceCred Core
      fileName: `Payouts-${timestamp}.csv`,
      content: csvString,
    },
  };
};

module.exports = { csvIntegration };
