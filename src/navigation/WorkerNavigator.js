import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { WorkerTabBar } from "../components/navigation/WorkerTabBar";
import { ROUTES } from "../constants/routes";
import { ChatScreen } from "../screens/chats/ChatScreen";
import { ChatThreadScreen } from "../screens/chats/ChatThreadScreen";
import { MapPickerScreen } from "../screens/maps/MapPickerScreen";
import { NotificationsScreen } from "../screens/notifications/NotificationsScreen";
import { WorkerDashboardScreen } from "../screens/worker/WorkerDashboardScreen";
import { WorkerEarningsScreen } from "../screens/worker/WorkerEarningsScreen";
import { WorkerJobsScreen } from "../screens/worker/WorkerJobsScreen";
import { WorkerProfileManageScreen } from "../screens/worker/WorkerProfileManageScreen";
import { WorkerSupportScreen } from "../screens/worker/WorkerSupportScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function WorkerTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <WorkerTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name={ROUTES.WORKER_DASHBOARD_TAB} component={WorkerDashboardScreen} />
      <Tab.Screen name={ROUTES.WORKER_JOBS_TAB} component={WorkerJobsScreen} />
      <Tab.Screen name={ROUTES.WORKER_CHATS_TAB} component={ChatScreen} />
      <Tab.Screen name={ROUTES.WORKER_EARNINGS_TAB} component={WorkerEarningsScreen} />
      <Tab.Screen name={ROUTES.WORKER_PROFILE_TAB} component={WorkerProfileManageScreen} />
      <Tab.Screen name={ROUTES.WORKER_SUPPORT_TAB} component={WorkerSupportScreen} />
    </Tab.Navigator>
  );
}

export function WorkerNavigator() {
  return (
    <Stack.Navigator initialRouteName={ROUTES.WORKER_TABS} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.WORKER_TABS} component={WorkerTabs} />
      <Stack.Screen name={ROUTES.CHATS_TAB} component={ChatScreen} />
      <Stack.Screen name={ROUTES.MAP_PICKER} component={MapPickerScreen} />
      <Stack.Screen name={ROUTES.CHAT_THREAD} component={ChatThreadScreen} />
      <Stack.Screen name={ROUTES.NOTIFICATIONS} component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
