import React, { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, View } from "react-native";
import { ClipboardList, Home, MessageCircle, UserRound } from "lucide-react-native";
import { GlassSurface } from "./GlassSurface";
import { colors, font, strongShadow } from "../../theme/clientTheme";
import { ROUTES } from "../../constants/routes";
import { Text } from "../../i18n/native";
import { translate } from "../../i18n/translations";
import { useUiStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import { refreshChatRooms, useChatStore } from "../../store/chatStore";
import { useChatRefresh } from "../../hooks/useChatRefresh";
import { chatUnreadCount } from "../../services/chats/chatSync.mjs";
import { requireAuthentication } from "../../navigation/protectedActions";
import { openClientTab } from "../../navigation/clientTabNavigation";

const tabs = [
  { route: ROUTES.HOME_TAB, label: "home", icon: Home },
  { route: ROUTES.ORDERS_TAB, label: "orders", icon: ClipboardList },
  { route: ROUTES.CHATS_TAB, label: "chats", icon: MessageCircle },
  { route: ROUTES.PROFILE_TAB, label: "profile", icon: UserRound }
];

export function ClientDock({
  navigation,
  activeRoute = ROUTES.HOME_TAB,
  onSelect,
  onLongPress,
  keyboardVisible = false
}) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () =>
      setKeyboardOpen(true)
    );
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () =>
      setKeyboardOpen(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const locale = useUiStore((store) => store.locale);
  const session = useAuthStore((store) => store.session);
  const unread = useChatStore((store) => chatUnreadCount(store.rooms));
  useChatRefresh(refreshChatRooms);
  if (keyboardVisible || keyboardOpen) return null;
  function select(route) {
    if (onSelect) {
      onSelect(route);
      return;
    }
    if (!session && route !== ROUTES.HOME_TAB && route !== ROUTES.PROFILE_TAB) {
      requireAuthentication(navigation, { kind: "PROTECTED_ROUTE", routeName: route });
      return;
    }
    openClientTab(navigation, route);
  }
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.shadow}>
        <GlassSurface style={styles.bar} intensity={65}>
          {tabs.map(({ route, label, icon: Icon }) => {
            const active = activeRoute === route;
            const title = translate(locale, label);
            return (
              <Pressable
                key={route}
                accessibilityRole="tab"
                accessibilityLabel={title}
                accessibilityState={{ selected: active }}
                onPress={() => select(route)}
                onLongPress={() => onLongPress?.(route)}
                style={({ pressed }) => [styles.tab, active && styles.activeTab, pressed && styles.pressed]}
              >
                <View>
                  <Icon size={22} color={active ? colors.primaryDark : colors.muted} strokeWidth={active ? 2.1 : 1.7} />
                  {route === ROUTES.CHATS_TAB && unread > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
                    </View>
                  ) : null}
                </View>
                <Text translate={false} numberOfLines={1} style={[styles.label, active && styles.activeLabel]}>
                  {title}
                </Text>
              </Pressable>
            );
          })}
        </GlassSurface>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { position: "absolute", bottom: 12, left: 16, right: 16, alignItems: "center" },
  shadow: { width: "100%", maxWidth: 540, borderRadius: 30, ...strongShadow },
  bar: { minHeight: 76, borderRadius: 30, padding: 7, flexDirection: "row", alignItems: "center", gap: 3 },
  tab: {
    flex: 1,
    minHeight: 60,
    paddingHorizontal: 2,
    paddingVertical: 9,
    borderRadius: 23,
    gap: 5,
    alignItems: "center",
    justifyContent: "center"
  },
  activeTab: { backgroundColor: "rgba(8,126,139,0.10)" },
  label: { color: colors.muted, fontSize: 10, lineHeight: 14, fontFamily: font.medium },
  activeLabel: { color: colors.primaryDark, fontFamily: font.bold },
  badge: {
    position: "absolute",
    top: -6,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.white
  },
  badgeText: { color: colors.white, fontSize: 9, fontFamily: font.bold },
  pressed: { opacity: 0.65 }
});
