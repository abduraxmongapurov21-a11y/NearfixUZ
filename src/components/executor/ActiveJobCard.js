import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Clock3, MapPin, MessageCircle, Star } from "lucide-react-native";
import { trackingStatusCopy, TRACKING_STATUSES } from "../../constants/orderTracking";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { OrderActions } from "./OrderActions";
import { Text } from "../../i18n/native";

export function ActiveJobCard({ job, onChat, onUpdateStatus, onComplete }) {
  if (!job) return null;

  const category = job.service || "Xizmat";
  const jobValue = job.estimatedPayment || job.amount || job.price || "Kelishiladi";
  const customerName = job.clientName || "Mijoz";
  const statusKey = job.statusKey || TRACKING_STATUSES.ACCEPTED;
  const statusCopy = trackingStatusCopy[statusKey] || trackingStatusCopy[TRACKING_STATUSES.ACCEPTED];
  const initials = customerName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || "MK"}</Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{customerName}</Text>
          {job.rating && job.jobs ? (
            <View style={styles.ratingRow}>
              <Star size={10} color={colors.warning} fill={colors.warning} />
              <Text style={styles.subtitle}>
                {job.rating} - {job.jobs} ish
              </Text>
            </View>
          ) : null}
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{statusCopy.title}</Text>
          </View>
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>{jobValue}</Text>
          <Text style={styles.category}>{category}</Text>
        </View>
      </View>

      <View style={styles.address}>
        <MapPin size={iconSizes.sm} color="#FF6B1A" strokeWidth={2.4} />
        <Text style={styles.addressText} numberOfLines={2}>
          {job.address}
        </Text>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.timeRow}>
          <Clock3 size={iconSizes.sm} color={colors.muted} strokeWidth={2.3} />
          <Text style={styles.timeText}>{statusCopy.subtitle}</Text>
        </View>
        {onChat ? (
          <Pressable onPress={onChat} style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}>
            <MessageCircle size={13} color={colors.primary} strokeWidth={2.5} />
            <Text style={styles.chatText}>Chat</Text>
          </Pressable>
        ) : null}
      </View>

      {onUpdateStatus && onComplete ? (
        <OrderActions currentStatus={statusKey} onComplete={onComplete} onUpdateStatus={onUpdateStatus} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 15,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    gap: 13,
    ...shadow
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: "#D9E9FF",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: "#3D79FF",
    fontSize: 15,
    fontWeight: "900"
  },
  titleBlock: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  ratingRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  subtitle: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600"
  },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderRadius: radius.pill,
    backgroundColor: "#E6F4F8",
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  statusText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900"
  },
  priceBlock: {
    alignItems: "flex-end"
  },
  price: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900"
  },
  category: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  address: {
    minHeight: 35,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12
  },
  addressText: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: "600"
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  timeRow: {
    flex: 1,
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  timeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  chatButton: {
    minHeight: 34,
    borderRadius: radius.pill,
    backgroundColor: "#E6F4F8",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5
  },
  chatText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.78
  }
});
