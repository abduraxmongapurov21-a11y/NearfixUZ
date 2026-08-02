import React from "react";
import { StyleSheet, View } from "react-native";
import { StatusBadge } from "./StatusBadge";
import { RepeatBookingButton } from "./RepeatBookingButton";
import { colors, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

export function OrderHistoryCard({ order, worker, onRepeat }) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{order.service || order.title}</Text>
          <Text style={styles.meta}>
            {worker?.name || order.provider} - {order.date}
          </Text>
        </View>
        <StatusBadge statusKey={order.statusKey} />
      </View>
      <View style={styles.details}>
        <Text style={styles.detailText}>{order.address}</Text>
        <Text style={styles.amount}>{order.amount || order.price}</Text>
      </View>
      {order.cancellationReason ? <Text style={styles.cancelReason}>Sabab: {order.cancellationReason}</Text> : null}
      <RepeatBookingButton onPress={onRepeat} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    ...shadow
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  titleBlock: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  meta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  details: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  detailText: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  amount: {
    color: colors.primary,
    fontWeight: "900"
  },
  cancelReason: {
    borderRadius: radius.lg,
    backgroundColor: "rgba(239,68,68,0.08)",
    color: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden"
  }
});
