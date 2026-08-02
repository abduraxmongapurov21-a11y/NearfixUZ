import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { OrderResponseTimer } from "./OrderResponseTimer";
import { Text } from "../../i18n/native";

const avatarColors = ["#EFE0FF", "#FFD8EB", "#DDEBFF"];
const textColors = ["#7C3DFF", "#D81B71", "#2868D8"];

export function IncomingOrderCard({ request, disabled, onAccept, onReject, index = 0 }) {
  const initials = request.clientName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.clientIcon, { backgroundColor: avatarColors[index % avatarColors.length] }]}>
          <Text style={[styles.avatarText, { color: textColors[index % textColors.length] }]}>{initials || "JP"}</Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.client}>{request.clientName}</Text>
          <Text style={styles.service} numberOfLines={1}>
            {request.service || "Xizmat"} - {request.distance || "0.8 km"} - {request.createdAt || "Hozir"}
          </Text>
        </View>
        <Text style={styles.payment}>{request.estimatedPayment}</Text>
      </View>
      <View style={styles.bottomRow}>
        <OrderResponseTimer deadlineAt={request.responseDeadlineAt} compact />
        <View style={styles.actions}>
          <Pressable
            onPress={onReject}
            style={({ pressed }) => [styles.actionButton, styles.rejectButton, pressed && styles.pressed]}
          >
            <X size={iconSizes.sm} color="#B42318" strokeWidth={2.8} />
            <Text style={[styles.actionText, styles.rejectText]}>Bekor</Text>
          </Pressable>
          <Pressable
            disabled={disabled}
            onPress={disabled ? undefined : onAccept}
            style={({ pressed }) => [
              styles.actionButton,
              styles.acceptButton,
              disabled && styles.acceptDisabled,
              pressed && styles.pressed
            ]}
          >
            <Check size={iconSizes.sm} color={colors.white} strokeWidth={2.8} />
            <Text style={[styles.actionText, styles.acceptText]}>Qabul</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 82,
    borderRadius: 15,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    ...shadow
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  clientIcon: {
    width: 41,
    height: 41,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "900"
  },
  titleBlock: {
    flex: 1
  },
  client: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900"
  },
  service: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600"
  },
  payment: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900"
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  actionButton: {
    minHeight: 31,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5
  },
  acceptButton: {
    backgroundColor: "#18B354"
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: "#F3B4AF",
    backgroundColor: "#FFF5F5"
  },
  acceptDisabled: {
    backgroundColor: colors.subtle
  },
  actionText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900"
  },
  acceptText: {
    color: colors.white
  },
  rejectText: {
    color: "#B42318"
  },
  pressed: {
    opacity: 0.78
  }
});
