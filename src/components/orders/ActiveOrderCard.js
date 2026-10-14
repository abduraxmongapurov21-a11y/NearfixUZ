import React from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import {
  ChevronRight,
  Flag,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  WalletCards
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { CountdownCard } from "./CountdownCard";
import { OrderTimeline } from "./OrderTimeline";
import { StatusBadge } from "./StatusBadge";
import { trackingStatusCopy, TRACKING_STATUSES } from "../../constants/orderTracking";
import { workerStatusCopy } from "../../constants/workerStatus";
import { env } from "../../constants/env";
import { WorkerAvatar } from "../ui/WorkerAvatar";
import { GlassSurface } from "../client/GlassSurface";
import { colors, font, radius, shadow } from "../../theme/clientTheme";
import { Alert, Text } from "../../i18n/native";

function WorkerSummary({ worker, order, onChat }) {
  const { t } = useTranslation();
  const statusCopy = workerStatusCopy[worker?.availability];
  const phoneCandidate = String(worker?.phone || "").replace(/[\s().-]/g, "");
  const phone = /^\+?\d{7,15}$/.test(phoneCandidate) ? phoneCandidate : null;

  async function handleCall() {
    if (!phone) return;
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      Alert.alert("Qo'ng'iroq qilish", "Telefon ilovasi ochilmadi. Qayta urinib ko'ring.");
    }
  }

  return (
    <View style={styles.workerSection}>
      <View style={styles.workerCard}>
        <WorkerAvatar worker={worker} size={50} radius={17} style={styles.avatar} />
        <View style={styles.workerBody}>
          <Text translate={!worker?.name && !order.provider} style={styles.workerName} numberOfLines={1}>
            {worker?.name || order.provider || "Usta"}
          </Text>
          <Text style={styles.workerMeta} numberOfLines={2}>
            {worker?.specialty || order.service || "Xizmat ko'rsatuvchi"}
          </Text>
          {statusCopy ? <Text style={styles.workerStatus}>{statusCopy.label}</Text> : null}
        </View>
        {phone ? (
          <GlassSurface style={styles.quickGlass}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Qo'ng'iroq qilish")}
              onPress={handleCall}
              style={styles.quickButton}
            >
              <Phone size={20} color={colors.primary} strokeWidth={1.8} />
            </Pressable>
          </GlassSurface>
        ) : null}
      </View>
      {onChat ? (
        <Pressable
          accessibilityRole="button"
          onPress={onChat}
          style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
        >
          <MessageCircle size={20} color={colors.white} strokeWidth={1.8} />
          <Text style={styles.chatText}>Chat</Text>
          <ChevronRight size={18} color={colors.white} strokeWidth={1.8} />
        </Pressable>
      ) : null}
      <Text style={styles.chatNote}>Chat faqat buyurtma tafsilotlari uchun.</Text>
    </View>
  );
}

export function ActiveOrderCard({ order, worker, onChat, onCancel, onReport, onSupport }) {
  if (!order) return null;
  const copy = trackingStatusCopy[order.statusKey] || trackingStatusCopy[TRACKING_STATUSES.REQUEST_SENT];
  const waitingForResponse = order.statusKey === TRACKING_STATUSES.REQUEST_SENT;
  const cancelled = order.statusKey === TRACKING_STATUSES.CANCELLED;
  const orderCode = String(order.publicCode || order.id || "").slice(0, 10);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <StatusBadge statusKey={order.statusKey} />
        <Text translate={false} style={styles.orderNumberText}>
          #{orderCode}
        </Text>
      </View>
      <View style={styles.titleBlock}>
        <Text translate={!order.title && !order.service} style={styles.title}>{order.title || order.service || copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
      </View>
      <View style={styles.orderInfo}>
        <View style={styles.infoRow}>
          <MapPin size={17} color={colors.subtle} strokeWidth={1.7} />
          <Text translate={!order.address} style={styles.infoText}>{order.address || "Manzil ko'rsatilmagan"}</Text>
        </View>
        <View style={styles.infoRow}>
          <WalletCards size={17} color={colors.subtle} strokeWidth={1.7} />
          <Text style={styles.amount}>{order.amount || order.price || "Kelishiladi"}</Text>
        </View>
      </View>
      {waitingForResponse ? <CountdownCard deadlineAt={order.responseDeadlineAt} /> : null}
      {!cancelled ? <OrderTimeline statusKey={order.statusKey} /> : null}
      <WorkerSummary worker={worker} order={order} onChat={onChat} />
      {env.paymentsEnabled ? (
        <View style={styles.paymentCard}>
          <ShieldCheck size={20} color={colors.success} strokeWidth={1.8} />
          <View style={styles.paymentBody}>
            <Text style={styles.paymentTitle}>To'lov ish yakunlangandan keyin</Text>
            <Text style={styles.paymentText}>
              Buyurtma NearFIX kafolati ostida. Narx yakuniy ish hajmidan keyin tasdiqlanadi.
            </Text>
          </View>
        </View>
      ) : null}
      <View style={styles.safetyActions}>
        {onSupport ? (
          <Pressable accessibilityRole="button" onPress={onSupport} style={styles.safetyButton}>
            <LifeBuoy size={19} color={colors.primary} strokeWidth={1.8} />
            <Text style={styles.supportText}>Yordam</Text>
            <ChevronRight size={17} color={colors.subtle} strokeWidth={1.7} />
          </Pressable>
        ) : null}
        {onReport ? (
          <Pressable accessibilityRole="button" onPress={onReport} style={styles.safetyButton}>
            <Flag size={19} color={colors.muted} strokeWidth={1.8} />
            <Text style={styles.reportText}>Muammo haqida xabar berish</Text>
            <ChevronRight size={17} color={colors.subtle} strokeWidth={1.7} />
          </Pressable>
        ) : null}
      </View>
      {!cancelled && onCancel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Buyurtmani bekor qilish</Text>
        </Pressable>
      ) : cancelled ? (
        <View style={styles.cancelledBox}>
          <Text style={styles.cancelledLabel}>Bekor qilish sababi</Text>
          <Text style={styles.cancelledText}>{order.cancellationReason || "Ko'rsatilmagan"}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 18,
    ...shadow
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  titleBlock: { gap: 5 },
  title: { color: colors.text, fontSize: 22, lineHeight: 29, fontFamily: font.bold, letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, fontFamily: font.regular },
  orderNumberText: { color: colors.subtle, fontSize: 10, fontFamily: font.medium },
  orderInfo: { gap: 11, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  infoText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 19, fontFamily: font.regular },
  amount: { color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: font.semi },
  workerSection: { gap: 10 },
  workerCard: {
    minHeight: 84,
    borderRadius: 18,
    backgroundColor: colors.background,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatar: { width: 50, height: 50, borderRadius: 17, backgroundColor: colors.white },
  workerBody: { flex: 1, minWidth: 0 },
  workerName: { color: colors.text, fontSize: 14, lineHeight: 19, fontFamily: font.semi },
  workerMeta: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 17, fontFamily: font.regular },
  workerStatus: { marginTop: 4, color: colors.primary, fontSize: 10, lineHeight: 15, fontFamily: font.medium },
  quickGlass: { width: 44, height: 44, borderRadius: 15 },
  quickButton: { flex: 1, alignItems: "center", justifyContent: "center" },
  chatButton: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9
  },
  chatText: { color: colors.white, fontSize: 14, fontFamily: font.semi },
  chatNote: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center", fontFamily: font.regular },
  paymentCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.mintSoft,
    padding: 14,
    flexDirection: "row",
    gap: 10
  },
  paymentBody: { flex: 1 },
  paymentTitle: { color: colors.text, fontSize: 13, lineHeight: 19, fontFamily: font.semi },
  paymentText: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: font.regular },
  safetyActions: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  safetyButton: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9 },
  supportText: { flex: 1, color: colors.primary, fontSize: 13, lineHeight: 19, fontFamily: font.medium },
  reportText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: font.medium },
  cancelButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F2DADD",
    backgroundColor: "#FFF5F6",
    alignItems: "center",
    justifyContent: "center",
    padding: 10
  },
  cancelText: { color: colors.danger, fontSize: 12, lineHeight: 18, fontFamily: font.semi },
  cancelledBox: { borderRadius: 14, backgroundColor: "#FFF5F6", padding: 14, gap: 5 },
  cancelledLabel: { color: colors.danger, fontSize: 12, fontFamily: font.semi },
  cancelledText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: font.regular },
  pressed: { opacity: 0.75 }
});
