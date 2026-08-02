import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BriefcaseBusiness, DollarSign, Home, MessageCircle, UserRound } from "lucide-react-native";
import { ROUTES } from "../../constants/routes";
import { fetchChatRoomsApi } from "../../services/chats/chatService";
import { useAuthStore } from "../../store/authStore";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

const tabMeta = {
  [ROUTES.WORKER_DASHBOARD_TAB]: { label: "Bosh", icon: Home },
  [ROUTES.WORKER_JOBS_TAB]: { label: "Ishlar", icon: BriefcaseBusiness },
  [ROUTES.WORKER_CHATS_TAB]: { label: "Chat", icon: MessageCircle },
  [ROUTES.WORKER_EARNINGS_TAB]: { label: "Daromad", icon: DollarSign },
  [ROUTES.WORKER_PROFILE_TAB]: { label: "Profil", icon: UserRound }
};

export function WorkerTabBar({ state, descriptors, navigation }) {
  const session = useAuthStore((store) => store.session);
  const [unreadChats, setUnreadChats] = useState(0);
  const visibleRoutes = state.routes.filter((route) => tabMeta[route.name]);

  useEffect(() => {
    let mounted = true;

    async function loadUnreadChats() {
      if (!session?.token) {
        setUnreadChats(0);
        return;
      }

      const result = await fetchChatRoomsApi(session.token, undefined, session.userId);
      if (mounted && result.ok) {
        setUnreadChats(result.rooms.reduce((sum, room) => sum + (room.unread || 0), 0));
      }
    }

    loadUnreadChats();

    return () => {
      mounted = false;
    };
  }, [session?.token, session?.userId]);

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex((item) => item.key === route.key);
          const focused = state.index === routeIndex;
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
              <View style={styles.iconWrap}>
                {route.name === ROUTES.WORKER_CHATS_TAB && unreadChats > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadChats > 99 ? "99+" : unreadChats}</Text>
                  </View>
                ) : null}
                <View style={[styles.iconShell, focused && styles.iconShellActive]}>
                  <Icon size={iconSizes.md} color={focused ? colors.white : "#8CA2BD"} strokeWidth={2.2} />
                </View>
              </View>
              <Text style={[styles.label, focused && styles.labelActive]}>{tabMeta[route.name]?.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0
  },
  bar: {
    minHeight: 84,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 8
  },
  tab: {
    flex: 1,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  iconWrap: {
    width: 42,
    height: 38,
    alignItems: "center",
    justifyContent: "center"
  },
  iconShell: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  badge: {
    position: "absolute",
    top: -2,
    right: 4,
    zIndex: 2,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: "#FF6B1A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900"
  },
  iconShellActive: {
    backgroundColor: "#1F1E42"
  },
  label: {
    color: "#B3C1D5",
    fontSize: 10,
    fontWeight: "800"
  },
  labelActive: {
    color: "#1F1E42"
  }
});
