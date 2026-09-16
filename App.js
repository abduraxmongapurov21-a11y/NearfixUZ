import React, { useCallback, useEffect, useRef } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { colors } from "./src/theme";
import "./src/i18n";
import { Text } from "./src/i18n/native";
import { useAuthStore } from "./src/store/authStore";
import { processNotificationResponse } from "./src/services/notifications/notificationNavigation.mjs";

enableScreens();

const navigationRef = createNavigationContainerRef();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorState}>
          <Text style={styles.errorTitle}>Ilova vaqtincha ishlamayapti</Text>
          <Text style={styles.errorText}>Iltimos, ilovani qayta ochib ko'ring.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const handledNotificationId = useRef(null);
  const processingNotificationId = useRef(null);
  const pendingNotificationResponse = useRef(null);
  const session = useAuthStore((state) => state.session);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold
  });

  const handleNotificationResponse = useCallback((response) => {
    const identifier = response?.notification?.request?.identifier;
    if (!identifier || identifier === processingNotificationId.current) return false;

    processingNotificationId.current = identifier;
    try {
      const result = processNotificationResponse({
        navigation: navigationRef,
        response,
        session: useAuthStore.getState().session,
        handledIdentifier: handledNotificationId.current
      });

      if (result.status === "handled") {
        handledNotificationId.current = result.identifier;
        pendingNotificationResponse.current = null;
        return true;
      }

      if (result.status === "pending") pendingNotificationResponse.current = response;
      return false;
    } finally {
      processingNotificationId.current = null;
    }
  }, []);

  useEffect(() => {
    const handleResponse = (response) => handleNotificationResponse(response);

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    Notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => null);
    return () => subscription.remove();
  }, [handleNotificationResponse]);

  useEffect(() => {
    if (pendingNotificationResponse.current) handleNotificationResponse(pendingNotificationResponse.current);
  }, [handleNotificationResponse, session?.experienceMode, session?.role, session?.userId]);

  if (!fontsLoaded) {
    return <View style={styles.app} />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <SafeAreaView style={styles.app}>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => handleNotificationResponse(pendingNotificationResponse.current)}
            onStateChange={() => handleNotificationResponse(pendingNotificationResponse.current)}
          >
            <StatusBar barStyle="dark-content" />
            <AppNavigator />
          </NavigationContainer>
        </SafeAreaView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background
  },
  errorTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  errorText: {
    marginTop: 8,
    color: colors.muted,
    textAlign: "center",
    fontWeight: "600"
  }
});
