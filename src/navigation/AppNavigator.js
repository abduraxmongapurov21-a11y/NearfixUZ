import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { USER_ROLES } from "../constants/routes";
import { registerPushTokenApi } from "../services/notifications/notificationService";
import { useAuthStore } from "../store/authStore";
import { colors } from "../theme";
import { AuthNavigator } from "./AuthNavigator";
import { ClientNavigator } from "./ClientNavigator";
import { WorkerNavigator } from "./WorkerNavigator";
import { Text } from "../i18n/native";

export function AppNavigator() {
  const session = useAuthStore((state) => state.session);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const setHasHydrated = useAuthStore((state) => state.setHasHydrated);

  useEffect(() => {
    if (hasHydrated) return undefined;

    const fallbackTimer = setTimeout(() => {
      setHasHydrated(true);
    }, 2500);

    return () => clearTimeout(fallbackTimer);
  }, [hasHydrated, setHasHydrated]);

  useEffect(() => {
    if (session?.token) {
      registerPushTokenApi(session.token);
    }
  }, [session?.token]);

  if (!hasHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>NearFIX yuklanmoqda...</Text>
      </View>
    );
  }

  if (!session) return <AuthNavigator />;
  if (session.role === USER_ROLES.WORKER) return <WorkerNavigator />;
  return <ClientNavigator />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24
  },
  loadingText: {
    marginTop: 12,
    color: colors.muted,
    fontWeight: "700"
  }
});
