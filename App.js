import React from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { colors } from "./src/theme";
import "./src/i18n";
import { Text } from "./src/i18n/native";

enableScreens();

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
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold
  });

  if (!fontsLoaded) {
    return <View style={styles.app} />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <SafeAreaView style={styles.app}>
          <NavigationContainer>
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
