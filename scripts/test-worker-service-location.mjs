import assert from "node:assert/strict";
import {
  buildServiceLocationPayload,
  createSubmissionGuard,
  normalizeServiceLocation,
  submitServiceLocationOnce
} from "../src/services/workers/serviceLocation.mjs";
import { createAccountRequestGuard } from "../src/store/requestGeneration.mjs";
import { buildWorkerProfileSyncStatus } from "../src/store/workerSyncState.mjs";

assert.deepEqual(normalizeServiceLocation({ serviceLat: "41.3110810", serviceLng: "69.2405620" }), {
  latitude: 41.311081,
  longitude: 69.240562
});
assert.deepEqual(normalizeServiceLocation({ latitude: -90, longitude: 180 }), {
  latitude: -90,
  longitude: 180
});
assert.equal(normalizeServiceLocation({ latitude: 91, longitude: 69 }), null);
assert.equal(normalizeServiceLocation({ latitude: 41 }), null);
assert.deepEqual(buildServiceLocationPayload({ latitude: 41.3, longitude: 69.2 }), {
  serviceLat: 41.3,
  serviceLng: 69.2
});

const guard = createSubmissionGuard();
let releaseRequest;
let submitCalls = 0;
const firstSubmission = submitServiceLocationOnce({
  guard,
  location: { latitude: 41.3, longitude: 69.2 },
  submit: async () => {
    submitCalls += 1;
    return new Promise((resolve) => {
      releaseRequest = resolve;
    });
  }
});
const duplicateSubmission = await submitServiceLocationOnce({
  guard,
  location: { latitude: 41.4, longitude: 69.3 },
  submit: async () => {
    submitCalls += 1;
    return { ok: true };
  }
});

assert.equal(duplicateSubmission.ok, false);
assert.equal(duplicateSubmission.code, "SAVE_IN_PROGRESS");
assert.equal(submitCalls, 1);
releaseRequest({ ok: true });
assert.equal((await firstSubmission).ok, true);
assert.equal(guard.isActive(), false);

const failedProfileStatus = buildWorkerProfileSyncStatus(
  { ok: false, message: "Profile fetch failed" },
  { loading: true, error: null, isStale: false, lastSyncedAt: "old" }
);
assert.deepEqual(failedProfileStatus, {
  loading: false,
  error: "Profile fetch failed",
  isStale: true,
  lastSyncedAt: "old"
});
assert.deepEqual(buildWorkerProfileSyncStatus({ ok: true }, failedProfileStatus, "new"), {
  loading: false,
  error: null,
  isStale: false,
  lastSyncedAt: "new"
});

const profileGuard = createAccountRequestGuard();
const oldAccountTicket = profileGuard.begin("worker-sync", "worker-a");
profileGuard.invalidateSession();
const newAccountTicket = profileGuard.begin("worker-sync", "worker-b");
assert.equal(profileGuard.isCurrent(oldAccountTicket, "worker-b"), false);
assert.equal(profileGuard.isCurrent(newAccountTicket, "worker-b"), true);
const olderSameAccount = profileGuard.begin("worker-sync", "worker-b");
const newerSameAccount = profileGuard.begin("worker-sync", "worker-b");
assert.equal(profileGuard.isCurrent(olderSameAccount, "worker-b"), false);
assert.equal(profileGuard.isCurrent(newerSameAccount, "worker-b"), true);

const apiFailure = await submitServiceLocationOnce({
  guard,
  location: { latitude: 41.3, longitude: 69.2 },
  submit: async () => ({ ok: false, code: "VALIDATION_ERROR", message: "Request validation failed" })
});
assert.equal(apiFailure.ok, false);
assert.equal(apiFailure.code, "VALIDATION_ERROR");

const networkFailure = await submitServiceLocationOnce({
  guard,
  location: { latitude: 41.3, longitude: 69.2 },
  submit: async () => {
    throw new Error("Network request failed");
  }
});
assert.equal(networkFailure.ok, false);
assert.equal(networkFailure.code, "NETWORK_ERROR");
assert.equal(networkFailure.message, "Network request failed");
assert.equal(guard.isActive(), false);

console.log("Worker service-location state and single-flight tests passed.");
