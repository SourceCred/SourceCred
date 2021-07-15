// @flow

import cloneDeep from "lodash.clonedeep";
import {Ledger} from "./ledger";
import {newIdentity, type Identity, type IdentityId} from "../identity";
import * as G from "./grain";
import {
  type NonnegativeGrain,
  fromString as toNonnegativeGrain,
} from "./nonnegativeGrain";
import * as uuid from "../../util/uuid";

export interface UuidMock {
  resetFakeUuid(): void;
  setNextUuid(id: uuid.Uuid): void;
}

export interface DateMock {
  resetFakeDate(): void;
  setFakeDate(id: number): void;
}

export interface LedgerMock {
  identity1(id?: IdentityId): Identity;
  identity2(id?: IdentityId): Identity;
  ledgerWithIdentities(firstId?: IdentityId, secondId?: IdentityId): Ledger;
  ledgerWithSingleIdentity(Id?: IdentityId): Ledger;
  ledgerWithActiveIdentities(
    firstId?: IdentityId,
    secondId?: IdentityId
  ): Ledger;
}

export const createUuidMock = (): UuidMock => {
  const randomMock = jest.spyOn(uuid, "random");

  let nextFakeUuidIndex = 0;

  function resetFakeUuid() {
    nextFakeUuidIndex = 0;
  }

  function setNextUuid(x: uuid.Uuid) {
    randomMock.mockImplementationOnce(() => x);
  }

  function nextFakeUuid(): uuid.Uuid {
    const uuidString = String(nextFakeUuidIndex).padStart(21, "0") + "A";
    nextFakeUuidIndex++;
    return uuid.fromString(uuidString);
  }

  randomMock.mockImplementation(nextFakeUuid);
  return {resetFakeUuid, setNextUuid};
};

export const createDateMock = (): DateMock => {
  let nextFakeDate = 0;

  function resetFakeDate() {
    nextFakeDate = 0;
  }
  function setFakeDate(ts: number) {
    // Use this when you want specific timestamps, rather than just
    // auto-incrementing
    jest.spyOn(global.Date, "now").mockImplementationOnce(() => ts);
  }
  jest.spyOn(global.Date, "now").mockImplementation(() => nextFakeDate++);

  return {setFakeDate, resetFakeDate};
};

export const createTestLedgerFixture = (
  uuidMock: UuidMock = createUuidMock(),
  dateMock: DateMock = createDateMock()
): LedgerMock => {
  const identity1 = (id?: IdentityId = id1): Identity => {
    uuidMock.setNextUuid(id);
    return newIdentity("USER", "steven");
  };
  const identity2 = (id?: IdentityId = id2): Identity => {
    uuidMock.setNextUuid(id);
    return newIdentity("ORGANIZATION", "crystal-gems");
  };

  const ledgerWithIdentities = (
    firstId: IdentityId = id1,
    secondId: IdentityId = id2
  ): Ledger => {
    uuidMock.resetFakeUuid();
    dateMock.resetFakeDate();
    const ledger = new Ledger();
    uuidMock.setNextUuid(firstId);
    ledger.createIdentity("USER", "steven");
    uuidMock.setNextUuid(secondId);
    ledger.createIdentity("ORGANIZATION", "crystal-gems");
    return ledger;
  };

  const ledgerWithSingleIdentity = (firstId: IdentityId = id1): Ledger => {
    uuidMock.resetFakeUuid();
    dateMock.resetFakeDate();
    const ledger = new Ledger();
    uuidMock.setNextUuid(firstId);
    ledger.createIdentity("USER", "steven");
    return ledger;
  };

  const ledgerWithActiveIdentities = (
    firstId: IdentityId = id1,
    secondId: IdentityId = id2
  ): Ledger => {
    const ledger = ledgerWithIdentities();
    ledger.activate(firstId);
    ledger.activate(secondId);
    return ledger;
  };

  return {
    identity1,
    identity2,
    ledgerWithIdentities,
    ledgerWithActiveIdentities,
    ledgerWithSingleIdentity,
  };
};

// Helper for constructing Grain values.
export const g = (s: string): G.Grain => G.fromString(s);

// Helper for constructing NonnegativeGrain values.
export const nng = (s: string): NonnegativeGrain => toNonnegativeGrain(s);

export const id1: IdentityId = uuid.fromString("YVZhbGlkVXVpZEF0TGFzdA");
export const id2: IdentityId = uuid.fromString("URgLrCxgvjHxtGJ9PgmckQ");
export const id3: IdentityId = uuid.fromString("EpbMqV0HmcolKvpXTwSddA");

// Verify that a method fails, throwing an error, without mutating the ledger.
export function failsWithoutMutation(
  ledger: Ledger,
  operation: (Ledger) => any,
  message: string
) {
  const copy = cloneDeep(ledger);
  expect(() => operation(ledger)).toThrow(message);
  expect(copy).toEqual(ledger);
}
