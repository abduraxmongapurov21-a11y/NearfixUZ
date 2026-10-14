import assert from "node:assert/strict";

process.env.EXPO_PUBLIC_APP_ENV = "development";
process.env.EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:4000";

const { fetchCatalogWorkers } = await import("../src/services/catalog/catalogService.js");
const { configureAuthenticatedClientForTests } = await import("../src/services/api/authenticatedClient.js");

let session = null;
let refreshes = 0;
let terminalCalls = 0;
let requests = [];
let mode = "success";
const worker = { id: "worker-plumbing", name: "Plumber", categoryIds: ["cat_plumbing"], availability: { status: "AVAILABLE" } };
const originalFetch = globalThis.fetch;
const auth = {
  get session() { return session; },
  captureAuthRequest(token) {
    return token === session?.token ? { accountId: session.userId } : null;
  },
  isAuthRequestCurrent(identity) { return identity?.accountId === session?.userId; },
  async refreshSession() {
    refreshes += 1;
    session = { ...session, token: "fresh-token" };
    return { ok: true, token: session.token };
  },
  handleTerminalSession() { terminalCalls += 1; session = null; }
};
const restore = configureAuthenticatedClientForTests({ getAuthState: () => auth });
globalThis.fetch = async (url, options) => {
  requests.push({ url, authorization: options.headers.Authorization });
  if (mode === "offline") throw new TypeError("Connection refused");
  if (mode === "blocked") return Response.json({ ok: false, code: "USER_BLOCKED", message: "Blocked" }, { status: 403 });
  if (options.headers.Authorization === "Bearer expired-token") {
    return Response.json({ ok: false, code: "ACCESS_TOKEN_EXPIRED", message: "Expired" }, { status: 401 });
  }
  return Response.json({ ok: true, workers: [worker] });
};

try {
  const guest = await fetchCatalogWorkers("cat_plumbing");
  assert.equal(guest.ok, true);
  assert.equal(requests[0].authorization, undefined, "guest catalog stays public");
  const gpsGuest = await fetchCatalogWorkers("cat_plumbing", { originCoordinates: { lat: 0, lng: 0 }, originAddressId: "ignored-office", sort: "nearest" });
  assert.equal(gpsGuest.ok, true);
  const gpsQuery = new URL(requests.at(-1).url).searchParams;
  assert.equal(gpsQuery.get("originLat"), "0");
  assert.equal(gpsQuery.get("originLng"), "0");
  assert.equal(gpsQuery.has("originAddressId"), false);
  assert.equal(gpsQuery.get("sort"), "nearest");
  assert.equal((await fetchCatalogWorkers("cat_plumbing", { originCoordinates: { lat: 91, lng: 0 } })).code, "ORIGIN_COORDINATES_INVALID");

  session = { userId: "client-fixture", token: "expired-token" };
  requests = [];
  const renewed = await fetchCatalogWorkers("cat_plumbing", { token: session.token, originAddressId: "office", sort: "nearest" });
  assert.equal(renewed.ok, true, "catalog must recover from an expired access token");
  assert.equal(refreshes, 1);
  assert.deepEqual(requests.map((request) => request.authorization), ["Bearer expired-token", "Bearer fresh-token"]);
  assert.ok(requests.every((request) => new URL(request.url).searchParams.get("originAddressId") === "office"));
  assert.equal(renewed.workers[0].id, worker.id);

  requests = [];
  mode = "offline";
  const offline = await fetchCatalogWorkers("cat_plumbing", { token: session.token });
  assert.equal(offline.ok, false);
  assert.equal(offline.code, "NETWORK_REQUEST_FAILED");
  assert.equal(refreshes, 1, "network failures must not rotate the session");
  mode = "success";
  assert.equal((await fetchCatalogWorkers("cat_plumbing", { token: session.token })).ok, true, "retry recovers when backend returns");

  requests = [];
  mode = "blocked";
  const blocked = await fetchCatalogWorkers("cat_plumbing", { token: session.token });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "USER_BLOCKED");
  assert.equal(terminalCalls, 1);
  assert.equal(requests.length, 1, "blocked users must not receive an unauthenticated fallback");
  console.log("Catalog guest access, expired-session refresh, network recovery and blocked-session tests passed.");
} finally {
  globalThis.fetch = originalFetch;
  restore();
}
