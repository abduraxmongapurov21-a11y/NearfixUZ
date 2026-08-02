import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, persist } from "zustand/middleware";
import {
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

const PUSH_TOKEN_STORAGE_KEY = "nearfix-push-token";

function toSession(apiResult, user = apiResult.user) {
  return {
    token: apiResult.accessToken || apiResult.token,
    refreshToken: apiResult.refreshToken,
    userId: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion
  };
}

function storeSessionResult(set, apiResult) {
  resetRoleStores();

  set({
    session: toSession(apiResult),
    invalidation: null
  });

  return { ok: true, role: apiResult.user.role, source: "api" };
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
  session: null,
  invalidation: null,
  hasHydrated: false,
  setHasHydrated: (value) => set({ hasHydrated: value }),
  verifyOtpAndLogin: async (phone, code, purpose = "AUTH") => {
    const apiResult = await verifyAuthOtp(phone, code, purpose);
    if (!apiResult.ok) return apiResult;

    return storeSessionResult(set, apiResult);
  },
  loginWithDemoPassword: async (phone, password) => {
    const apiResult = await loginWithAppReviewDemo(phone, password);
    if (!apiResult.ok) return apiResult;

    return storeSessionResult(set, apiResult);
  },
  login: async (otpSessionToken, password) => {
    const apiResult = await loginWithPasswordApi(otpSessionToken, password);
    if (!apiResult.ok) return apiResult;

    return storeSessionResult(set, apiResult);
  },
  setupPassword: async (otpSessionToken, password, confirmPassword) => {
    const apiResult = await setupPasswordApi(otpSessionToken, password, confirmPassword);
    if (!apiResult.ok) return apiResult;

    return storeSessionResult(set, apiResult);
  },
  resetPassword: async (otpSessionToken, password, confirmPassword) => {
    const apiResult = await resetPasswordApi(otpSessionToken, password, confirmPassword);
    if (!apiResult.ok) return apiResult;

    return storeSessionResult(set, apiResult);
  },
  updateProfile: async (profile) => {
    const current = get().session;
    if (!current?.token) return { ok: false, message: "No API session token" };

    const result = await updateCurrentUserApi(current.token, profile);
    if (!result.ok) return result;

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

    if (current.refreshToken) {
      const refreshResult = await refreshAccessTokenApi(current.refreshToken);

      if (refreshResult.ok) {
        if (
          current.userId !== refreshResult.user.id ||
          current.role !== refreshResult.user.role
        ) {
          resetRoleStores();
        }

        set({
          session: {
            ...current,
            token: refreshResult.token,
            userId: refreshResult.user.id,
            phone: refreshResult.user.phone,
            name: refreshResult.user.name,
            role: refreshResult.user.role,
            sessionVersion: refreshResult.user.sessionVersion
          }
        });
        return { ok: true, token: refreshResult.token };
      }

      if (refreshResult.code === "REFRESH_SESSION_INVALID") {
        resetRoleStores();
        set({
          session: null,
          invalidation: {
            reason: "session_expired",
            previousRole: current.role,
            message: "Sessiya muddati tugagan. Qayta kiring."
          }
        });
      }

      return refreshResult;
    }

    const result = await getCurrentUserApi(current.token);
    if (result.ok) {
      if (
        current.userId !== result.user.id ||
        current.role !== result.user.role
      ) {
        resetRoleStores();
      }

      set({
        session: {
          ...current,
          userId: result.user.id,
          phone: result.user.phone,
          name: result.user.name,
          role: result.user.role,
          sessionVersion: result.user.sessionVersion
        }
      });
      return { ok: true };
    }

    if (result.code === "SESSION_VERSION_MISMATCH" || result.code === "SESSION_INVALID") {
      resetRoleStores();
      set({
        session: null,
        invalidation: {
          reason: "role_changed",
          previousRole: current.role,
          message: "Profilingiz yangilandi. Xavfsizlik sababli qayta kirish talab qilinadi."
        }
      });
    }

    return result;
  },
  logout: async () => {
    const current = get().session;
    if (current?.token) {
      const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
      await logoutApi(current.token, pushToken);
      if (pushToken) await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    }

    resetRoleStores();
    set({
      session: null
    });
  },
  deleteAccount: async () => {
    const current = get().session;
    if (!current?.token) return { ok: false, message: "No API session token" };

    const result = await deleteCurrentUserApi(current.token);
    if (!result.ok) return result;

    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    resetRoleStores();
    set({
      session: null,
      invalidation: null
    });

    return result;
  },
  invalidateSessionForRoleChange: (nextRole) => {
    const current = get().session;
    resetRoleStores();
    set({
      session: null,
      invalidation: {
        reason: "role_changed",
        nextRole,
        previousRole: current?.role,
        message: "Profilingiz yangilandi. Xavfsizlik sababli qayta kirish talab qilinadi."
      }
    });
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
