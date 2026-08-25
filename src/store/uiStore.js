import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { createJSONStorage, persist } from "zustand/middleware";
import i18n, { DEFAULT_LOCALE, normalizeLocale } from "../i18n";
import { restartAndroidProcess } from "../services/app/androidProcessRestart";

const UI_SETTINGS_STORAGE_KEY = "nearfix-ui-settings";

async function persistLocale(locale) {
  await AsyncStorage.setItem(
    UI_SETTINGS_STORAGE_KEY,
    JSON.stringify({ state: { locale }, version: 0 })
  );
}

export const useUiStore = create(
  persist(
    (set, get) => ({
      locale: DEFAULT_LOCALE,
      chatMessages: [],
      supportSheetOpen: false,
      setLocale: async (locale) => {
        const nextLocale = normalizeLocale(locale);
        if (nextLocale === get().locale) return false;

        if (Platform.OS === "android") {
          await persistLocale(nextLocale);
          if (restartAndroidProcess()) return true;
        }

        void i18n.changeLanguage(nextLocale);
        set({ locale: nextLocale });
        return true;
      },
      sendMessage: (message) =>
        set((state) => ({
          chatMessages: [...state.chatMessages, ["out", message]]
        })),
      setSupportSheetOpen: (supportSheetOpen) => set({ supportSheetOpen })
    }),
    {
      name: UI_SETTINGS_STORAGE_KEY,
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
