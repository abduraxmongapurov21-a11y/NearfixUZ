import assert from "node:assert/strict";
import { EskizAuthProvider } from "../src/modules/auth/providers/eskiz.provider.js";

type FetchCall = {
  url: string;
  init?: RequestInit;
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function createMockFetch(responses: Response[]) {
  const calls: FetchCall[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: typeof input === "string" ? input : input.toString(),
      init
    });

    const response = responses.shift();
    assert.ok(response, "unexpected Eskiz fetch call");
    return response;
  }) as typeof fetch;

  return {
    calls,
    fetchFn
  };
}

function createProvider(fetchFn: typeof fetch, nowFn: () => number) {
  return new EskizAuthProvider({
    email: "eskiz@example.test",
    password: "test-password",
    baseUrl: "https://notify.eskiz.test",
    timeoutMs: 1000,
    fetchFn,
    nowFn
  });
}

function authHeaders(calls: FetchCall[]) {
  return calls
    .filter((call) => call.url.endsWith("/api/message/sms/send"))
    .map((call) => {
      const headers = new Headers(call.init?.headers);
      return headers.get("authorization");
    });
}

function countCalls(calls: FetchCall[], suffix: string) {
  return calls.filter((call) => call.url.endsWith(suffix)).length;
}

async function assertRejectsMessage(promise: Promise<unknown>, expectedText: string) {
  await assert.rejects(promise, (error) => error instanceof Error && error.message.includes(expectedText));
}

async function testTokenReusedWhileValid() {
  let now = 1_000_000;
  const mock = createMockFetch([
    jsonResponse(200, { data: { token: "token-a", expires_in: 3600 } }),
    jsonResponse(200, { id: "sms-1" }),
    jsonResponse(200, { id: "sms-2" })
  ]);
  const provider = createProvider(mock.fetchFn, () => now);

  await provider.sendOtp("+998901112233", "1234");
  now += 30_000;
  await provider.sendOtp("+998901112233", "5678");

  assert.equal(countCalls(mock.calls, "/api/auth/login"), 1);
  assert.deepEqual(authHeaders(mock.calls), ["Bearer token-a", "Bearer token-a"]);
}

async function testExpiredTokenTriggersLogin() {
  let now = 1_000_000;
  const mock = createMockFetch([
    jsonResponse(200, { data: { token: "token-a", expires_in: 3600 } }),
    jsonResponse(200, { id: "sms-1" }),
    jsonResponse(200, { data: { token: "token-b", expires_in: 3600 } }),
    jsonResponse(200, { id: "sms-2" })
  ]);
  const provider = createProvider(mock.fetchFn, () => now);

  await provider.sendOtp("+998901112233", "1234");
  now += 3_600_000;
  await provider.sendOtp("+998901112233", "5678");

  assert.equal(countCalls(mock.calls, "/api/auth/login"), 2);
  assert.deepEqual(authHeaders(mock.calls), ["Bearer token-a", "Bearer token-b"]);
}

async function testAuthFailureRefreshesTokenAndRetriesOnce() {
  const mock = createMockFetch([
    jsonResponse(200, { data: { token: "token-a" } }),
    jsonResponse(401, { message: "Token expired", token: "should-not-log-raw" }),
    jsonResponse(200, { data: { token: "token-b" } }),
    jsonResponse(200, { id: "sms-2" })
  ]);
  const provider = createProvider(mock.fetchFn, () => 1_000_000);

  await provider.sendOtp("+998901112233", "1234");

  assert.equal(countCalls(mock.calls, "/api/auth/login"), 2);
  assert.equal(countCalls(mock.calls, "/api/message/sms/send"), 2);
  assert.deepEqual(authHeaders(mock.calls), ["Bearer token-a", "Bearer token-b"]);
}

async function testTokenExpiredBodyRefreshesTokenAndRetriesOnce() {
  const mock = createMockFetch([
    jsonResponse(200, { data: { token: "token-a" } }),
    jsonResponse(500, { message: "Token has expired", status_code: 500 }),
    jsonResponse(200, { data: { token: "token-b" } }),
    jsonResponse(200, { id: "sms-2" })
  ]);
  const provider = createProvider(mock.fetchFn, () => 1_000_000);

  await provider.sendOtp("+998901112233", "1234");

  assert.equal(countCalls(mock.calls, "/api/auth/login"), 2);
  assert.equal(countCalls(mock.calls, "/api/message/sms/send"), 2);
  assert.deepEqual(authHeaders(mock.calls), ["Bearer token-a", "Bearer token-b"]);
}

async function testRetryFailureReturnsProviderFailure() {
  const mock = createMockFetch([
    jsonResponse(200, { data: { token: "token-a" } }),
    jsonResponse(403, { message: "Forbidden" }),
    jsonResponse(200, { data: { token: "token-b" } }),
    jsonResponse(403, { message: "Still forbidden" })
  ]);
  const provider = createProvider(mock.fetchFn, () => 1_000_000);

  await assertRejectsMessage(provider.sendOtp("+998901112233", "1234"), "status 403");
  assert.equal(countCalls(mock.calls, "/api/auth/login"), 2);
  assert.equal(countCalls(mock.calls, "/api/message/sms/send"), 2);
}

async function testNonAuthFailuresDoNotRetryToken() {
  const rateLimited = createMockFetch([
    jsonResponse(200, { data: { token: "token-a" } }),
    jsonResponse(429, { message: "Too many requests" })
  ]);
  await assertRejectsMessage(createProvider(rateLimited.fetchFn, () => 1_000_000).sendOtp("+998901112233", "1234"), "status 429");
  assert.equal(countCalls(rateLimited.calls, "/api/auth/login"), 1);
  assert.equal(countCalls(rateLimited.calls, "/api/message/sms/send"), 1);

  const badRequest = createMockFetch([
    jsonResponse(200, { data: { token: "token-a" } }),
    jsonResponse(400, { message: "Bad request" })
  ]);
  await assertRejectsMessage(createProvider(badRequest.fetchFn, () => 1_000_000).sendOtp("+998901112233", "1234"), "status 400");
  assert.equal(countCalls(badRequest.calls, "/api/auth/login"), 1);
  assert.equal(countCalls(badRequest.calls, "/api/message/sms/send"), 1);
}

async function testGenericServerFailureDoesNotRetryToken() {
  const mock = createMockFetch([
    jsonResponse(200, { data: { token: "token-a" } }),
    jsonResponse(500, { message: "Provider unavailable" })
  ]);

  await assertRejectsMessage(createProvider(mock.fetchFn, () => 1_000_000).sendOtp("+998901112233", "1234"), "status 500");
  assert.equal(countCalls(mock.calls, "/api/auth/login"), 1);
  assert.equal(countCalls(mock.calls, "/api/message/sms/send"), 1);
}

async function main() {
  await testTokenReusedWhileValid();
  await testExpiredTokenTriggersLogin();
  await testAuthFailureRefreshesTokenAndRetriesOnce();
  await testTokenExpiredBodyRefreshesTokenAndRetriesOnce();
  await testRetryFailureReturnsProviderFailure();
  await testNonAuthFailuresDoNotRetryToken();
  await testGenericServerFailureDoesNotRetryToken();

  console.log("Eskiz provider tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
