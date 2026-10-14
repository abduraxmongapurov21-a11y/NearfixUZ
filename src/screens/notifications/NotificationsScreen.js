import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Bell, CheckCircle2 } from "lucide-react-native";
import { EmptyState } from "../../components/ui/EmptyState";
import { Header } from "../../components/ui/Header";
import { fetchNotificationsApi, markNotificationReadApi } from "../../services/notifications/notificationService";
import { useAuthStore } from "../../store/authStore";
import { colors, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";
import { navigateToNotificationTarget } from "../../services/notifications/notificationNavigation.mjs";
import { normalizeExperienceMode } from "../../navigation/experienceMode.mjs";
import { ClientHeader } from "../../components/client/ClientHeader";
import { GlassSurface } from "../../components/client/GlassSurface";
import { colors as clientColors, font as clientFont, shadow as clientShadow } from "../../theme/clientTheme";

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

function formatClientDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function NotificationsScreen({ navigation }) {
  const session = useAuthStore((state) => state.session);
  const isClient = normalizeExperienceMode(session?.role, session?.experienceMode) === "client";
  const token = session?.token;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readingId, setReadingId] = useState(null);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(null);
  const loadGeneration = useRef(0);
  const loadingMoreRef = useRef(false);
  const readGeneration = useRef(0);

  const unreadCount = useMemo(
    () => unreadTotal ?? notifications.filter((notification) => !notification.readAt).length,
    [notifications, unreadTotal]
  );

  const loadNotifications = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const readsAtRequest = readGeneration.current;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setPageError("");
    if (!token) {
      setNotifications([]);
      setNextCursor(null);
      setUnreadTotal(null);
      setLoading(false);
      return;
    }

    const identity = useAuthStore.getState().captureAuthRequest(token);
    const result = await fetchNotificationsApi(token);
    if (generation !== loadGeneration.current || !useAuthStore.getState().isAuthRequestCurrent(identity)) return;
    if (result.ok) {
      setNotifications((current) => {
        const readAtById = new Map(current.map((item) => [item.id, item.readAt]));
        return result.notifications.map((item) => ({ ...item, readAt: item.readAt || readAtById.get(item.id) || null }));
      });
      setError("");
      setNextCursor(result.nextCursor || null);
      if (readsAtRequest === readGeneration.current) setUnreadTotal(result.unreadCount ?? null);
    } else {
      setError(result.message || "Bildirishnomalarni yuklab bo‘lmadi.");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    setNotifications([]);
    setLoading(true);
    setError("");
    setReadingId(null);
    setNextCursor(null);
    setUnreadTotal(null);
    readGeneration.current = 0;
    loadNotifications();
    return () => { loadGeneration.current += 1; };
  }, [loadNotifications]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }

  async function handleLoadMore() {
    if (!token || !nextCursor || loadingMoreRef.current || refreshing) return;
    const generation = loadGeneration.current;
    const readsAtRequest = readGeneration.current;
    const identity = useAuthStore.getState().captureAuthRequest(token);
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setPageError("");
    const result = await fetchNotificationsApi(token, { cursor: nextCursor });
    if (generation !== loadGeneration.current || !useAuthStore.getState().isAuthRequestCurrent(identity)) return;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    if (!result.ok) {
      setPageError(result.message || "Bildirishnomalarni yuklab bo‘lmadi.");
      return;
    }
    setNotifications((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      for (const item of result.notifications) {
        byId.set(item.id, { ...item, readAt: item.readAt || byId.get(item.id)?.readAt || null });
      }
      return [...byId.values()];
    });
    setNextCursor(result.nextCursor || null);
    if (readsAtRequest === readGeneration.current && result.unreadCount !== undefined) setUnreadTotal(result.unreadCount);
  }

  async function handlePress(notification) {
    if (!token || readingId) return;
    const experienceMode = normalizeExperienceMode(session?.role, session?.experienceMode);
    const navigationResult = navigateToNotificationTarget(navigation, notification.payload, experienceMode);
    if (!navigationResult.ok) return;

    if (!notification.readAt) {
      const identity = useAuthStore.getState().captureAuthRequest(token);
      setReadingId(notification.id);
      const result = await markNotificationReadApi(token, notification.id);
      if (!useAuthStore.getState().isAuthRequestCurrent(identity)) return;
      setReadingId(null);
      if (result.ok) {
        readGeneration.current += 1;
        setUnreadTotal((current) => current === null ? null : Math.max(0, current - 1));
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, readAt: result.notification.readAt } : item))
        );
      }
    }
  }

  const loadMoreControl = nextCursor && !error ? (
    <View style={styles.pageFooter}>
      {pageError ? <Text style={isClient ? clientStyles.errorText : styles.errorText}>{pageError}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: loadingMore }}
        disabled={loadingMore || refreshing}
        onPress={handleLoadMore}
        style={isClient ? clientStyles.retryButton : styles.retryButton}
      >
        {loadingMore ? <ActivityIndicator color="#FFFFFF" /> : (
          <Text style={isClient ? clientStyles.retryText : styles.retryText}>
            {pageError ? "Qayta urinish" : "Ko'proq yuklash"}
          </Text>
        )}
      </Pressable>
    </View>
  ) : null;

  if (isClient) {
    return (
      <View style={clientStyles.screen}>
        <ClientHeader
          title="Bildirishnomalar"
          subtitle={unreadCount ? `${unreadCount} ta o'qilmagan` : "Barcha bildirishnomalar o'qilgan"}
          onBack={() => navigation.goBack()}
        />
        {loading ? (
          <View style={clientStyles.loading}>
            <ActivityIndicator color={clientColors.primary} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={clientStyles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={clientColors.primary}
                colors={[clientColors.primary]}
              />
            }
          >
            {error ? (
              <GlassSurface style={clientStyles.emptyState}>
                <Text style={clientStyles.errorText}>{error}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={loadNotifications}
                  style={({ pressed }) => [clientStyles.retryButton, pressed && clientStyles.pressed]}
                >
                  <Text style={clientStyles.retryText}>Qayta urinish</Text>
                </Pressable>
              </GlassSurface>
            ) : !notifications.length ? (
              <GlassSurface style={clientStyles.emptyState}>
                <View style={clientStyles.emptyIcon}>
                  <Bell size={28} color={clientColors.primary} strokeWidth={1.6} />
                </View>
                <Text style={clientStyles.emptyTitle}>Bildirishnoma yo'q</Text>
                <Text style={clientStyles.emptyText}>
                  Yangi buyurtma, chat va status xabarlari shu yerda ko'rinadi.
                </Text>
              </GlassSurface>
            ) : (
              notifications.map((notification) => {
                const unread = !notification.readAt;
                const title = readPayloadText(notification, "title", notification.type || "Bildirishnoma");
                const body = readPayloadText(notification, "body", "");
                return (
                  <Pressable
                    key={notification.id}
                    accessibilityRole="button"
                    disabled={Boolean(readingId)}
                    onPress={() => handlePress(notification)}
                    style={({ pressed }) => [
                      clientStyles.card,
                      unread && clientStyles.cardUnread,
                      pressed && clientStyles.pressed
                    ]}
                  >
                    <View style={[clientStyles.iconShell, unread && clientStyles.iconShellUnread]}>
                      {unread ? (
                        <Bell size={20} color={clientColors.primary} strokeWidth={1.8} />
                      ) : (
                        <CheckCircle2 size={20} color={clientColors.success} strokeWidth={1.8} />
                      )}
                    </View>
                    <View style={clientStyles.cardBody}>
                      <View style={clientStyles.cardHeader}>
                        <Text style={clientStyles.cardTitle} numberOfLines={2}>
                          {title}
                        </Text>
                        {unread ? <View style={clientStyles.unreadDot} /> : null}
                      </View>
                      {body ? <Text style={clientStyles.cardText}>{body}</Text> : null}
                      <Text translate={false} style={clientStyles.cardTime}>
                        {formatClientDate(notification.createdAt)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
            {loadMoreControl}
          </ScrollView>
        )}
      </View>
    );
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
          {error ? (
            <View style={styles.errorState}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={loadNotifications} style={styles.retryButton}>
                <Text style={styles.retryText}>Qayta urinish</Text>
              </Pressable>
            </View>
          ) : !notifications.length ? (
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
                  onPress={() => handlePress(notification)}
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
          {loadMoreControl}
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
  },
  errorState: {
    alignItems: "center",
    gap: 12,
    padding: 24
  },
  errorText: {
    color: colors.danger,
    textAlign: "center",
    fontWeight: "700"
  },
  retryButton: {
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11
  },
  retryText: {
    color: colors.white,
    fontWeight: "900"
  },
  pageFooter: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 12
  }
});

const clientStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: clientColors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 4, paddingBottom: 28, gap: 12 },
  card: {
    minHeight: 96,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: clientColors.border,
    backgroundColor: clientColors.white,
    padding: 16,
    flexDirection: "row",
    gap: 14,
    ...clientShadow
  },
  cardUnread: { borderColor: "#C9E6E6" },
  iconShell: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: clientColors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  iconShellUnread: { backgroundColor: clientColors.primarySoft },
  cardBody: { flex: 1, minWidth: 0, gap: 6 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, color: clientColors.text, fontSize: 15, lineHeight: 21, fontFamily: clientFont.semi },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: clientColors.primary },
  cardText: { color: clientColors.muted, fontSize: 13, lineHeight: 20, fontFamily: clientFont.regular },
  cardTime: { color: clientColors.subtle, fontSize: 11, lineHeight: 17, fontFamily: clientFont.regular },
  emptyState: { marginTop: 16, borderRadius: 28, paddingHorizontal: 24, paddingVertical: 32, alignItems: "center" },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: clientColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18
  },
  emptyTitle: {
    color: clientColors.text,
    fontSize: 20,
    lineHeight: 27,
    fontFamily: clientFont.semi,
    textAlign: "center"
  },
  emptyText: {
    marginTop: 8,
    color: clientColors.muted,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: clientFont.regular,
    textAlign: "center"
  },
  errorText: {
    color: clientColors.danger,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: clientFont.medium,
    textAlign: "center"
  },
  retryButton: {
    minHeight: 48,
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: clientColors.primary,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  retryText: { color: clientColors.white, fontSize: 14, fontFamily: clientFont.semi },
  pressed: { opacity: 0.78 }
});
