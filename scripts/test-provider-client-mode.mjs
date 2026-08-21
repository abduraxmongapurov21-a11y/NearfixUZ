import assert from "node:assert/strict";
import {
  defaultExperienceModeForRole,
  normalizeExperienceMode,
  rootExperienceForSession
} from "../src/navigation/experienceMode.mjs";
const persisted = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => persisted.get(key) ?? null,
    setItem: (key, value) => persisted.set(key, value),
    removeItem: (key) => persisted.delete(key)
  }
};
process.env.EXPO_PUBLIC_APP_ENV = "development";
process.env.EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:4000";
const { useAuthStore } = await import("../src/store/authStore.js");

assert.equal(defaultExperienceModeForRole("client"), "client");
assert.equal(defaultExperienceModeForRole("provider"), "worker");
assert.equal(normalizeExperienceMode("provider", "client"), "client");
assert.equal(normalizeExperienceMode("provider", "worker"), "worker");
assert.equal(normalizeExperienceMode("provider", "stale-value"), "worker");
assert.equal(normalizeExperienceMode("client", "worker"), "client");
assert.equal(rootExperienceForSession({ role: "provider", experienceMode: "client" }), "discovery");
assert.equal(rootExperienceForSession({ role: "provider", experienceMode: "worker" }), "worker");

try {
  useAuthStore.setState({
    session: { userId: "provider-a", token: "token-a", role: "provider", experienceMode: "worker", sessionVersion: 2 },
    invalidation: null,
    navigationGeneration: 10
  });
  assert.equal(useAuthStore.getState().setExperienceMode("client"), true);
  assert.equal(useAuthStore.getState().session.experienceMode, "client");
  assert.equal(useAuthStore.getState().navigationGeneration, 11);
  assert.equal(useAuthStore.getState().setExperienceMode("worker"), true);
  assert.equal(useAuthStore.getState().session.experienceMode, "worker");

  useAuthStore.setState({
    session: { userId: "client-b", token: "token-b", role: "client", experienceMode: "client", sessionVersion: 1 },
    invalidation: null
  });
  assert.equal(useAuthStore.getState().setExperienceMode("worker"), false, "client cannot self-grant provider mode");
  assert.equal(useAuthStore.getState().session.userId, "client-b");
  assert.equal(useAuthStore.getState().session.experienceMode, "client", "account switch cannot retain provider mode");

  const identity = useAuthStore.getState().captureAuthRequest("token-b");
  assert.equal(useAuthStore.getState().handleTerminalSession("SESSION_INVALID", "expired", identity), true);
  assert.equal(useAuthStore.getState().session, null, "terminal invalidation clears account-bound mode with the session");
} finally {
  useAuthStore.setState({ session: null, invalidation: null, pendingIntent: null });
}

console.log("Provider/client mode, account-switch, and session invalidation tests passed.");
