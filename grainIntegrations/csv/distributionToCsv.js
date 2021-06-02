// @flow

/*:: type PayoutDistributions = $ReadOnlyArray<[string, string]>;*/
module.exports = function payoutDistributionToCsv(
  payoutDistributions /*: PayoutDistributions*/
) /*: string*/ {
  let csvString = "";
  for (const [payoutAddress, amount] of payoutDistributions) {
    csvString += `${payoutAddress},${amount}\n`;
  }
  return csvString;
};
