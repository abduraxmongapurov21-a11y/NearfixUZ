import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BottomTabBar } from "../components/navigation/BottomTabBar";
import { ROUTES } from "../constants/routes";
import { BookingScreen } from "../screens/marketplace/BookingScreen";
import { CategoryScreen } from "../screens/marketplace/CategoryScreen";
import { HomeScreen } from "../screens/marketplace/HomeScreen";
import { WorkerProfileScreen } from "../screens/marketplace/WorkerProfileScreen";
import { ChatScreen } from "../screens/chats/ChatScreen";
import { ChatThreadScreen } from "../screens/chats/ChatThreadScreen";
import { MapPickerScreen } from "../screens/maps/MapPickerScreen";
import { NotificationsScreen } from "../screens/notifications/NotificationsScreen";
import { OrdersScreen } from "../screens/orders/OrdersScreen";
import { ClientProfileScreen } from "../screens/profile/ClientProfileScreen";
import { BecomeWorkerScreen } from "../screens/worker/BecomeWorkerScreen";
import { SessionInvalidatedScreen } from "../screens/auth/SessionInvalidatedScreen";
import { AuthNavigator } from "./AuthNavigator";
import { useAuthStore } from "../store/authStore";
import { GuestProfileScreen } from "../screens/profile/GuestProfileScreen";
import { requireRouteAuthentication } from "./protectedActions";
import { guestRouteDecision } from "./routeProtection.mjs";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function protectScreen(Component, routeName) {
  return function ProtectedClientScreen(props) {
    const session = useAuthStore((state) => state.session);
    useEffect(() => {
      if (!session) {
        const rootNavigation = props.navigation.getParent() || props.navigation;
        const decision = guestRouteDecision(routeName, props.route?.params);
        requireRouteAuthentication(rootNavigation, decision.intent);
      }
    }, [props.navigation, props.route?.params, session]);

    if (!session) {
      return <View style={styles.protectedLoading}><ActivityIndicator color={colors.primary} /></View>;
    }
    return <Component {...props} />;
  };
}

const styles = StyleSheet.create({
  protectedLoading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }
});

const ProtectedOrdersScreen = protectScreen(OrdersScreen, ROUTES.ORDERS_TAB);
const ProtectedChatScreen = protectScreen(ChatScreen, ROUTES.CHATS_TAB);
const ProtectedBookingScreen = protectScreen(BookingScreen, ROUTES.BOOKING);
const ProtectedMapPickerScreen = protectScreen(MapPickerScreen, ROUTES.MAP_PICKER);
const ProtectedChatThreadScreen = protectScreen(ChatThreadScreen, ROUTES.CHAT_THREAD);
const ProtectedNotificationsScreen = protectScreen(NotificationsScreen, ROUTES.NOTIFICATIONS);
const ProtectedBecomeWorkerScreen = protectScreen(BecomeWorkerScreen, ROUTES.BECOME_WORKER);

function ClientTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <BottomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name={ROUTES.HOME_TAB} component={HomeScreen} />
      <Tab.Screen name={ROUTES.ORDERS_TAB} component={ProtectedOrdersScreen} />
      <Tab.Screen name={ROUTES.CHATS_TAB} component={ProtectedChatScreen} />
      <Tab.Screen name={ROUTES.PROFILE_TAB} component={ProfileEntryScreen} />
    </Tab.Navigator>
  );
}

function ProfileEntryScreen(props) {
  const session = useAuthStore((state) => state.session);
  return session ? <ClientProfileScreen {...props} /> : <GuestProfileScreen {...props} />;
}

export function ClientNavigator() {
  const invalidation = useAuthStore((state) => state.invalidation);
  return (
    <Stack.Navigator
      initialRouteName={invalidation ? ROUTES.SESSION_INVALIDATED : ROUTES.CLIENT_TABS}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name={ROUTES.CLIENT_TABS} component={ClientTabs} />
      <Stack.Screen name={ROUTES.CATEGORY} component={CategoryScreen} />
      <Stack.Screen name={ROUTES.WORKER_PROFILE} component={WorkerProfileScreen} />
      <Stack.Screen name={ROUTES.BOOKING} component={ProtectedBookingScreen} />
      <Stack.Screen name={ROUTES.MAP_PICKER} component={ProtectedMapPickerScreen} />
      <Stack.Screen name={ROUTES.CHAT_THREAD} component={ProtectedChatThreadScreen} />
      <Stack.Screen name={ROUTES.NOTIFICATIONS} component={ProtectedNotificationsScreen} />
      <Stack.Screen name={ROUTES.BECOME_WORKER} component={ProtectedBecomeWorkerScreen} />
      <Stack.Screen name={ROUTES.SESSION_INVALIDATED} component={SessionInvalidatedScreen} />
      <Stack.Screen name={ROUTES.AUTH_FLOW} component={AuthNavigator} options={{ presentation: "modal", gestureEnabled: true }} />
    </Stack.Navigator>
  );
}
