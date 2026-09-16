import assert from "node:assert/strict";
import {
  OTHER_WORKER_CANCELLATION_REASON,
  resolveWorkerCancellationReason,
  WORKER_CANCELLATION_REASONS
} from "../src/services/orders/workerCancellation.mjs";

assert.equal(WORKER_CANCELLATION_REASONS.length, 5, "four preset reasons plus Other are required");
assert.equal(WORKER_CANCELLATION_REASONS.at(-1), OTHER_WORKER_CANCELLATION_REASON);
assert.equal(resolveWorkerCancellationReason("Manzil uzoq", ""), "Manzil uzoq");
assert.equal(resolveWorkerCancellationReason(OTHER_WORKER_CANCELLATION_REASON, "  Oilaviy sabab  "), "Oilaviy sabab");
assert.equal(resolveWorkerCancellationReason(OTHER_WORKER_CANCELLATION_REASON, "  "), "");
assert.equal(resolveWorkerCancellationReason(OTHER_WORKER_CANCELLATION_REASON, "ab"), "");
assert.equal(resolveWorkerCancellationReason("Noma'lum variant", "Yetarli matn"), "");

console.log("Worker cancellation reason rules passed.");
