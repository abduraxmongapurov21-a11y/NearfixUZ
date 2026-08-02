import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Camera, Flag, LifeBuoy, MessageCircle, Phone, ShieldCheck, Video } from "lucide-react-native";
import { CountdownCard } from "./CountdownCard";
import { OrderTimeline } from "./OrderTimeline";
import { StatusBadge } from "./StatusBadge";
import { trackingStatusCopy, TRACKING_STATUSES } from "../../constants/orderTracking";
import { workerStatusCopy } from "../../constants/workerStatus";
import { env } from "../../constants/env";
import { WorkerAvatar } from "../ui/WorkerAvatar";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

function WorkerSummary({ worker, onChat }) {
  const statusCopy = workerStatusCopy[worker?.availability];

  return (
    <View style={styles.workerCard}>
      <WorkerAvatar worker={worker} size={54} radius={radius.lg} style={styles.avatar} />
      <View style={styles.workerBody}>
        <Text style={styles.workerName}>{worker?.name || "Usta"}</Text>
        <Text style={styles.workerMeta}>{worker?.specialty || "Xizmat ko'rsatuvchi"}</Text>
        <Text style={styles.workerStatus}>{statusCopy?.label || "Holat noma'lum"}</Text>
      </View>
      <View style={styles.quickActions}>
        <Pressable onPress={onChat} style={styles.quickButton}>
          <MessageCircle size={iconSizes.sm} color={colors.primary} strokeWidth={2.5} />
        </Pressable>
        <Pressable style={styles.quickButton}>
          <Phone size={iconSizes.sm} color={colors.primary} strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
}

export function ActiveOrderCard({ order, worker, onChat, onCancel, onReport, onSupport }) {
  if (!order) return null;

  const copy = trackingStatusCopy[order.statusKey] || trackingStatusCopy[TRACKING_STATUSES.REQUEST_SENT];
  const waitingForResponse = order.statusKey === TRACKING_STATUSES.REQUEST_SENT;
  const cancelled = order.statusKey === TRACKING_STATUSES.CANCELLED;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <StatusBadge statusKey={order.statusKey} />
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>
        <View style={styles.orderNumber}>
          <Text style={styles.orderNumberText}>#{order.id}</Text>
        </View>
      </View>

      {waitingForResponse ? <CountdownCard deadlineAt={order.responseDeadlineAt} /> : null}

      <OrderTimeline statusKey={order.statusKey} />

      <WorkerSummary worker={worker} onChat={onChat} />

      {env.paymentsEnabled ? (
        <View style={styles.paymentCard}>
          <ShieldCheck size={iconSizes.md} color={colors.success} strokeWidth={2.5} />
          <View style={styles.paymentBody}>
            <Text style={styles.paymentTitle}>To'lov ish yakunlangandan keyin</Text>
            <Text style={styles.paymentText}>
              Buyurtma NearFIX kafolati ostida. Narx yakuniy ish hajmidan keyin tasdiqlanadi.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.chatTools}>
        <View style={styles.uploadTool}>
          <Camera size={iconSizes.sm} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.uploadText}>Rasm</Text>
        </View>
        <View style={styles.uploadTool}>
          <Video size={iconSizes.sm} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.uploadText}>Video</Text>
        </View>
        <Text style={styles.chatNote}>Chat faqat buyurtma tafsilotlari uchun.</Text>
      </View>

      <View style={styles.safetyActions}>
        <Pressable onPress={onSupport} style={styles.supportButton}>
          <LifeBuoy size={17} color={colors.primary} />
          <Text style={styles.supportText}>Yordam</Text>
        </Pressable>
        <Pressable onPress={onReport} style={styles.reportButton}>
          <Flag size={17} color={colors.danger} />
          <Text style={styles.reportText}>Muammo haqida xabar berish</Text>
        </Pressable>
      </View>

      {!cancelled && onCancel ? (
        <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
          <Text style={styles.cancelText}>Buyurtmani bekor qilish</Text>
        </Pressable>
      ) : cancelled ? (
        <Text style={styles.cancelledText}>Sabab: {order.cancellationReason || "Ko'rsatilmagan"}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xxl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
    ...shadow
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  titleBlock: {
    flex: 1,
    gap: 7
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.muted,
    fontWeight: "700"
  },
  orderNumber: {
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: "#E6F4F8",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  orderNumberText: {
    color: colors.primary,
    fontWeight: "900"
  },
  workerCard: {
    minHeight: 82,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.white
  },
  workerBody: {
    flex: 1
  },
  workerName: {
    color: colors.text,
    fontWeight: "900"
  },
  workerMeta: {
    marginTop: 2,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  workerStatus: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  quickActions: {
    flexDirection: "row",
    gap: 8
  },
  quickButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  paymentCard: {
    borderRadius: radius.xl,
    backgroundColor: "rgba(22,163,74,0.09)",
    borderWidth: 1,
    borderColor: "rgba(22,163,74,0.18)",
    padding: 12,
    flexDirection: "row",
    gap: 10
  },
  paymentBody: {
    flex: 1
  },
  paymentTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  paymentText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  chatTools: {
    minHeight: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  uploadTool: {
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  uploadText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900"
  },
  chatNote: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  safetyActions: {
    flexDirection: "row",
    gap: 8
  },
  supportButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#CFE8F0",
    backgroundColor: "#F2FBFE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  supportText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  reportButton: {
    flex: 1.4,
    minHeight: 42,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFF7F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  reportText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "900"
  },
  cancelButton: {
    minHeight: 44,
    borderRadius: radius.lg,
    backgroundColor: "rgba(239,68,68,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  cancelText: {
    color: colors.danger,
    fontWeight: "900"
  },
  cancelledText: {
    borderRadius: radius.lg,
    backgroundColor: "rgba(239,68,68,0.08)",
    color: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden"
  },
  pressed: {
    opacity: 0.78
  }
});
