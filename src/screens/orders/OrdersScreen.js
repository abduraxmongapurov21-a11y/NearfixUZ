import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ArrowRight, CalendarDays, ClipboardList, MapPin, MessageCircle, WalletCards } from "lucide-react-native";
import { ActiveOrderCard } from "../../components/orders/ActiveOrderCard";
import { CancelReasonSheet } from "../../components/orders/CancelReasonSheet";
import { ClientHeader } from "../../components/client/ClientHeader";
import { GlassSurface } from "../../components/client/GlassSurface";
import { colors, font, shadow, CLIENT_CONTENT_BOTTOM } from "../../theme/clientTheme";
import { useTranslation } from "react-i18next";
import { activeStatusKeys, TRACKING_STATUSES } from "../../constants/orderTracking";
import { ROUTES } from "../../constants/routes";
import { ensureOrderChatRoomApi } from "../../services/chats/chatService";
import { WorkerAvatar } from "../../components/ui/WorkerAvatar";
import { useAuthStore } from "../../store/authStore";
import { useClientStore } from "../../store/clientStore";
import { ReportModal } from "../../components/moderation/ReportModal";
import { SupportRequestModal } from "../../components/support/SupportRequestModal";
import { Alert, Text } from "../../i18n/native";
import { OrderRatingCard } from "../../components/orders/OrderRatingCard";
import { submitOrderReviewApi } from "../../services/orders/orderService";
import { useOrderRefresh } from "../../hooks/useOrderRefresh";
import { resolveOrderDetail } from "../../services/orders/orderRefreshLoop.mjs";

const statusCopy = {
  [TRACKING_STATUSES.REQUEST_SENT]: { label: "Kutilmoqda", tone: "warning" },
  [TRACKING_STATUSES.ACCEPTED]: { label: "Qabul qilindi", tone: "success" },
  [TRACKING_STATUSES.ON_THE_WAY]: { label: "Yo'lda", tone: "success" },
  [TRACKING_STATUSES.IN_PROGRESS]: { label: "Jarayonda", tone: "success" },
  [TRACKING_STATUSES.COMPLETED]: { label: "Yakunlandi", tone: "success" },
  [TRACKING_STATUSES.CANCELLED]: { label: "Bekor qilindi", tone: "danger" }
};

function uniqueOrders(orders) {
  const byId = new Map();
  orders.filter(Boolean).forEach((order) => byId.set(order.id, order));
  return Array.from(byId.values());
}

function resolveAmount(order) {
  const amount = order.amount || order.price;
  if (!amount || amount === "Kelishiladi") return "Kelishiladi";
  return amount;
}

export function OrdersScreen({ navigation, route }) {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const [tab, setTab] = useState("active");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reportOrderId, setReportOrderId] = useState(null);
  const [supportOrderId, setSupportOrderId] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [loadState, setLoadState] = useState({ loading: true, error: null });
  const orders = useClientStore((state) => state.orders);
  const activeOrder = useClientStore((state) => state.activeOrder);
  const workers = useClientStore((state) => state.workers);
  const cancelActiveOrder = useClientStore((state) => state.cancelActiveOrder);
  const syncOrdersFromApi = useClientStore((state) => state.syncOrdersFromApi);
  const syncCatalogFromApi = useClientStore((state) => state.syncCatalogFromApi);

  const refreshOrders = useCallback(
    async (options) => {
      const result = await syncOrdersFromApi(options);
      if (!result.stale)
        setLoadState({ loading: false, error: result.ok ? null : result.message || "Buyurtmalar yuklanmadi" });
      return result;
    },
    [syncOrdersFromApi]
  );
  useOrderRefresh(refreshOrders, "client");
  const detailOrder = resolveOrderDetail(orders, activeOrder, detailOrderId);

  useEffect(() => {
    const targetOrderId = route?.params?.orderId;
    if (!targetOrderId) return;
    setDetailOrderId(targetOrderId);
  }, [route?.params?.orderId]);

  const activeOrders = useMemo(
    () =>
      uniqueOrders([
        activeOrder && activeStatusKeys.includes(activeOrder.statusKey) ? activeOrder : null,
        ...orders.filter((order) => activeStatusKeys.includes(order.statusKey))
      ]),
    [activeOrder, orders]
  );

  const historyOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.statusKey === TRACKING_STATUSES.COMPLETED ||
          order.statusKey === TRACKING_STATUSES.CANCELLED ||
          !activeStatusKeys.includes(order.statusKey)
      ),
    [orders]
  );

  const detailWorker = {
    ...workers.find((worker) => worker.id === detailOrder?.workerId),
    availability: detailOrder?.workerAvailability
  };

  async function handleOpenChat(order) {
    if (!session?.token || !order?.id) {
      navigation.navigate(ROUTES.CHATS_TAB);
      return;
    }

    const result = await ensureOrderChatRoomApi(session.token, order.id, session.userId);
    if (result.ok) {
      navigation.navigate(ROUTES.CHAT_THREAD, { room: result.room });
      return;
    }

    navigation.navigate(ROUTES.CHATS_TAB);
  }

  async function handleCancel(reason) {
    const result = await cancelActiveOrder(reason, detailOrder?.id);
    if (!result.ok) {
      await syncOrdersFromApi();
      if (!result.stale) Alert.alert("Buyurtma bekor qilinmadi", result.message || "Qayta urinib ko'ring.");
      return;
    }
    setCancelOpen(false);
    setDetailOrderId(null);
    Alert.alert("Buyurtma bekor qilindi", "NearFIX support kerak bo'lsa yordam beradi.");
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  }

  async function handleReview(rating, comment) {
    if (!session?.token || !detailOrder?.id || reviewSubmitting) return;
    setReviewSubmitting(true);
    const result = await submitOrderReviewApi(session.token, detailOrder.id, rating, comment);
    setReviewSubmitting(false);

    if (!result.ok) {
      const duplicate = result.code === "ORDER_REVIEW_EXISTS";
      Alert.alert(
        duplicate ? "Baho allaqachon yuborilgan" : "Bahoni yuborib bo‘lmadi",
        result.message || "Qayta urinib ko‘ring."
      );
      if (duplicate) await syncOrdersFromApi();
      return;
    }

    await Promise.all([syncOrdersFromApi(), syncCatalogFromApi()]);
    Alert.alert("Rahmat!", "Bahoyingiz usta reytingiga qo‘shildi.");
  }

  if (detailOrder) {
    const canCancel = activeStatusKeys.includes(detailOrder.statusKey) && activeOrder?.id === detailOrder.id;

    return (
      <View style={styles.screen}>
        <ClientHeader title="Buyurtma holati" onBack={() => setDetailOrderId(null)} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.detailContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <ActiveOrderCard
            order={detailOrder}
            worker={detailWorker}
            onChat={() => handleOpenChat(detailOrder)}
            onCancel={canCancel ? () => setCancelOpen(true) : undefined}
            onReport={() => setReportOrderId(detailOrder.id)}
            onSupport={() => setSupportOrderId(detailOrder.id)}
          />
          {detailOrder.statusKey === TRACKING_STATUSES.COMPLETED ? (
            <OrderRatingCard key={detailOrder.id} review={detailOrder.review} submitting={reviewSubmitting} onSubmit={handleReview} />
          ) : null}
        </ScrollView>
        <CancelReasonSheet visible={cancelOpen} onClose={() => setCancelOpen(false)} onSelectReason={handleCancel} />
        <ReportModal
          visible={Boolean(reportOrderId)}
          targetType="ORDER"
          targetId={reportOrderId}
          title="Buyurtma muammosi haqida xabar berish"
          onClose={() => setReportOrderId(null)}
          onSuccess={() => Alert.alert("Shikoyat yuborildi", "Moderatorlar murojaatingizni ko‘rib chiqadi.")}
        />
        <SupportRequestModal
          visible={Boolean(supportOrderId)}
          orderId={supportOrderId}
          initialReason="Buyurtma bo‘yicha yordam"
          onClose={() => setSupportOrderId(null)}
          onSuccess={() => Alert.alert("Murojaat yuborildi", "Yordam jamoasi murojaatingizni ko‘rib chiqadi.")}
        />
      </View>
    );
  }

  const visibleOrders = tab === "active" ? activeOrders : historyOrders;

  return (
    <View style={styles.screen}>
      <ClientHeader title="Buyurtmalar" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <GlassSurface style={styles.segment}>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={t("Faol")}
            accessibilityState={{ selected: tab === "active" }}
            onPress={() => setTab("active")}
            style={[styles.segmentItem, tab === "active" && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, tab === "active" && styles.segmentTextActive]}>Faol</Text>
            {activeOrders.length > 0 ? (
              <Text translate={false} style={[styles.segmentCount, tab === "active" && styles.segmentTextActive]}>
                {activeOrders.length}
              </Text>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={t("Tarix")}
            accessibilityState={{ selected: tab === "history" }}
            onPress={() => setTab("history")}
            style={[styles.segmentItem, tab === "history" && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, tab === "history" && styles.segmentTextActive]}>Tarix</Text>
            {historyOrders.length > 0 ? (
              <Text translate={false} style={[styles.segmentCount, tab === "history" && styles.segmentTextActive]}>
                {historyOrders.length}
              </Text>
            ) : null}
          </Pressable>
        </GlassSurface>

        {loadState.error ? (
          <Pressable accessibilityRole="button" onPress={handleRefresh} style={styles.errorCard}>
            <Text style={styles.errorTitle}>Buyurtmalar yuklanmadi</Text>
            <Text style={styles.errorText}>{loadState.error}</Text>
            <Text style={styles.retryText}>Qayta urinish</Text>
          </Pressable>
        ) : null}

        <View style={styles.list}>
          {visibleOrders.length ? (
            visibleOrders.map((order) => (
              <OrderListCard
                key={`${order.id}-${order.statusKey}`}
                order={order}
                worker={workers.find((worker) => worker.id === order.workerId)}
                onChat={() => handleOpenChat(order)}
                onDetail={() => setDetailOrderId(order.id)}
              />
            ))
          ) : loadState.loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.emptyCopy}>Buyurtmalar yuklanmoqda...</Text>
            </View>
          ) : !loadState.error ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <ClipboardList size={30} color={colors.primary} strokeWidth={1.6} />
              </View>
              <Text style={styles.emptyTitle}>{tab === "active" ? "Faol buyurtma yo'q" : "Tarix hali bo'sh"}</Text>
              <Text style={styles.emptyCopy}>
                {tab === "active"
                  ? "Xizmat tanlang va mos ustaga buyurtma yuboring. Holatini shu yerda kuzatasiz."
                  : "Yakunlangan va bekor qilingan buyurtmalar shu yerda saqlanadi."}
              </Text>
              {tab === "active" ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate(ROUTES.HOME_TAB)}
                  style={styles.exploreButton}
                >
                  <Text style={styles.exploreText}>Xizmatlarni ko'rish</Text>
                  <ArrowRight size={18} color={colors.white} strokeWidth={1.8} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function OrderListCard({ order, worker, onChat, onDetail }) {
  const status = statusCopy[order.statusKey] || statusCopy[TRACKING_STATUSES.REQUEST_SENT];

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTop}>
        <WorkerAvatar worker={worker} size={50} radius={17} style={styles.avatar} />
        <View style={styles.orderTitleBlock}>
          <Text translate={false} style={styles.orderTitle} numberOfLines={2}>
            {order.title || order.service}
          </Text>
          <Text translate={!worker?.name && !order.provider} style={styles.provider} numberOfLines={1}>
            {worker?.name || order.provider || "NearFIX usta"}
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.dateRow}>
          <CalendarDays size={15} color={colors.subtle} strokeWidth={1.7} />
          <Text style={styles.dateText}>{order.date || "Sana ko'rsatilmagan"}</Text>
        </View>
        <View style={[styles.statusBadge, styles[`status_${status.tone}`]]}>
          <Text style={[styles.statusText, styles[`statusText_${status.tone}`]]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.metaStack}>
        <InfoLine icon={MapPin} text={order.address || "Manzil ko'rsatilmagan"} translate={!order.address} />
        <InfoLine icon={WalletCards} text={resolveAmount(order)} strong />
      </View>

      <View style={styles.divider} />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onChat}
          style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
        >
          <MessageCircle size={19} color={colors.primary} strokeWidth={1.8} />
          <Text style={styles.chatText}>Chat</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onDetail}
          style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}
        >
          <Text style={styles.detailButtonText}>Batafsil</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InfoLine({ icon: Icon, text, strong = false, translate = true }) {
  return (
    <View style={styles.infoLine}>
      <Icon size={17} color={colors.subtle} strokeWidth={1.7} />
      <Text translate={translate} style={[styles.infoText, strong && styles.infoTextStrong]} numberOfLines={strong ? 1 : 2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: CLIENT_CONTENT_BOTTOM, gap: 18 },
  segment: { minHeight: 54, borderRadius: 19, padding: 5, flexDirection: "row", backgroundColor: colors.surface },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentActive: { backgroundColor: colors.white, ...shadow },
  segmentText: { color: colors.muted, fontSize: 14, fontFamily: font.medium },
  segmentCount: { color: colors.muted, fontSize: 11, fontFamily: font.semi },
  segmentTextActive: { color: colors.primary, fontFamily: font.semi },
  list: { gap: 14 },
  orderCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 18,
    ...shadow
  },
  orderTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 17, backgroundColor: colors.surface },
  orderTitleBlock: { flex: 1, minWidth: 0 },
  orderTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontFamily: font.bold, letterSpacing: -0.2 },
  provider: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: font.regular },
  statusRow: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  dateRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  dateText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16, fontFamily: font.regular },
  statusBadge: {
    minHeight: 28,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center"
  },
  status_warning: { backgroundColor: "#FFF5E7" },
  status_success: { backgroundColor: colors.mintSoft },
  status_danger: { backgroundColor: "#FFF0F1" },
  statusText: { fontSize: 11, lineHeight: 16, fontFamily: font.semi },
  statusText_warning: { color: colors.warning },
  statusText_success: { color: colors.success },
  statusText_danger: { color: colors.danger },
  metaStack: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  infoLine: { minHeight: 20, flexDirection: "row", alignItems: "flex-start", gap: 9 },
  infoText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 19, fontFamily: font.regular },
  infoTextStrong: { color: colors.text, fontSize: 14, fontFamily: font.semi },
  divider: { height: 1, marginTop: 16, backgroundColor: colors.border },
  actions: { marginTop: 14, flexDirection: "row", gap: 10 },
  chatButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  chatText: { color: colors.primary, fontSize: 13, fontFamily: font.semi },
  detailButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  detailButtonText: { color: colors.white, fontSize: 13, fontFamily: font.semi },
  pressed: { opacity: 0.75 },
  detailContent: { paddingHorizontal: 20, paddingBottom: CLIENT_CONTENT_BOTTOM, gap: 14 },
  emptyCard: {
    marginTop: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 26,
    alignItems: "center",
    gap: 14,
    ...shadow
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: font.bold,
    textAlign: "center",
    letterSpacing: -0.5
  },
  emptyCopy: { color: colors.muted, fontSize: 13, lineHeight: 21, fontFamily: font.regular, textAlign: "center" },
  exploreButton: {
    alignSelf: "stretch",
    minHeight: 48,
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  exploreText: { color: colors.white, fontSize: 13, fontFamily: font.semi },
  loadingCard: { paddingVertical: 56, alignItems: "center", gap: 16 },
  errorCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F2DADD",
    backgroundColor: "#FFF5F6",
    padding: 16,
    gap: 6
  },
  errorTitle: { color: colors.danger, fontSize: 14, fontFamily: font.semi },
  errorText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: font.regular },
  retryText: { color: colors.primary, marginTop: 6, fontSize: 13, fontFamily: font.semi }
});
