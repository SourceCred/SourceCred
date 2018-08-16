// @flow

import {NodeAddress} from "../../core/graph";
import * as GN from "./nodes";
import {fromRaw, toRaw} from "./nodes";

describe("plugins/git/nodes", () => {
  const examples = {
    commit: (): GN.CommitAddress => ({
      type: GN.COMMIT_TYPE,
      hash: "3715ddfb8d4c4fd2a6f6af75488c82f84c92ec2f",
    }),
  };

  describe("`fromRaw` after `toRaw` is identity", () => {
    Object.keys(examples).forEach((example) => {
      it(example, () => {
        const instance = examples[example]();
        expect(fromRaw(toRaw(instance))).toEqual(instance);
      });
    });
  });

  describe("`toRaw` after `fromRaw` is identity", () => {
    Object.keys(examples).forEach((example) => {
      it(example, () => {
        const instance = examples[example]();
        const raw = toRaw(instance);
        expect(toRaw(fromRaw(raw))).toEqual(raw);
      });
    });
  });

  describe("snapshots as expected:", () => {
    Object.keys(examples).forEach((example) => {
      it(example, () => {
        const instance = examples[example]();
        const raw = NodeAddress.toParts(toRaw(instance));
        expect({address: raw, structured: instance}).toMatchSnapshot();
      });
    });
  });

  describe("errors on", () => {
    describe("fromRaw(...) with", () => {
      function expectBadAddress(name: string, parts: $ReadOnlyArray<string>) {
        it(name, () => {
          const address = GN._gitAddress(...parts);
          expect(() => fromRaw(address)).toThrow("Bad address");
        });
      }
      it("undefined", () => {
        // $ExpectFlowError
        expect(() => fromRaw(undefined)).toThrow("undefined");
      });
      it("null", () => {
        // $ExpectFlowError
        expect(() => fromRaw(null)).toThrow("null");
      });
      it("bad prefix", () => {
        // $ExpectFlowError
        expect(() => fromRaw(NodeAddress.fromParts(["foo"]))).toThrow(
          "Bad address"
        );
      });

      expectBadAddress("no type", []);
      expectBadAddress("bad type", ["wat"]);

      expectBadAddress("commit with no hash", [GN.COMMIT_TYPE]);
      expectBadAddress("commit with extra field", [
        GN.COMMIT_TYPE,
        examples.commit().hash,
        examples.commit().hash,
      ]);
    });

    describe("toRaw(...) with", () => {
      it("null", () => {
        // $ExpectFlowError
        expect(() => toRaw(null)).toThrow("null");
      });
      it("undefined", () => {
        // $ExpectFlowError
        expect(() => toRaw(undefined)).toThrow("undefined");
      });
      it("bad type", () => {
        // $ExpectFlowError
        expect(() => toRaw({type: "ICE_CREAM"})).toThrow("Unexpected type");
      });
    });
  });
});
