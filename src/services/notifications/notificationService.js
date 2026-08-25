import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { apiRequest } from "../api/client";
import { httpAuthRequest } from "../api/authenticatedClient";

export const PUSH_TOKEN_STORAGE_KEY = "nearfix-push-token";
export const PUSH_DEVICE_ID_STORAGE_KEY = "nearfix-push-device-id";

function createDeviceId() {
  return `nearfix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export async function getOrCreatePushDeviceId() {
  const existing = await AsyncStorage.getItem(PUSH_DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const deviceId = createDeviceId();
  await AsyncStorage.setItem(PUSH_DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
}

export async function fetchNotificationsApi(token) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/notifications", { token });
    return {
      ok: true,
      notifications: payload.notifications || []
    };
  });
}

export async function markNotificationReadApi(token, notificationId) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest(`/notifications/${notificationId}/read`, {
      method: "PATCH",
      token
    });

    return {
      ok: true,
      notification: payload.notification
    };
  });
}

export async function savePushTokenApi(token, pushToken, deviceId) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/notifications/push-token", {
      method: "POST",
      token,
      body: {
        token: pushToken,
        platform: Platform.OS,
        deviceId
      }
    });

    return {
      ok: true,
      token: payload.token
    };
  });
}

export async function registerPushTokenApi(token, isCurrent = () => true) {
  return apiRequest(async () => {
    if (!isCurrent()) return { ok: false, stale: true };
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId) {
      return { ok: false, message: "EAS project ID is not configured" };
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("orders", {
        name: "NearFIX buyurtma va chatlar",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 180, 250],
        lightColor: "#0F719D",
        sound: "default"
      });
    }

    const currentPermission = await Notifications.getPermissionsAsync();
    const permission = currentPermission.granted
      ? currentPermission
      : await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      return { ok: false, message: "Push notification permission denied" };
    }

    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = result.data;
    const deviceId = await getOrCreatePushDeviceId();
    if (!isCurrent()) return { ok: false, stale: true };
    const saveResult = await savePushTokenApi(token, pushToken, deviceId);
    if (!saveResult.ok) return saveResult;

    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, pushToken);

    return {
      ok: true,
      pushToken,
      deviceId
    };
  });
}

export async function fetchUnreadNotificationCountApi(token) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/notifications/unread-count", { token });

    return {
      ok: true,
      count: payload.count || 0
    };
  });
}
