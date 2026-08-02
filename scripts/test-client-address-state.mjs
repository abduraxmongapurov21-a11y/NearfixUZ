import assert from "node:assert/strict";
import {
  reconcileCatalogAddressState,
  replaceOptimisticAddress,
  replaceUpdatedAddress
} from "../src/store/clientAddressState.mjs";
import { createAccountRequestGuard } from "../src/store/requestGeneration.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function accountSwitchScenario() {
  const guard = createAccountRequestGuard();
  let currentAccountId = "account-a";
  let state = { savedAddresses: [], catalogOriginAddressId: null, catalogSort: "recommended" };
  const accountA = deferred();
  const accountB = deferred();

  const apply = async (ticket, pending) => {
    const addresses = await pending.promise;
    if (guard.isCurrent(ticket, currentAccountId)) {
      state = { ...state, ...reconcileCatalogAddressState(state, addresses) };
    }
  };

  const aTicket = guard.begin("addresses", currentAccountId);
  const aRequest = apply(aTicket, accountA);
  guard.invalidateSession();
  currentAccountId = "account-b";
  const bTicket = guard.begin("addresses", currentAccountId);
  const bRequest = apply(bTicket, accountB);
  accountB.resolve([{ id: "b-home", isDefault: true, lat: 41.31, lng: 69.24 }]);
  await bRequest;
  accountA.resolve([{ id: "a-home", isDefault: true, lat: 41.32, lng: 69.25 }]);
  await aRequest;

  assert.deepEqual(state, {
    savedAddresses: [{ id: "b-home", isDefault: true, lat: 41.31, lng: 69.24 }],
    catalogOriginAddressId: "b-home",
    catalogSort: "recommended"
  });
}

async function sameAccountOutOfOrderScenario() {
  const guard = createAccountRequestGuard();
  const accountId = "account-a";
  let value = null;
  const older = deferred();
  const newer = deferred();
  const apply = async (ticket, pending) => {
    const response = await pending.promise;
    if (guard.isCurrent(ticket, accountId)) value = response;
  };

  const olderRequest = apply(guard.begin("addresses", accountId), older);
  const newerRequest = apply(guard.begin("addresses", accountId), newer);
  newer.resolve("newer");
  await newerRequest;
  older.resolve("older");
  await olderRequest;
  assert.equal(value, "newer");
}

await accountSwitchScenario();
await sameAccountOutOfOrderScenario();

const oldAddresses = [{ id: "old-default", isDefault: true }];
const serverDefault = { id: "server-default", isDefault: true, lat: 41.3, lng: 69.2 };
assert.deepEqual(replaceOptimisticAddress([...oldAddresses, { id: "temp", isDefault: false }], "temp", serverDefault), [
  { id: "old-default", isDefault: false },
  serverDefault
]);
assert.equal(replaceUpdatedAddress([{ id: "one", isDefault: false }], "one", { id: "one", isDefault: true })[0].isDefault, true);
assert.equal(replaceUpdatedAddress([{ id: "one", isDefault: true }], "one", { id: "one", isDefault: false })[0].isDefault, false);

assert.deepEqual(
  reconcileCatalogAddressState(
    { catalogOriginAddressId: null, catalogSort: "nearest" },
    [{ id: "home", isDefault: true, lat: 0, lng: 0 }]
  ),
  {
    savedAddresses: [{ id: "home", isDefault: true, lat: 0, lng: 0 }],
    catalogOriginAddressId: "home",
    catalogSort: "nearest"
  }
);

console.log("Client address account isolation, ordering, defaults, and origin reconciliation tests passed.");
