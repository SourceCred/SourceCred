// @flow

import {_allocationIdentities} from "./computeDistribution";
import * as GraphUtil from "../credrank/testUtils";
import {createTestLedgerFixture} from "../ledger/testUtils";
import {CredGrainView} from "../credGrainView";
import {g, nng} from "../ledger/testUtils";
import * as uuid from "../../util/uuid";

describe("core/ledger/computeDistribution", () => {
  describe("_allocationIdentities", () => {
    let credGraph;
    beforeEach(async (done) => {
      credGraph = await GraphUtil.credGraph();
      done();
    });

    it("does not include unassigned aliases", () => {
      const {ledgerWithSingleIdentity} = createTestLedgerFixture();
      const idActive = GraphUtil.participant1.id;

      /* The GraphUtil will create 2 participants, but we're only going to include
        1 in the ledger. If things are working properly, we should not see data
        for the second participant in the CredGrainView. */

      const allocationId1 = uuid.random();
      const allocation1 = {
        policy: {
          policyType: "IMMEDIATE",
          budget: nng("3"),
          numIntervalsLookback: 1,
        },
        id: allocationId1,
        receipts: [{amount: g("3"), id: GraphUtil.participant1.id}],
      };
      const distribution1 = {
        credTimestamp: 1,
        allocations: [allocation1],
        id: uuid.random(),
      };

      const ledger = ledgerWithSingleIdentity(idActive);
      ledger.activate(idActive);
      ledger.distributeGrain(distribution1);

      const credGrainData = CredGrainView.fromCredGraphAndLedger(
        credGraph,
        ledger
      );

      const expectedAllocationIdentites = [
        {
          id: idActive,
          cred: GraphUtil.expectedParticipant1.credPerInterval,
          paid: "3",
        },
      ];

      expect(_allocationIdentities(credGrainData, 999)).toEqual(
        expectedAllocationIdentites
      );
    });
    it("does not include inactive accounts", () => {
      const {ledgerWithIdentities} = createTestLedgerFixture();
      const idActive = GraphUtil.participant1.id;
      const idInactive = GraphUtil.participant2.id;

      /* The GraphUtil will create 2 participants, but we're only going to activate
        1 in the ledger. If things are working properly, we should not see data
        for the second participant in the allocationIdentities. */

      const allocationId1 = uuid.random();
      const allocation1 = {
        policy: {
          policyType: "IMMEDIATE",
          budget: nng("5"),
          numIntervalsLookback: 1,
        },
        id: allocationId1,
        receipts: [{amount: g("2"), id: GraphUtil.participant1.id}],
      };
      const distribution1 = {
        credTimestamp: 1,
        allocations: [allocation1],
        id: uuid.random(),
      };

      const ledger = ledgerWithIdentities(idActive, idInactive);
      ledger.activate(idActive);
      ledger.distributeGrain(distribution1);

      const credGrainData = CredGrainView.fromCredGraphAndLedger(
        credGraph,
        ledger
      );

      const expectedAllocationIdentites = [
        {
          id: idActive,
          cred: GraphUtil.expectedParticipant1.credPerInterval,
          paid: "2",
        },
      ];
      expect(_allocationIdentities(credGrainData, 999)).toEqual(
        expectedAllocationIdentites
      );
    });
    it("time slices the cred as expected", () => {
      const {ledgerWithIdentities} = createTestLedgerFixture();
      const idActive = GraphUtil.participant1.id;
      const idInactive = GraphUtil.participant2.id;

      /* The GraphUtil will create 2 participants, but we're only going to activate
        1 in the ledger. If things are working properly, we should not see data
        for the second participant in the allocationIdentities. */

      const allocationId1 = uuid.random();
      const allocation1 = {
        policy: {
          policyType: "IMMEDIATE",
          budget: nng("9"),
          numIntervalsLookback: 1,
        },
        id: allocationId1,
        receipts: [{amount: g("4"), id: GraphUtil.participant1.id}],
      };
      const distribution1 = {
        credTimestamp: 1,
        allocations: [allocation1],
        id: uuid.random(),
      };

      const ledger = ledgerWithIdentities(idActive, idInactive);
      ledger.activate(idActive);
      ledger.distributeGrain(distribution1);

      const credGrainData = CredGrainView.fromCredGraphAndLedger(
        credGraph,
        ledger
      );

      //Should only have one value in the cred array
      const expectedAllocationIdentites = [
        {
          id: idActive,
          cred: [GraphUtil.expectedParticipant1.credPerInterval[0]],
          paid: "4",
        },
      ];
      expect(
        _allocationIdentities(credGrainData, GraphUtil.intervals[0].endTimeMs)
      ).toEqual(expectedAllocationIdentites);
    });
  });
});
