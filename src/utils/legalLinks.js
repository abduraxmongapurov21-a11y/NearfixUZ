import { Linking } from "react-native";
import { Alert } from "../i18n/native";
import { env } from "../constants/env";
import { httpRequest } from "../services/api/client";

let remoteLegalConfig;

async function getRemoteLegalConfig() {
  if (remoteLegalConfig) return remoteLegalConfig;

  try {
    remoteLegalConfig = await httpRequest("/content/legal");
    return remoteLegalConfig;
  } catch {
    return {};
  }
}

async function openConfiguredUrl(localUrl, remoteKey, label) {
  const remoteConfig = localUrl ? {} : await getRemoteLegalConfig();
  const url = localUrl || remoteConfig?.[remoteKey] || "";

  if (!url) {
    Alert.alert("Havola sozlanmagan", `${label} manzili ilova konfiguratsiyasida ko'rsatilmagan.`);
    return { ok: false, code: "LEGAL_URL_NOT_CONFIGURED" };
  }

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Havola ochilmadi", `${label} manzilini ochib bo'lmadi.`);
      return { ok: false, code: "LEGAL_URL_UNSUPPORTED" };
    }

    await Linking.openURL(url);
    return { ok: true };
  } catch (error) {
    Alert.alert("Havola ochilmadi", error?.message || `${label} manzilini ochib bo'lmadi.`);
    return { ok: false, code: "LEGAL_URL_OPEN_FAILED" };
  }
}

export function openPrivacyPolicy() {
  return openConfiguredUrl(env.privacyPolicyUrl, "privacyPolicyUrl", "Maxfiylik siyosati");
}

export function openTerms() {
  return openConfiguredUrl(env.termsUrl, "termsUrl", "Foydalanish shartlari");
}
