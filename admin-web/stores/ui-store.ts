import { create } from "zustand";

type AdminUiState = {
  sidebarCollapsed: boolean;
  globalSearch: string;
  setSidebarCollapsed: (value: boolean) => void;
  setGlobalSearch: (value: string) => void;
};

export const useAdminUiStore = create<AdminUiState>((set) => ({
  sidebarCollapsed: false,
  globalSearch: "",
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setGlobalSearch: (globalSearch) => set({ globalSearch })
}));
