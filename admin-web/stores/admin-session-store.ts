"use client";

import { create } from "zustand";
import { fetchAdminMe, loginAdmin } from "@/services/admin-auth";
import { normalizeAdminRole } from "@/shared/auth/permissions";

type AdminSession = {
  id: string;
  username: string;
  name: string | null;
  role: "admin" | "super_admin";
  permissions: string[];
  tokenType: "env_admin" | "admin_account";
  mustChangePassword?: boolean;
  token: string;
};

type AdminSessionState = {
  session: AdminSession | null;
  isSessionReady: boolean;
  setSession: (session: AdminSession | null) => void;
  hydrateSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
};

export const useAdminSessionStore = create<AdminSessionState>((set, get) => ({
  session: null,
  isSessionReady: false,
  setSession: (session) => set({ session, isSessionReady: true }),
  hydrateSession: async () => {
    const token = window.localStorage.getItem("nearfix-admin-token");
    if (!token) {
      set({ session: null, isSessionReady: true });
      return;
    }

    try {
      const result = await fetchAdminMe(token);
      const role = normalizeAdminRole(result.user.role);

      set({
        session: {
          id: result.user.id,
          username: result.user.username,
          name: result.user.name,
          role,
          permissions: result.user.permissions || [],
          tokenType: result.user.tokenType,
          mustChangePassword: result.user.mustChangePassword,
          token
        },
        isSessionReady: true
      });
    } catch {
      window.localStorage.removeItem("nearfix-admin-token");
      set({ session: null, isSessionReady: true });
    }
  },
  login: async (username, password) => {
    try {
      const result = await loginAdmin(username, password);
      const role = normalizeAdminRole(result.user.role);

      window.localStorage.setItem("nearfix-admin-token", result.token);
      set({
        session: {
          id: result.user.id,
          username: result.user.username,
          name: result.user.name,
          role,
          permissions: result.user.permissions || [],
          tokenType: result.user.tokenType,
          mustChangePassword: result.user.mustChangePassword,
          token: result.token
        },
        isSessionReady: true
      });
      return { ok: true };
    } catch {
      return { ok: false, message: "Username yoki password noto'g'ri." };
    }
  },
  logout: () => {
    window.localStorage.removeItem("nearfix-admin-token");
    get().setSession(null);
  }
}));
