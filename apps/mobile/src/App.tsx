import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { MainTabParamList, RootStackParamList } from './navigation/types';
import { ContactsTabScreen, ContactSelectionScreen } from './screens/ContactsScreen';
import { ConversationScreen } from './screens/ConversationScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SessionRestoreScreen } from './screens/SessionRestoreScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AppStoreProvider } from './store/AppStore';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const tabIcons: Record<keyof MainTabParamList, string> = {
  Chats: '●',
  Contacts: '♙',
  Settings: '⚙',
};

function MainTabs() {
  return (
    <Tabs.Navigator
      initialRouteName="Chats"
      screenOptions={({ route }: { route: { name: keyof MainTabParamList } }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1677FF',
        tabBarInactiveTintColor: '#98A2B3',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { borderTopColor: '#EAECF0', height: 62, paddingBottom: 6, paddingTop: 6 },
        tabBarIcon: ({ color }: { color: string }) => <Text style={{ color, fontSize: 19 }}>{tabIcons[route.name]}</Text>,
      })}
    >
      <Tabs.Screen name="Chats" component={HomeScreen} options={{ title: 'Chatlar' }} />
      <Tabs.Screen name="Contacts" component={ContactsTabScreen} options={{ title: 'Kontaktlar' }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ title: 'Sozlamalar' }} />
    </Tabs.Navigator>
  );
}

function AuthenticatedApp() {
  return (
    <AppStoreProvider>
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="MainTabs" component={MainTabs} />
          <RootStack.Screen name="Conversation" component={ConversationScreen} />
          <RootStack.Screen name="ContactSelection" component={ContactSelectionScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    </AppStoreProvider>
  );
}

function AuthGate() {
  const { status } = useAuth();
  if (status === 'restoring' || status === 'error') return <SessionRestoreScreen />;
  if (status === 'unauthenticated') return <LoginScreen />;
  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
