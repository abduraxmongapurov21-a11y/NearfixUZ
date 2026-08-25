import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { registerPushTokenApi } from "../services/notifications/notificationService";
import { enqueuePushRegistration } from "../services/notifications/pushRegistrationQueue.mjs";
import { useAuthStore } from "../store/authStore";
import { colors } from "../theme";
import { ClientNavigator } from "./ClientNavigator";
import { WorkerNavigator } from "./WorkerNavigator";
import { Text } from "../i18n/native";
import { discoveryNavigatorKey } from "./pendingIntent.mjs";
import { rootExperienceForSession } from "./experienceMode.mjs";

export function AppNavigator() {
  const session = useAuthStore((state) => state.session);
  const invalidation = useAuthStore((state) => state.invalidation);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const navigationGeneration = useAuthStore((state) => state.navigationGeneration);
  const [hydrationFinished, setHydrationFinished] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => useAuthStore.persist.onFinishHydration(() => setHydrationFinished(true)), []);

  useEffect(() => {
    if (session?.token) {
      const sessionToken = session.token;
      enqueuePushRegistration(() =>
        registerPushTokenApi(
          sessionToken,
          () => useAuthStore.getState().session?.token === sessionToken
        )
      ).then((result) => {
        if (!result?.ok && !result?.stale) console.warn("Push registration unavailable", result?.message);
      });
    }
  }, [session?.token]);

  if (!hasHydrated && !hydrationFinished) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>NearFIX yuklanmoqda...</Text>
      </View>
    );
  }

  if (rootExperienceForSession(session) === "worker") {
    return <WorkerNavigator key={`worker-${navigationGeneration}`} />;
  }
  return <ClientNavigator key={discoveryNavigatorKey(invalidation, navigationGeneration)} />;
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
