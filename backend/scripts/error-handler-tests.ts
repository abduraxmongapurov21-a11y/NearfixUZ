import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { errorHandler } from "../src/http/error-handler.js";

const forwardedError = new Error("response already started");
let nextCalls = 0;
let forwardedValue: unknown;
let statusCalls = 0;
let jsonCalls = 0;
errorHandler(
  forwardedError,
  { method: "GET", originalUrl: "/already-started" } as never,
  {
    headersSent: true,
    status: () => {
      statusCalls += 1;
      throw new Error("ERR_HTTP_HEADERS_SENT");
    },
    json: () => {
      jsonCalls += 1;
      throw new Error("ERR_HTTP_HEADERS_SENT");
    }
  } as never,
  ((error: unknown) => {
    nextCalls += 1;
    forwardedValue = error;
  }) as never
);
assert.equal(nextCalls, 1);
assert.equal(forwardedValue, forwardedError);
assert.equal(statusCalls, 0);
assert.equal(jsonCalls, 0);

const app = express();

for (const status of [400, 403, 404]) {
  app.get(`/controlled-${status}`, (_request, _response, next) => {
    next(Object.assign(new Error(`controlled ${status}`), { status, code: `CONTROLLED_${status}` }));
  });
}

app.get("/unexpected", (_request, _response, next) => {
  next(new Error("database password and internal stack detail"));
});
app.use(errorHandler);

const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address() as AddressInfo;

try {
  for (const status of [400, 403, 404]) {
    const response = await fetch(`http://127.0.0.1:${address.port}/controlled-${status}`);
    const payload = await response.json();
    assert.equal(response.status, status);
    assert.equal(payload.code, `CONTROLLED_${status}`);
    assert.equal(payload.message, `controlled ${status}`);
  }

  const unexpectedResponse = await fetch(`http://127.0.0.1:${address.port}/unexpected`);
  const unexpectedPayload = await unexpectedResponse.json();
  assert.equal(unexpectedResponse.status, 500);
  assert.deepEqual(unexpectedPayload, {
    ok: false,
    code: "INTERNAL_ERROR",
    message: "Unexpected server error"
  });
  assert.equal(JSON.stringify(unexpectedPayload).includes("password"), false);
  assert.equal(JSON.stringify(unexpectedPayload).includes("stack"), false);

  console.log("headersSent forwarding, controlled 4xx, and sanitized unexpected 500 error-handler tests passed.");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
