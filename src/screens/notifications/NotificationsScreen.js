import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Bell, CheckCircle2 } from "lucide-react-native";
import { EmptyState } from "../../components/ui/EmptyState";
import { Header } from "../../components/ui/Header";
import { fetchNotificationsApi, markNotificationReadApi } from "../../services/notifications/notificationService";
import { useAuthStore } from "../../store/authStore";
import { colors, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

function readPayloadText(notification, key, fallback = "") {
  const payload = notification?.payload;
  return payload && typeof payload === "object" && typeof payload[key] === "string" ? payload[key] : fallback;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function NotificationsScreen({ navigation }) {
  const token = useAuthStore((state) => state.session?.token);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readingId, setReadingId] = useState(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );

  const loadNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const result = await fetchNotificationsApi(token);
    if (result.ok) {
      setNotifications(result.notifications);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }

  async function handleRead(notification) {
    if (!token || notification.readAt || readingId) return;

    setReadingId(notification.id);
    const result = await markNotificationReadApi(token, notification.id);
    setReadingId(null);

    if (result.ok) {
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, readAt: result.notification.readAt } : item))
      );
    }
  }

  return (
    <View style={styles.screen}>
      <Header title="Bildirishnomalar" onBack={() => navigation.goBack()} />
      <Text style={styles.subtitle}>
        {unreadCount ? `${unreadCount} ta o'qilmagan` : "Barcha bildirishnomalar o'qilgan"}
      </Text>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {!notifications.length ? (
            <EmptyState
              title="Bildirishnoma yo'q"
              text="Yangi buyurtma, chat va status xabarlari shu yerda ko'rinadi."
            />
          ) : (
            notifications.map((notification) => {
              const unread = !notification.readAt;
              const title = readPayloadText(notification, "title", notification.type || "Bildirishnoma");
              const body = readPayloadText(notification, "body", "");

              return (
                <Pressable
                  key={notification.id}
                  onPress={() => handleRead(notification)}
                  style={({ pressed }) => [styles.card, unread && styles.cardUnread, pressed && styles.pressed]}
                >
                  <View style={[styles.iconShell, unread && styles.iconShellUnread]}>
                    {unread ? (
                      <Bell size={19} color={colors.primary} strokeWidth={2.6} />
                    ) : (
                      <CheckCircle2 size={19} color={colors.success} strokeWidth={2.6} />
                    )}
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      {unread ? <View style={styles.unreadDot} /> : null}
                    </View>
                    {body ? <Text style={styles.cardText}>{body}</Text> : null}
                    <Text style={styles.cardTime}>{formatDate(notification.createdAt)}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 18,
    paddingBottom: 0
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  list: {
    paddingTop: 16,
    paddingBottom: 28,
    gap: 12
  },
  card: {
    minHeight: 82,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    ...shadow
  },
  cardUnread: {
    borderColor: "#BEE7F3"
  },
  pressed: {
    opacity: 0.82
  },
  iconShell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  iconShellUnread: {
    backgroundColor: "#EAF8FC"
  },
  cardBody: {
    flex: 1,
    gap: 5
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary
  },
  cardText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600"
  },
  cardTime: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: "800"
  }
});
