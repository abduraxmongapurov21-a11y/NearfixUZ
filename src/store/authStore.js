import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  completeOtpRegistration,
  deleteCurrentUserApi,
  loginWithAppReviewDemo,
  loginWithPassword as loginWithPasswordApi,
  logoutApi,
  getCurrentUserApi,
  refreshAccessTokenApi,
  resetPassword as resetPasswordApi,
  setupPassword as setupPasswordApi,
  updateCurrentUserApi,
  verifyAuthOtp
} from "../services/auth";
import { resetRoleStores } from "./sessionReset";
import { createAccountRequestGuard, createOperationGuard } from "./requestGeneration.mjs";
import { sanitizePendingIntent } from "../navigation/pendingIntent.mjs";
import { defaultExperienceModeForRole, normalizeExperienceMode } from "../navigation/experienceMode.mjs";

const PUSH_TOKEN_STORAGE_KEY = "nearfix-push-token";
const authRequestGuard = createAccountRequestGuard();
const authAttemptGuard = createOperationGuard();
const defaultAuthStoreDependencies = { getCurrentUserApi, refreshAccessTokenApi, updateCurrentUserApi };
let authStoreDependencies = { ...defaultAuthStoreDependencies };

export function configureAuthStoreForTests(overrides = {}) {
  authStoreDependencies = { ...authStoreDependencies, ...overrides };
  return () => { authStoreDependencies = { ...defaultAuthStoreDependencies }; };
}
const TERMINAL_SESSION_CODES = new Set([
  "REFRESH_SESSION_INVALID",
  "SESSION_INVALID",
  "SESSION_VERSION_MISMATCH",
  "USER_BLOCKED"
]);

function toSession(apiResult, user = apiResult.user) {
  return {
    token: apiResult.accessToken || apiResult.token,
    refreshToken: apiResult.refreshToken,
    userId: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    experienceMode: defaultExperienceModeForRole(user.role),
    sessionVersion: user.sessionVersion
  };
}

function captureAuthRequest(get, token) {
  const current = get().session;
  if (!current?.userId || !current.token || (token && token !== current.token)) return null;
  return {
    userId: current.userId,
    ticket: authRequestGuard.capture(current.userId)
  };
}

function isAuthRequestCurrent(get, identity) {
  return authRequestGuard.isSessionCurrent(identity?.ticket, get().session?.userId);
}

function storeSessionResult(set, get, apiResult) {
  const previousUserId = get().session?.userId;
  authRequestGuard.invalidateSession();
  resetRoleStores();

  set((state) => ({
    session: toSession(apiResult),
    invalidation: null,
    pendingIntent: previousUserId && previousUserId !== apiResult.user.id ? null : state.pendingIntent,
    navigationGeneration: previousUserId && previousUserId !== apiResult.user.id
      ? state.navigationGeneration + 1
      : state.navigationGeneration
  }));

  return { ok: true, role: apiResult.user.role, source: "api" };
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
  session: null,
  invalidation: null,
  pendingIntent: null,
  navigationGeneration: 0,
  hasHydrated: false,
  setHasHydrated: (value) => set({ hasHydrated: value }),
  setExperienceMode: (mode) => {
    const current = get().session;
    if (!current || current.role !== "provider" || !["client", "worker"].includes(mode)) return false;
    if (normalizeExperienceMode(current.role, current.experienceMode) === mode) return true;
    authRequestGuard.invalidateSession();
    resetRoleStores();
    set((state) => ({
      session: { ...current, experienceMode: mode },
      navigationGeneration: state.navigationGeneration + 1
    }));
    return true;
  },
  setPendingIntent: (intent) => set({ pendingIntent: sanitizePendingIntent(intent) }),
  clearPendingIntent: () => set({ pendingIntent: null }),
  consumePendingIntent: () => {
    const intent = get().pendingIntent;
    set({ pendingIntent: null });
    return intent;
  },
  captureAuthRequest: (token) => captureAuthRequest(get, token),
  isAuthRequestCurrent: (identity) => isAuthRequestCurrent(get, identity),
  verifyOtpAndLogin: async (phone, code, purpose = "AUTH") => {
    const attempt = authAttemptGuard.begin();
    const apiResult = await verifyAuthOtp(phone, code, purpose);
    if (!apiResult.ok) return apiResult;
    if (!authAttemptGuard.isCurrent(attempt)) return { ok: false, stale: true };

    if (apiResult.status === "REGISTRATION_REQUIRED") return apiResult;

    return storeSessionResult(set, get, apiResult);
  },
  completeRegistration: async (registrationToken, name) => {
    const attempt = authAttemptGuard.begin();
    const apiResult = await completeOtpRegistration(registrationToken, name);
    if (!apiResult.ok) return apiResult;
    if (!authAttemptGuard.isCurrent(attempt)) return { ok: false, stale: true };

    return storeSessionResult(set, get, apiResult);
  },
  loginWithDemoPassword: async (phone, password) => {
    const attempt = authAttemptGuard.begin();
    const apiResult = await loginWithAppReviewDemo(phone, password);
    if (!apiResult.ok) return apiResult;
    if (!authAttemptGuard.isCurrent(attempt)) return { ok: false, stale: true };

    return storeSessionResult(set, get, apiResult);
  },
  login: async (otpSessionToken, password) => {
    const attempt = authAttemptGuard.begin();
    const apiResult = await loginWithPasswordApi(otpSessionToken, password);
    if (!apiResult.ok) return apiResult;
    if (!authAttemptGuard.isCurrent(attempt)) return { ok: false, stale: true };

    return storeSessionResult(set, get, apiResult);
  },
  setupPassword: async (otpSessionToken, password, confirmPassword) => {
    const attempt = authAttemptGuard.begin();
    const apiResult = await setupPasswordApi(otpSessionToken, password, confirmPassword);
    if (!apiResult.ok) return apiResult;
    if (!authAttemptGuard.isCurrent(attempt)) return { ok: false, stale: true };

    return storeSessionResult(set, get, apiResult);
  },
  resetPassword: async (otpSessionToken, password, confirmPassword) => {
    const attempt = authAttemptGuard.begin();
    const apiResult = await resetPasswordApi(otpSessionToken, password, confirmPassword);
    if (!apiResult.ok) return apiResult;
    if (!authAttemptGuard.isCurrent(attempt)) return { ok: false, stale: true };

    return storeSessionResult(set, get, apiResult);
  },
  updateProfile: async (profile) => {
    const current = get().session;
    if (!current?.token) return { ok: false, message: "No API session token" };
    const identity = captureAuthRequest(get, current.token);
    const ticket = authRequestGuard.begin("profile", current.userId);

    const result = await authStoreDependencies.updateCurrentUserApi(current.token, profile);
    if (!isAuthRequestCurrent(get, identity)) return { ...result, ok: false, stale: true };
    if (!result.ok) {
      if (TERMINAL_SESSION_CODES.has(result.code)) get().handleTerminalSession(result.code, result.message, identity);
      return result;
    }
    if (!authRequestGuard.isCurrent(ticket, get().session?.userId)) return { ...result, ok: false, stale: true };

    set({
      session: {
        ...current,
        name: result.user.name,
        phone: result.user.phone,
        role: result.user.role,
        sessionVersion: result.user.sessionVersion
      }
    });

    return { ok: true, user: result.user };
  },
  refreshSession: async () => {
    const current = get().session;
    if (!current?.token) return { ok: false };
    const identity = captureAuthRequest(get, current.token);
    const ticket = authRequestGuard.begin("refresh", current.userId);

    if (current.refreshToken) {
      const refreshResult = await authStoreDependencies.refreshAccessTokenApi(current.refreshToken);
      if (!authRequestGuard.isCurrent(ticket, get().session?.userId)) return { ...refreshResult, ok: false, stale: true };

      if (refreshResult.ok) {
        if (
          current.userId !== refreshResult.user.id ||
          current.role !== refreshResult.user.role
        ) {
          resetRoleStores();
        }

        const roleChanged = current.role !== refreshResult.user.role;
        set({
          session: {
            ...current,
            token: refreshResult.token,
            userId: refreshResult.user.id,
            phone: refreshResult.user.phone,
            name: refreshResult.user.name,
            role: refreshResult.user.role,
            experienceMode: roleChanged
              ? defaultExperienceModeForRole(refreshResult.user.role)
              : normalizeExperienceMode(refreshResult.user.role, current.experienceMode),
            sessionVersion: refreshResult.user.sessionVersion
          }
        });
        return { ok: true, token: refreshResult.token };
      }

      if (TERMINAL_SESSION_CODES.has(refreshResult.code)) {
        get().handleTerminalSession(refreshResult.code, refreshResult.message, identity);
      }

      return refreshResult;
    }

    const result = await authStoreDependencies.getCurrentUserApi(current.token);
    if (!authRequestGuard.isCurrent(ticket, get().session?.userId)) return { ...result, ok: false, stale: true };
    if (result.ok) {
      if (
        current.userId !== result.user.id ||
        current.role !== result.user.role
      ) {
        resetRoleStores();
      }

      const roleChanged = current.role !== result.user.role;
      set({
        session: {
          ...current,
          userId: result.user.id,
          phone: result.user.phone,
          name: result.user.name,
          role: result.user.role,
          experienceMode: roleChanged
            ? defaultExperienceModeForRole(result.user.role)
            : normalizeExperienceMode(result.user.role, current.experienceMode),
          sessionVersion: result.user.sessionVersion
        }
      });
      return { ok: true };
    }

    if (TERMINAL_SESSION_CODES.has(result.code)) {
      get().handleTerminalSession(result.code, result.message, identity);
    }

    return result;
  },
  logout: async () => {
    const current = get().session;
    authRequestGuard.invalidateSession();
    authAttemptGuard.invalidate();
    resetRoleStores();
    set((state) => ({
      session: null,
      invalidation: null,
      pendingIntent: null,
      navigationGeneration: state.navigationGeneration + 1
    }));
    if (current?.token) {
      const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
      await logoutApi(current.token, pushToken);
      if (pushToken) await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    }
  },
  deleteAccount: async () => {
    const current = get().session;
    if (!current?.token) return { ok: false, message: "No API session token" };

    const result = await deleteCurrentUserApi(current.token);
    if (!result.ok) return result;

    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    authRequestGuard.invalidateSession();
    authAttemptGuard.invalidate();
    resetRoleStores();
    set((state) => ({
      session: null,
      invalidation: null,
      pendingIntent: null,
      navigationGeneration: state.navigationGeneration + 1
    }));

    return result;
  },
  invalidateSessionForRoleChange: (nextRole) => {
    const current = get().session;
    authRequestGuard.invalidateSession();
    authAttemptGuard.invalidate();
    resetRoleStores();
    set((state) => ({
      session: null,
      pendingIntent: null,
      navigationGeneration: state.navigationGeneration + 1,
      invalidation: {
        reason: "role_changed",
        nextRole,
        previousRole: current?.role,
        message: "Profilingiz yangilandi. Xavfsizlik sababli qayta kirish talab qilinadi."
      }
    }));
  },
  handleTerminalSession: (code, message, identity) => {
    if (!TERMINAL_SESSION_CODES.has(code)) return false;
    if (identity && !isAuthRequestCurrent(get, identity)) return false;
    const current = get().session;
    authRequestGuard.invalidateSession();
    authAttemptGuard.invalidate();
    resetRoleStores();
    set((state) => ({
      session: null,
      pendingIntent: null,
      navigationGeneration: state.navigationGeneration + 1,
      invalidation: {
        reason: code === "USER_BLOCKED" ? "blocked" : "session_expired",
        previousRole: current?.role,
        message: message || (code === "USER_BLOCKED" ? "Hisob bloklangan." : "Sessiya tugadi. Qayta kiring.")
      }
    }));
    return true;
  },
  acknowledgeInvalidation: () => set({ invalidation: null })
    }),
    {
      name: "nearfix-auth-session",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
        invalidation: state.invalidation
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
