// @flow

import {bundledGrainIntegrations} from "./bundledGrainIntegrations";
import {csvIntegration} from "sc-grainIntegration-csv";
describe("api/bundledGrainIntegrations", () => {
  it("returns the csv parser", () => {
    const result = bundledGrainIntegrations("csv");
    expect(result).toBe(csvIntegration);
  });
  it("errors if integration lookup fails", () => {
    const thunk = () => bundledGrainIntegrations("badKey");
    expect(thunk).toThrow("grain integration not found");
  });
});
