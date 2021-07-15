// @flow

import {CredGrainView} from "./credGrainView";
import * as GraphUtil from "./credrank/testUtils";
import {createTestLedgerFixture} from "./ledger/testUtils";
import {g, nng} from "./ledger/testUtils";
import {Ledger} from "./ledger/ledger";
import * as uuid from "../util/uuid";

describe("core/credGrainView", () => {
  const {
    identity1,
    identity2,
    ledgerWithActiveIdentities,
  } = createTestLedgerFixture();
  const allocationId1 = uuid.random();
  const allocationId2 = uuid.random();

  describe("when two identities have grain across two intervals", () => {
    let credGraph;
    let ledger;
    let credGrainView;
    const id1 = GraphUtil.participant1.id;
    const id2 = GraphUtil.participant2.id;
    const allocation1 = {
      policy: {
        policyType: "IMMEDIATE",
        budget: nng("10"),
        numIntervalsLookback: 1,
      },
      id: allocationId1,
      receipts: [
        {amount: g("3"), id: id1},
        {amount: g("7"), id: id2},
      ],
    };
    const allocation2 = {
      id: allocationId2,
      policy: {policyType: "BALANCED", budget: nng("20")},
      receipts: [
        {amount: g("10"), id: id1},
        {amount: g("10"), id: id2},
      ],
    };
    const distribution1 = {
      credTimestamp: 1,
      allocations: [allocation1, allocation2],
      id: uuid.random(),
    };
    const distribution2 = {
      credTimestamp: 3,
      allocations: [allocation2],
      id: uuid.random(),
    };

    beforeEach(async (done) => {
      credGraph = await GraphUtil.credGraph();
      ledger = ledgerWithActiveIdentities(id1, id2);
      ledger.distributeGrain(distribution1);
      ledger.distributeGrain(distribution2);
      credGrainView = CredGrainView.fromCredGraphAndLedger(credGraph, ledger);
      done();
    });

    it("does a JSON round trip", () => {
      expect(CredGrainView.fromJSON(credGrainView.toJSON())).toEqual(
        credGrainView
      );
    });

    it("should have participant data for all intervals", () => {
      const expectedIntervals = GraphUtil.intervals;
      const expectedParticipants = [
        {
          active: true,
          identity: identity1(id1),
          cred: GraphUtil.expectedParticipant1.cred,
          credPerInterval: GraphUtil.expectedParticipant1.credPerInterval,
          grainEarned: g("23"),
          grainEarnedPerInterval: [g("13"), g("10")],
        },
        {
          active: true,
          identity: identity2(id2),
          cred: GraphUtil.expectedParticipant2.cred,
          credPerInterval: GraphUtil.expectedParticipant2.credPerInterval,
          grainEarned: g("27"),
          grainEarnedPerInterval: [g("17"), g("10")],
        },
      ];

      expect(credGrainView.intervals()).toEqual(expectedIntervals);
      expect(credGrainView.participants()).toEqual(expectedParticipants);
    });

    it("should have correct aggregates", () => {
      expect(credGrainView.totalGrainPerInterval()).toEqual([g("30"), g("20")]);
      // cred is not easily tested because of expectedParticipant2's cred is
      // so small that it is lost to imprecision during addition.
    });

    describe("when time scoped to exactly the last interval", () => {
      it("should have participant and aggregate data for the last interval", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          GraphUtil.intervals[GraphUtil.intervals.length - 1].startTimeMs,
          GraphUtil.intervals[GraphUtil.intervals.length - 1].endTimeMs
        );
        const expectedIntervals = [
          GraphUtil.intervals[GraphUtil.intervals.length - 1],
        ];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: GraphUtil.expectedParticipant1.credPerInterval[1],
            credPerInterval: [
              GraphUtil.expectedParticipant1.credPerInterval[1],
            ],
            grainEarned: g("10"),
            grainEarnedPerInterval: [g("10")],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: GraphUtil.expectedParticipant2.credPerInterval[1],
            credPerInterval: [
              GraphUtil.expectedParticipant2.credPerInterval[1],
            ],
            grainEarned: g("10"),
            grainEarnedPerInterval: [g("10")],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
        expect(timeScopedCredGrainView.totalGrainPerInterval()).toEqual([
          g("20"),
        ]);
      });
    });

    describe("when time scoped to exactly the first interval", () => {
      it("should have participant and aggregate data for the first interval", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          GraphUtil.intervals[0].startTimeMs,
          GraphUtil.intervals[0].endTimeMs
        );
        const expectedIntervals = [GraphUtil.intervals[0]];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: GraphUtil.expectedParticipant1.credPerInterval[0],
            credPerInterval: [
              GraphUtil.expectedParticipant1.credPerInterval[0],
            ],
            grainEarned: g("13"),
            grainEarnedPerInterval: [g("13")],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: GraphUtil.expectedParticipant2.credPerInterval[0],
            credPerInterval: [
              GraphUtil.expectedParticipant2.credPerInterval[0],
            ],
            grainEarned: g("17"),
            grainEarnedPerInterval: [g("17")],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
        expect(timeScopedCredGrainView.totalGrainPerInterval()).toEqual([
          g("30"),
        ]);
      });
    });

    describe("when time scoped around the first interval", () => {
      it("should have participant data for the first interval", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          GraphUtil.intervals[0].startTimeMs - 1,
          GraphUtil.intervals[0].endTimeMs + 1
        );
        const expectedIntervals = [GraphUtil.intervals[0]];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: GraphUtil.expectedParticipant1.credPerInterval[0],
            credPerInterval: [
              GraphUtil.expectedParticipant1.credPerInterval[0],
            ],
            grainEarned: g("13"),
            grainEarnedPerInterval: [g("13")],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: GraphUtil.expectedParticipant2.credPerInterval[0],
            credPerInterval: [
              GraphUtil.expectedParticipant2.credPerInterval[0],
            ],
            grainEarned: g("17"),
            grainEarnedPerInterval: [g("17")],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
      });
    });

    describe("when time scoped after all intervals", () => {
      it("should have participant data for no intervals", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          9999,
          99999
        );
        const expectedIntervals = [];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: 0,
            credPerInterval: [],
            grainEarned: g("0"),
            grainEarnedPerInterval: [],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: 0,
            credPerInterval: [],
            grainEarned: g("0"),
            grainEarnedPerInterval: [],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
      });
    });

    describe("when time scoped for the partial beginning of an interval", () => {
      it("should have participant data for no intervals", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          GraphUtil.intervals[0].startTimeMs,
          GraphUtil.intervals[0].startTimeMs + 1
        );
        const expectedIntervals = [];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: 0,
            credPerInterval: [],
            grainEarned: g("0"),
            grainEarnedPerInterval: [],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: 0,
            credPerInterval: [],
            grainEarned: g("0"),
            grainEarnedPerInterval: [],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
      });
    });

    describe("when time scoped for the partial end of an interval", () => {
      it("should have participant data for no intervals", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          GraphUtil.intervals[0].startTimeMs + 1,
          GraphUtil.intervals[0].endTimeMs
        );
        const expectedIntervals = [];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: 0,
            credPerInterval: [],
            grainEarned: g("0"),
            grainEarnedPerInterval: [],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: 0,
            credPerInterval: [],
            grainEarned: g("0"),
            grainEarnedPerInterval: [],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
      });
    });
  });

  describe("when two identities have grain in only the first interval", () => {
    let credGraph;
    let ledger;
    let credGrainView;
    const id1 = GraphUtil.participant1.id;
    const id2 = GraphUtil.participant2.id;
    const allocation1 = {
      policy: {
        policyType: "IMMEDIATE",
        budget: nng("10"),
        numIntervalsLookback: 1,
      },
      id: allocationId1,
      receipts: [
        {amount: g("3"), id: id1},
        {amount: g("7"), id: id2},
      ],
    };
    const distribution1 = {
      credTimestamp: 1,
      allocations: [allocation1],
      id: uuid.random(),
    };

    beforeEach(async (done) => {
      credGraph = await GraphUtil.credGraph();
      ledger = ledgerWithActiveIdentities(id1, id2);
      ledger.distributeGrain(distribution1);
      credGrainView = CredGrainView.fromCredGraphAndLedger(credGraph, ledger);
      done();
    });

    it("should have correct participant data for all intervals", () => {
      const expectedIntervals = GraphUtil.intervals;
      const expectedParticipants = [
        {
          active: true,
          identity: identity1(id1),
          cred: GraphUtil.expectedParticipant1.cred,
          credPerInterval: GraphUtil.expectedParticipant1.credPerInterval,
          grainEarned: g("3"),
          grainEarnedPerInterval: [g("3"), g("0")],
        },
        {
          active: true,
          identity: identity2(id2),
          cred: GraphUtil.expectedParticipant2.cred,
          credPerInterval: GraphUtil.expectedParticipant2.credPerInterval,
          grainEarned: g("7"),
          grainEarnedPerInterval: [g("7"), g("0")],
        },
      ];

      expect(credGrainView.intervals()).toEqual(expectedIntervals);
      expect(credGrainView.participants()).toEqual(expectedParticipants);
    });

    describe("when time scoped to exactly the last interval", () => {
      it("should have participant data for the last interval", () => {
        const timeScopedCredGrainView = credGrainView.withTimeScope(
          GraphUtil.intervals[GraphUtil.intervals.length - 1].startTimeMs,
          GraphUtil.intervals[GraphUtil.intervals.length - 1].endTimeMs
        );
        const expectedIntervals = [
          GraphUtil.intervals[GraphUtil.intervals.length - 1],
        ];
        const expectedParticipants = [
          {
            active: true,
            identity: identity1(id1),
            cred: GraphUtil.expectedParticipant1.credPerInterval[1],
            credPerInterval: [
              GraphUtil.expectedParticipant1.credPerInterval[1],
            ],
            grainEarned: g("0"),
            grainEarnedPerInterval: [g("0")],
          },
          {
            active: true,
            identity: identity2(id2),
            cred: GraphUtil.expectedParticipant2.credPerInterval[1],
            credPerInterval: [
              GraphUtil.expectedParticipant2.credPerInterval[1],
            ],
            grainEarned: g("0"),
            grainEarnedPerInterval: [g("0")],
          },
        ];

        expect(timeScopedCredGrainView.intervals()).toEqual(expectedIntervals);
        expect(timeScopedCredGrainView.participants()).toEqual(
          expectedParticipants
        );
      });
    });
  });

  describe("when two identities have no grain distribution", () => {
    let credGraph;
    let ledger;
    let credGrainView;
    const id1 = GraphUtil.participant1.id;
    const id2 = GraphUtil.participant2.id;

    beforeEach(async (done) => {
      credGraph = await GraphUtil.credGraph();
      ledger = ledgerWithActiveIdentities(id1, id2);
      credGrainView = CredGrainView.fromCredGraphAndLedger(credGraph, ledger);
      done();
    });

    it("should have correct participant data for all intervals", () => {
      const expectedIntervals = GraphUtil.intervals;
      const expectedParticipants = [
        {
          active: true,
          identity: identity1(id1),
          cred: GraphUtil.expectedParticipant1.cred,
          credPerInterval: GraphUtil.expectedParticipant1.credPerInterval,
          grainEarned: g("0"),
          grainEarnedPerInterval: [g("0"), g("0")],
        },
        {
          active: true,
          identity: identity2(id2),
          cred: GraphUtil.expectedParticipant2.cred,
          credPerInterval: GraphUtil.expectedParticipant2.credPerInterval,
          grainEarned: g("0"),
          grainEarnedPerInterval: [g("0"), g("0")],
        },
      ];

      expect(credGrainView.intervals()).toEqual(expectedIntervals);
      expect(credGrainView.participants()).toEqual(expectedParticipants);
    });
  });

  describe("when the graph has participants but the ledger has no accounts", () => {
    let credGraph;
    let ledger;
    let credGrainView;

    beforeEach(async (done) => {
      credGraph = await GraphUtil.credGraph();
      ledger = new Ledger();
      credGrainView = CredGrainView.fromCredGraphAndLedger(credGraph, ledger);
      done();
    });

    it("should have no CredGrainView participants", () => {
      const expectedIntervals = GraphUtil.intervals;
      const expectedParticipants = [];

      expect(credGrainView.intervals()).toEqual(expectedIntervals);
      expect(credGrainView.participants()).toEqual(expectedParticipants);
    });
  });

  describe("when the ledger has an account that the graph does not have", () => {
    let credGraph;
    let ledger;
    const id1 = GraphUtil.participant1.id;
    const id2 = GraphUtil.participant2.id;

    beforeEach(async (done) => {
      credGraph = await GraphUtil.credGraph();
      ledger = ledgerWithActiveIdentities(id1, id2);
      ledger.createIdentity("USER", "credless");
      done();
    });

    it("should throw", () => {
      expect(() =>
        CredGrainView.fromCredGraphAndLedger(credGraph, ledger)
      ).toThrow("The graph is missing account");
    });
  });
});
