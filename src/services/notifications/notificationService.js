import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { apiRequest } from "../api/client";
import { httpAuthRequest } from "../api/authenticatedClient";

export const PUSH_TOKEN_STORAGE_KEY = "nearfix-push-token";

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

export async function savePushTokenApi(token, pushToken) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/notifications/push-token", {
      method: "POST",
      token,
      body: {
        token: pushToken,
        platform: Platform.OS
      }
    });

    return {
      ok: true,
      token: payload.token
    };
  });
}

export async function registerPushTokenApi(token) {
  return apiRequest(async () => {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      return { ok: false, message: "Push notification permission denied" };
    }

    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      return { ok: false, message: "EAS project ID is not configured" };
    }

    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = result.data;
    const saveResult = await savePushTokenApi(token, pushToken);
    if (!saveResult.ok) return saveResult;

    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, pushToken);

    return {
      ok: true,
      pushToken
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
