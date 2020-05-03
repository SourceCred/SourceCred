// @flow

import {NodeAddress} from "../core/graph";
import {ONE, ZERO, fromApproximateFloat, format} from "./grain";
import {
  GRAIN_ALLOCATION_VERSION_1,
  createGrainAllocation,
} from "./createGrainAllocation";
import deepFreeze from "deep-freeze";
import type {
  CredHistory,
  BalancedV1,
  ImmediateV1,
  GrainReceipt,
  AllocationStrategy,
  GrainAllocationV1,
} from "./createGrainAllocation";
import type {Grain} from "./grain";

describe("src/grain/createGrainAllocation", () => {
  const foo = NodeAddress.fromParts(["foo"]);
  const bar = NodeAddress.fromParts(["bar"]);

  const unevenInterval = deepFreeze({
    intervalEndMs: 10,
    cred: new Map([
      [foo, 9],
      [bar, 1],
    ]),
  });

  const evenInterval = deepFreeze({
    intervalEndMs: 20,
    cred: new Map([
      [foo, 1],
      [bar, 1],
    ]),
  });

  const singlePersonInterval = deepFreeze({
    intervalEndMs: 30,
    cred: new Map([[bar, 2]]),
  });

  const credHistory: CredHistory = deepFreeze([
    unevenInterval,
    evenInterval,
    singlePersonInterval,
  ]);

  // there's no JSON serialization for BigInts, so we need to convert
  // the BigInts before passing them into expect comparisons. Otherwise,
  // when the tests fail, they'll fail with an unhelpful JSON serialization
  // issue.
  function fmt(g: Grain) {
    return format(g, 3);
  }
  function safeReceipts(receipts: $ReadOnlyArray<GrainReceipt>) {
    return receipts.map(({address, amount}) => ({
      address,
      amount: fmt(amount),
    }));
  }
  function safeAllocation(allocation: GrainAllocationV1) {
    return {
      ...allocation,
      budget: fmt(allocation.budget),
      receipts: safeReceipts(allocation.receipts),
    };
  }
  function expectAllocationsEqual(h1, h2) {
    expect(safeAllocation(h1)).toEqual(safeAllocation(h2));
  }

  describe("immediateAllocation", () => {
    const BUDGET = ONE;
    const strategy: ImmediateV1 = deepFreeze({
      type: "IMMEDIATE",
      version: 1,
    });

    describe("it should return an empty createGrainAllocation when", () => {
      const emptyAllocation = deepFreeze({
        version: GRAIN_ALLOCATION_VERSION_1,
        strategy,
        budget: BUDGET,
        receipts: [],
      });

      it("the budget is zero", () => {
        const actual = createGrainAllocation(
          strategy,
          ZERO,
          credHistory,
          new Map()
        );

        expectAllocationsEqual(actual, {
          ...emptyAllocation,
          budget: ZERO,
        });
      });

      it("there are no cred scores at all", () => {
        const actual = createGrainAllocation(strategy, BUDGET, [], new Map());
        expectAllocationsEqual(actual, emptyAllocation);
      });

      it("all the cred sums to 0", () => {
        const actual = createGrainAllocation(
          strategy,
          BUDGET,
          [
            {
              intervalEndMs: 500,
              cred: new Map([
                [foo, 0],
                [bar, 0],
              ]),
            },
          ],
          new Map()
        );

        expectAllocationsEqual(actual, emptyAllocation);
      });
    });

    const createImmediateAllocation = (
      receipts: $ReadOnlyArray<GrainReceipt>
    ): GrainAllocationV1 => {
      return {
        version: GRAIN_ALLOCATION_VERSION_1,
        strategy,
        budget: BUDGET,
        receipts,
      };
    };

    it("throws an error if given an unsupported strategy", () => {
      const unsupportedStrategy = {
        ...strategy,
        version: 2,
      };
      expect(() =>
        createGrainAllocation(
          unsupportedStrategy,
          BUDGET,
          credHistory,
          new Map()
        )
      ).toThrowError(`Unsupported IMMEDIATE version: 2`);
    });

    it("throws an error if given an unsupported strategy and an empty credHistory", () => {
      const unsupportedStrategy = {
        ...strategy,
        version: 2,
      };
      expect(() =>
        createGrainAllocation(unsupportedStrategy, BUDGET, [], new Map())
      ).toThrowError(`Unsupported IMMEDIATE version: 2`);
    });

    it("handles an interval with even cred distribution", () => {
      const result = createGrainAllocation(
        strategy,
        BUDGET,
        [evenInterval],
        new Map()
      );
      // $ExpectFlowError
      const HALF = ONE / 2n;
      const expectedReceipts = [
        {address: foo, amount: HALF},
        {address: bar, amount: HALF},
      ];
      const expectedAllocation = createImmediateAllocation(expectedReceipts);
      expectAllocationsEqual(result, expectedAllocation);
    });
    it("handles an interval with un-even cred distribution", () => {
      const result = createGrainAllocation(
        strategy,
        BUDGET,
        [unevenInterval],
        new Map()
      );
      // $ExpectFlowError
      const ONE_TENTH = ONE / 10n;
      const NINE_TENTHS = ONE - ONE_TENTH;
      const expectedReceipts = [
        {address: foo, amount: NINE_TENTHS},
        {address: bar, amount: ONE_TENTH},
      ];
      const expectedAllocation = createImmediateAllocation(expectedReceipts);
      expectAllocationsEqual(result, expectedAllocation);
    });
    it("handles an interval with one cred recipient", () => {
      const result = createGrainAllocation(
        strategy,
        BUDGET,
        [singlePersonInterval],
        new Map()
      );
      const expectedReceipts = [{address: bar, amount: BUDGET}];
      const expectedAllocation = createImmediateAllocation(expectedReceipts);
      expectAllocationsEqual(result, expectedAllocation);
    });
  });

  describe("balancedAllocation", () => {
    const BUDGET = fromApproximateFloat(14);
    const strategy: BalancedV1 = deepFreeze({
      type: "BALANCED",
      version: 1,
    });

    const createBalancedAllocation = (
      receipts: $ReadOnlyArray<GrainReceipt>,
      budget: Grain
    ) => {
      return {
        version: GRAIN_ALLOCATION_VERSION_1,
        strategy,
        budget,
        receipts,
      };
    };

    describe("it should return an empty allocation when", () => {
      const emptyAllocation = deepFreeze({
        version: GRAIN_ALLOCATION_VERSION_1,
        receipts: [],
        budget: BUDGET,
        strategy,
      });

      it("the budget is zero", () => {
        const actual = createGrainAllocation(
          strategy,
          ZERO,
          credHistory,
          new Map()
        );

        expectAllocationsEqual(actual, {
          ...emptyAllocation,
          budget: ZERO,
        });
      });

      it("there are no cred scores at all", () => {
        const actual = createGrainAllocation(strategy, BUDGET, [], new Map());

        expectAllocationsEqual(actual, emptyAllocation);
      });

      it("all the cred sums to 0", () => {
        const actual = createGrainAllocation(
          strategy,
          BUDGET,
          [
            {
              intervalEndMs: 500,
              cred: new Map([
                [foo, 0],
                [bar, 0],
              ]),
            },
          ],
          new Map()
        );

        expectAllocationsEqual(actual, emptyAllocation);
      });
    });

    it("throws an error if given an unsupported strategy", () => {
      const unsupportedStrategy = {
        ...strategy,
        version: 2,
      };
      expect(() =>
        createGrainAllocation(
          unsupportedStrategy,
          BUDGET,
          credHistory,
          new Map()
        )
      ).toThrowError(`Unsupported BALANCED version: 2`);
    });

    it("should only pay Foo if Foo is sufficiently underpaid", () => {
      const lifetimeEarnings = new Map([
        [foo, ZERO],
        [bar, fromApproximateFloat(99)],
      ]);
      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(14)},
      ];
      const expectedAllocation = createBalancedAllocation(
        expectedReceipts,
        BUDGET
      );
      const actual = createGrainAllocation(
        strategy,
        BUDGET,
        credHistory,
        lifetimeEarnings
      );
      expectAllocationsEqual(expectedAllocation, actual);
    });
    it("should divide according to cred if everyone is already balanced paid", () => {
      const lifetimeEarnings = new Map([
        [foo, fromApproximateFloat(5)],
        [bar, fromApproximateFloat(2)],
      ]);

      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(10)},
        {address: bar, amount: fromApproximateFloat(4)},
      ];

      const expectedAllocation = createBalancedAllocation(
        expectedReceipts,
        BUDGET
      );

      const actual = createGrainAllocation(
        strategy,
        BUDGET,
        credHistory,
        lifetimeEarnings
      );
      expectAllocationsEqual(expectedAllocation, actual);
    });
    it("'top off' users who were slightly underpaid'", () => {
      // Foo is exactly 1 grain behind where they "should" be
      const lifetimeEarnings = new Map([
        [foo, fromApproximateFloat(4)],
        [bar, fromApproximateFloat(2)],
      ]);

      const BUDGET15 = fromApproximateFloat(15);

      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(11)},
        {address: bar, amount: fromApproximateFloat(4)},
      ];

      const expectedAllocation = createBalancedAllocation(
        expectedReceipts,
        BUDGET15
      );

      const actual = createGrainAllocation(
        strategy,
        BUDGET15,
        credHistory,
        lifetimeEarnings
      );
      expectAllocationsEqual(expectedAllocation, actual);
    });

    it("should handle the case where one user has no historical earnings", () => {
      const lifetimeEarnings = new Map([[foo, fromApproximateFloat(5)]]);

      const expectedReceipts = [
        {address: bar, amount: fromApproximateFloat(2)},
      ];
      const BUDGET2 = fromApproximateFloat(2);

      const expectedAllocation = createBalancedAllocation(
        expectedReceipts,
        BUDGET2
      );

      const actual = createGrainAllocation(
        strategy,
        BUDGET2,
        credHistory,
        lifetimeEarnings
      );
      expectAllocationsEqual(expectedAllocation, actual);
    });
    it("should not break if a user has earnings but no cred", () => {
      const lifetimeEarnings = new Map([
        [NodeAddress.fromParts(["zoink"]), fromApproximateFloat(10)],
      ]);

      const expectedReceipts = [
        {address: foo, amount: fromApproximateFloat(10)},
        {address: bar, amount: fromApproximateFloat(4)},
      ];

      const expectedAllocation = createBalancedAllocation(
        expectedReceipts,
        BUDGET
      );

      const actual = createGrainAllocation(
        strategy,
        BUDGET,
        credHistory,
        lifetimeEarnings
      );
      expectAllocationsEqual(expectedAllocation, actual);
    });
  });
});
