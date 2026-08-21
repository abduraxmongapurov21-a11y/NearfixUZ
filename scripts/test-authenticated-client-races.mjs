import assert from "node:assert/strict";
import { createAccountRequestGuard } from "../src/store/requestGeneration.mjs";

process.env.EXPO_PUBLIC_APP_ENV = "development";
process.env.EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:4000";

const { ApiError } = await import("../src/services/api/client.js");
const { configureAuthenticatedClientForTests, httpAuthRequest } = await import(
  "../src/services/api/authenticatedClient.js"
);
const { configureAuthStoreForTests, useAuthStore } = await import("../src/store/authStore.js");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const guard = createAccountRequestGuard();
let session;
let refreshImplementation = async () => ({ ok: false });
const terminalCalls = [];
const state = {
  get session() { return session; },
  captureAuthRequest(token) {
    if (!session?.userId || token !== session.token) return null;
    return guard.capture(session.userId);
  },
  isAuthRequestCurrent(identity) {
    return guard.isSessionCurrent(identity, session?.userId);
  },
  async refreshSession() { return refreshImplementation(); },
  handleTerminalSession(code, message, identity) {
    if (!this.isAuthRequestCurrent(identity)) return false;
    terminalCalls.push({ code, userId: identity.accountId });
    guard.invalidateSession();
    session = null;
    return true;
  }
};
const requests = [];
async function nextRequest() {
  while (!requests.length) await new Promise((resolve) => setImmediate(resolve));
  return requests.shift();
}
const restore = configureAuthenticatedClientForTests({
  getAuthState: () => state,
  httpRequest: () => {
    const request = deferred();
    requests.push(request);
    return request.promise;
  }
});

function setAccount(name, token = `token-${name}`) {
  session = { userId: `account-${name}`, token };
}

try {
  setAccount("a");
  const staleSuccess = httpAuthRequest("/test");
  guard.invalidateSession();
  setAccount("b");
  (await nextRequest()).resolve({ ok: true, owner: "a" });
  await assert.rejects(staleSuccess, (error) => error.code === "STALE_AUTH_RESPONSE");
  assert.equal(session.userId, "account-b");

  setAccount("a");
  const staleTerminal = httpAuthRequest("/test");
  guard.invalidateSession();
  setAccount("b");
  (await nextRequest()).reject(new ApiError("expired", 401, "SESSION_INVALID"));
  await assert.rejects(staleTerminal, (error) => error.code === "STALE_AUTH_RESPONSE");
  assert.equal(session.userId, "account-b");
  assert.equal(terminalCalls.length, 0);

  setAccount("a");
  const staleRefreshResult = deferred();
  refreshImplementation = () => staleRefreshResult.promise;
  const staleRefresh = httpAuthRequest("/test");
  (await nextRequest()).reject(new ApiError("refresh", 401, "ACCESS_TOKEN_EXPIRED"));
  await Promise.resolve();
  guard.invalidateSession();
  setAccount("b");
  staleRefreshResult.resolve({ ok: true, token: "restored-a" });
  await assert.rejects(staleRefresh, (error) => error.code === "STALE_AUTH_RESPONSE");
  assert.equal(session.userId, "account-b");

  setAccount("a", "old-token");
  refreshImplementation = async () => {
    session = { ...session, token: "fresh-token" };
    return { ok: true, token: "fresh-token" };
  };
  const retryTerminal = httpAuthRequest("/test");
  (await nextRequest()).reject(new ApiError("refresh", 401, "ACCESS_TOKEN_EXPIRED"));
  (await nextRequest()).reject(new ApiError("blocked", 403, "USER_BLOCKED"));
  await assert.rejects(retryTerminal, (error) => error.code === "USER_BLOCKED");
  assert.deepEqual(terminalCalls, [{ code: "USER_BLOCKED", userId: "account-a" }]);
  assert.equal(session, null);

  const realRefresh = deferred();
  const realProfile = deferred();
  const persisted = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => persisted.get(key) ?? null,
      setItem: (key, value) => persisted.set(key, value),
      removeItem: (key) => persisted.delete(key)
    }
  };
  const restoreAuthStore = configureAuthStoreForTests({
    refreshAccessTokenApi: () => realRefresh.promise,
    updateCurrentUserApi: () => realProfile.promise
  });
  try {
    useAuthStore.setState({
      session: { userId: "real-a", token: "real-a-token", refreshToken: "real-a-refresh", role: "client", sessionVersion: 1 },
      invalidation: null,
      pendingIntent: null
    });
    const refresh = useAuthStore.getState().refreshSession();
    const currentIdentity = useAuthStore.getState().captureAuthRequest("real-a-token");
    assert.equal(useAuthStore.getState().handleTerminalSession("SESSION_INVALID", "logout", currentIdentity), true);
    useAuthStore.setState({ session: { userId: "real-b", token: "real-b-token", refreshToken: "real-b-refresh", role: "client", sessionVersion: 7 }, invalidation: null });
    realRefresh.resolve({ ok: true, token: "restored-a-token", user: { id: "real-a", phone: "a", name: "A", role: "client", sessionVersion: 1 } });
    assert.equal((await refresh).stale, true);
    assert.equal(useAuthStore.getState().session.userId, "real-b");
    assert.equal(useAuthStore.getState().session.token, "real-b-token");

    useAuthStore.setState({ session: { userId: "profile-a", token: "profile-a-token", role: "client", sessionVersion: 1 }, invalidation: null });
    const profileUpdate = useAuthStore.getState().updateProfile({ name: "Late A" });
    const profileIdentity = useAuthStore.getState().captureAuthRequest("profile-a-token");
    assert.equal(useAuthStore.getState().handleTerminalSession("SESSION_INVALID", "logout", profileIdentity), true);
    useAuthStore.setState({ session: { userId: "profile-b", token: "profile-b-token", role: "client", name: "B", sessionVersion: 4 }, invalidation: null });
    realProfile.resolve({ ok: false, code: "USER_BLOCKED", message: "late terminal" });
    assert.equal((await profileUpdate).stale, true);
    assert.equal(useAuthStore.getState().session.userId, "profile-b");
    assert.equal(useAuthStore.getState().invalidation, null);
  } finally {
    restoreAuthStore();
    useAuthStore.setState({ session: null, invalidation: null, pendingIntent: null });
  }

  console.log("Authenticated client and real auth-store deferred account-race tests passed.");
} finally {
  restore();
}
