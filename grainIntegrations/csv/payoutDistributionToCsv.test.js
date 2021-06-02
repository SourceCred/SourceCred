// @flow
const payoutDistributionToCsv = require("./distributionToCsv");
describe("payoutDistributionToCsv", () => {
  it("serializes entries into a csv", () => {
    const mockDistributions = [
      ["abc", "123"],
      ["def", "456"],
    ];
    const result = payoutDistributionToCsv(mockDistributions);
    expect(result).toBe(`abc,123\ndef,456\n`);
  });
  it("returns an empty string when receiving an empty array", () => {
    const result = payoutDistributionToCsv([]);
    expect(result).toBe("");
  });
});
