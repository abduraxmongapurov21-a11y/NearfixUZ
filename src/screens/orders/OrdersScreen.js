import React, { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ArrowLeft, CalendarDays, MapPin, MessageCircle, WalletCards } from "lucide-react-native";
import { ActiveOrderCard } from "../../components/orders/ActiveOrderCard";
import { CancelReasonSheet } from "../../components/orders/CancelReasonSheet";
import { EmptyState } from "../../components/ui/EmptyState";
import { activeStatusKeys, TRACKING_STATUSES } from "../../constants/orderTracking";
import { ROUTES } from "../../constants/routes";
import { ensureOrderChatRoomApi } from "../../services/chats/chatService";
import { WorkerAvatar } from "../../components/ui/WorkerAvatar";
import { useAuthStore } from "../../store/authStore";
import { useClientStore } from "../../store/clientStore";
import { ReportModal } from "../../components/moderation/ReportModal";
import { SupportRequestModal } from "../../components/support/SupportRequestModal";
import { Alert, Text } from "../../i18n/native";

const font = {
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold"
};

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
  if (!amount || amount === "Kelishiladi") return "Kelishilgan";
  return amount;
}

export function OrdersScreen({ navigation }) {
  const session = useAuthStore((state) => state.session);
  const [tab, setTab] = useState("active");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reportOrderId, setReportOrderId] = useState(null);
  const [supportOrderId, setSupportOrderId] = useState(null);
  const orders = useClientStore((state) => state.orders);
  const activeOrder = useClientStore((state) => state.activeOrder);
  const workers = useClientStore((state) => state.workers);
  const cancelActiveOrder = useClientStore((state) => state.cancelActiveOrder);
  const syncOrdersFromApi = useClientStore((state) => state.syncOrdersFromApi);

  useEffect(() => {
    syncOrdersFromApi();
  }, [syncOrdersFromApi]);

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

  const detailWorker = workers.find((worker) => worker.id === detailOrder?.workerId);

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
    await cancelActiveOrder(reason);
    setCancelOpen(false);
    setDetailOrder(null);
    Alert.alert("Buyurtma bekor qilindi", "NearFIX support kerak bo'lsa yordam beradi.");
  }

  async function handleRefresh() {
    setRefreshing(true);
    await syncOrdersFromApi();
    setRefreshing(false);
  }

  if (detailOrder) {
    const canCancel = activeStatusKeys.includes(detailOrder.statusKey) && activeOrder?.id === detailOrder.id;

    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.detailContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#0F80B7"
              colors={["#0F80B7"]}
            />
          }
        >
          <View style={styles.detailHeader}>
            <Pressable onPress={() => setDetailOrder(null)} style={styles.backButton}>
              <ArrowLeft size={23} color="#2D3748" strokeWidth={2.8} />
            </Pressable>
            <Text style={styles.detailTitle}>Buyurtma holati</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ActiveOrderCard
            order={detailOrder}
            worker={detailWorker}
            onChat={() => handleOpenChat(detailOrder)}
            onCancel={canCancel ? () => setCancelOpen(true) : undefined}
            onReport={() => setReportOrderId(detailOrder.id)}
            onSupport={() => setSupportOrderId(detailOrder.id)}
          />
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0F80B7" colors={["#0F80B7"]} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Buyurtmalar</Text>
        </View>

        <View style={styles.segment}>
          <Pressable
            onPress={() => setTab("active")}
            style={[styles.segmentItem, tab === "active" && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, tab === "active" && styles.segmentTextActive]}>Faol</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("history")}
            style={[styles.segmentItem, tab === "history" && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, tab === "history" && styles.segmentTextActive]}>Tarix</Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {visibleOrders.length ? (
            visibleOrders.map((order) => (
              <OrderListCard
                key={`${order.id}-${order.statusKey}`}
                order={order}
                worker={workers.find((worker) => worker.id === order.workerId)}
                onChat={() => handleOpenChat(order)}
                onDetail={() => setDetailOrder(order)}
              />
            ))
          ) : (
            <EmptyState
              title={tab === "active" ? "Faol buyurtma yo'q" : "Tarix hali bo'sh"}
              text={
                tab === "active"
                  ? "Yangi buyurtma yaratilgandan keyin u shu yerda card ko'rinishida chiqadi."
                  : "Yakunlangan va bekor qilingan buyurtmalar shu yerda saqlanadi."
              }
            />
          )}
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
        <WorkerAvatar worker={worker} size={56} radius={28} style={styles.avatar} />
        <View style={styles.orderTitleBlock}>
          <Text style={styles.orderTitle} numberOfLines={2}>
            {order.title || order.service}
          </Text>
          <Text style={styles.provider} numberOfLines={1}>
            {worker?.name || order.provider || "NearFIX usta"}
          </Text>
        </View>
        <View style={[styles.statusBadge, styles[`status_${status.tone}`]]}>
          <Text style={[styles.statusText, styles[`statusText_${status.tone}`]]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.metaStack}>
        <InfoLine icon={CalendarDays} text={order.date || "Bugun"} />
        <InfoLine icon={MapPin} text={order.address || "Manzil kiritilgan"} />
        <InfoLine icon={WalletCards} text={resolveAmount(order)} strong />
      </View>

      <View style={styles.divider} />

      <View style={styles.actions}>
        <Pressable onPress={onChat} style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}>
          <MessageCircle size={19} color="#0F80B7" strokeWidth={2.5} />
          <Text style={styles.chatText}>Chat</Text>
        </Pressable>
        <Pressable onPress={onDetail} style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}>
          <Text style={styles.detailButtonText}>Batafsil</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InfoLine({ icon: Icon, text, strong = false }) {
  return (
    <View style={styles.infoLine}>
      <Icon size={17} color="#A3ABB8" fill={Icon === WalletCards ? "#A3ABB8" : "transparent"} strokeWidth={2.6} />
      <Text style={[styles.infoText, strong && styles.infoTextStrong]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F0F9FB"
  },
  content: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 112,
    gap: 14,
    backgroundColor: "#F0F9FB"
  },
  header: {
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: "#2D3748",
    fontSize: 28,
    lineHeight: 34,
    fontFamily: font.extra
  },
  segment: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#CDEAF2",
    backgroundColor: "#EAF8FC",
    padding: 5,
    flexDirection: "row"
  },
  segmentItem: {
    flex: 1,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F719D",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 12,
    elevation: 3
  },
  segmentText: {
    color: "#818A99",
    fontSize: 17,
    fontFamily: font.extra
  },
  segmentTextActive: {
    color: "#0F80B7"
  },
  list: {
    gap: 12
  },
  orderCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 16,
    shadowColor: "#0F719D",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 5
  },
  orderTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E5EEF3"
  },
  orderTitleBlock: {
    flex: 1,
    paddingTop: 2
  },
  orderTitle: {
    color: "#101828",
    fontSize: 17,
    lineHeight: 22,
    fontFamily: font.extra
  },
  provider: {
    marginTop: 5,
    color: "#818A99",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: font.medium
  },
  statusBadge: {
    maxWidth: 102,
    minHeight: 34,
    borderRadius: 13,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  status_warning: {
    backgroundColor: "#FFF3E2"
  },
  status_success: {
    backgroundColor: "#DCF8EF"
  },
  status_danger: {
    backgroundColor: "#FEECEC"
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    fontFamily: font.extra
  },
  statusText_warning: {
    color: "#FB8C00"
  },
  statusText_success: {
    color: "#19B982"
  },
  statusText_danger: {
    color: "#EF4444"
  },
  metaStack: {
    marginTop: 16,
    gap: 10
  },
  infoLine: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  infoText: {
    flex: 1,
    color: "#667085",
    fontSize: 14,
    lineHeight: 19,
    fontFamily: font.medium
  },
  infoTextStrong: {
    color: "#101828",
    fontFamily: font.extra
  },
  divider: {
    height: 1,
    marginTop: 15,
    backgroundColor: "#E7ECF0"
  },
  actions: {
    marginTop: 15,
    flexDirection: "row",
    gap: 12
  },
  chatButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D8EFF6",
    backgroundColor: "#F2FBFE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  chatText: {
    color: "#0F80B7",
    fontSize: 16,
    fontFamily: font.extra
  },
  detailButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#1597A9",
    alignItems: "center",
    justifyContent: "center"
  },
  detailButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: font.extra
  },
  pressed: {
    opacity: 0.78
  },
  detailContent: {
    padding: 16,
    paddingTop: 42,
    paddingBottom: 112,
    gap: 12,
    backgroundColor: "#F0F9FB"
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  detailTitle: {
    color: "#2D3748",
    fontSize: 18,
    fontFamily: font.extra
  },
  headerSpacer: {
    width: 46
  }
});
