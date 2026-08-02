import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ROUTES } from "../constants/routes";
import { useAuthStore } from "../store/authStore";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { OtpScreen } from "../screens/auth/OtpScreen";
import { DemoPasswordScreen } from "../screens/auth/DemoPasswordScreen";
import { SessionInvalidatedScreen } from "../screens/auth/SessionInvalidatedScreen";
import { OnboardingBookingScreen } from "../screens/onboarding/OnboardingBookingScreen";
import { OnboardingTrustScreen } from "../screens/onboarding/OnboardingTrustScreen";

const Stack = createNativeStackNavigator();

export function AuthNavigator() {
  const invalidation = useAuthStore((state) => state.invalidation);

  return (
    <Stack.Navigator
      key={invalidation ? "invalidated" : "auth"}
      initialRouteName={invalidation ? ROUTES.SESSION_INVALIDATED : ROUTES.ONBOARDING_TRUST}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name={ROUTES.ONBOARDING_TRUST} component={OnboardingTrustScreen} />
      <Stack.Screen name={ROUTES.ONBOARDING_BOOKING} component={OnboardingBookingScreen} />
      <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
      <Stack.Screen name={ROUTES.AUTH_OTP} component={OtpScreen} />
      <Stack.Screen name={ROUTES.DEMO_PASSWORD} component={DemoPasswordScreen} />
      <Stack.Screen name={ROUTES.SESSION_INVALIDATED} component={SessionInvalidatedScreen} />
    </Stack.Navigator>
  );
}
