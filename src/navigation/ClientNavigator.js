import React from "react";
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function ClientTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <BottomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name={ROUTES.HOME_TAB} component={HomeScreen} />
      <Tab.Screen name={ROUTES.ORDERS_TAB} component={OrdersScreen} />
      <Tab.Screen name={ROUTES.CHATS_TAB} component={ChatScreen} />
      <Tab.Screen name={ROUTES.PROFILE_TAB} component={ClientProfileScreen} />
    </Tab.Navigator>
  );
}

export function ClientNavigator() {
  return (
    <Stack.Navigator initialRouteName={ROUTES.CLIENT_TABS} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.CLIENT_TABS} component={ClientTabs} />
      <Stack.Screen name={ROUTES.CATEGORY} component={CategoryScreen} />
      <Stack.Screen name={ROUTES.WORKER_PROFILE} component={WorkerProfileScreen} />
      <Stack.Screen name={ROUTES.BOOKING} component={BookingScreen} />
      <Stack.Screen name={ROUTES.MAP_PICKER} component={MapPickerScreen} />
      <Stack.Screen name={ROUTES.CHAT_THREAD} component={ChatThreadScreen} />
      <Stack.Screen name={ROUTES.NOTIFICATIONS} component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
