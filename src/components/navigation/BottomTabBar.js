import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ClipboardList, Home, MessageCircle, UserRound } from "lucide-react-native";
import { colors, strongShadow } from "../../theme";
import { ROUTES } from "../../constants/routes";
import { translate } from "../../i18n/translations";
import { fetchChatRoomsApi } from "../../services/chats/chatService";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { Text } from "../../i18n/native";

const tabMeta = {
  [ROUTES.HOME_TAB]: { labelKey: "home", icon: Home },
  [ROUTES.ORDERS_TAB]: { labelKey: "orders", icon: ClipboardList },
  [ROUTES.CHATS_TAB]: { labelKey: "chats", icon: MessageCircle, dot: true },
  [ROUTES.PROFILE_TAB]: { labelKey: "profile", icon: UserRound }
};

export function BottomTabBar({ state, descriptors, navigation }) {
  const locale = useUiStore((store) => store.locale);
  const session = useAuthStore((store) => store.session);
  const [unreadChats, setUnreadChats] = useState(0);
  const leftRoutes = state.routes.slice(0, 2);
  const rightRoutes = state.routes.slice(2);

  useEffect(() => {
    let mounted = true;

    async function loadUnreadChats() {
      if (!session?.token) {
        if (mounted) setUnreadChats(0);
        return;
      }

      const result = await fetchChatRoomsApi(session.token, undefined, session.userId);
      if (mounted && result.ok) {
        setUnreadChats(result.rooms.reduce((sum, room) => sum + (room.unread || 0), 0));
      }
    }

    loadUnreadChats();
    const timer = setInterval(loadUnreadChats, 10000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [session?.token, session?.userId, state.index]);

  function renderTab(route, index) {
    const focused = state.index === index;
    const options = descriptors[route.key].options;
    const Icon = tabMeta[route.name]?.icon || Home;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        onPress={() => navigation.navigate(route.name)}
        style={styles.tab}
      >
        <View>
          <Icon
            size={25}
            color={focused ? "#0F80B7" : "#A0A7B3"}
            fill={route.name === ROUTES.HOME_TAB && focused ? "#0F80B7" : "transparent"}
            strokeWidth={2.6}
          />
          {route.name === ROUTES.CHATS_TAB && unreadChats > 0 ? (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>{unreadChats > 99 ? "99+" : unreadChats}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, focused && styles.labelActive]}>
          {translate(locale, tabMeta[route.name]?.labelKey)}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {leftRoutes.map((route, index) => renderTab(route, index))}
        {rightRoutes.map((route, index) => renderTab(route, index + 2))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 0
  },
  bar: {
    minHeight: 86,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    ...strongShadow
  },
  tab: {
    flex: 1,
    minHeight: 66,
    alignItems: "center",
    justifyContent: "center",
    gap: 5
  },
  label: {
    color: "#A0A7B3",
    fontSize: 14,
    fontFamily: "Inter_700Bold"
  },
  labelActive: {
    color: "#0F80B7"
  },
  notificationBadge: {
    position: "absolute",
    top: -7,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2CD8A5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5
  },
  notificationText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: "Inter_800ExtraBold"
  }
});
