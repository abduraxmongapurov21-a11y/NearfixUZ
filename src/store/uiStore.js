import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, persist } from "zustand/middleware";
import i18n, { DEFAULT_LOCALE, normalizeLocale } from "../i18n";

export const useUiStore = create(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      chatMessages: [],
      supportSheetOpen: false,
      setLocale: (locale) => {
        const nextLocale = normalizeLocale(locale);
        void i18n.changeLanguage(nextLocale);
        set({ locale: nextLocale });
      },
      sendMessage: (message) =>
        set((state) => ({
          chatMessages: [...state.chatMessages, ["out", message]]
        })),
      setSupportSheetOpen: (supportSheetOpen) => set({ supportSheetOpen })
    }),
    {
      name: "nearfix-ui-settings",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        locale: state.locale
      }),
      merge: (persistedState, currentState) => {
        const locale = normalizeLocale(persistedState?.locale);
        void i18n.changeLanguage(locale);
        return { ...currentState, ...persistedState, locale };
      }
    }
  )
);
