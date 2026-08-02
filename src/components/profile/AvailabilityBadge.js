import React from "react";
import { StyleSheet, View } from "react-native";
import { CalendarClock, Circle } from "lucide-react-native";
import { workerStatusCopy, WORKER_STATUS } from "../../constants/workerStatus";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

const toneColors = {
  success: colors.secondary,
  warning: colors.warning,
  danger: colors.danger
};

export function AvailabilityBadge({ status }) {
  const copy = workerStatusCopy[status] || workerStatusCopy[WORKER_STATUS.OFFLINE];
  const toneColor = toneColors[copy.tone];

  return (
    <View style={[styles.card, { borderColor: `${toneColor}55` }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${toneColor}22` }]}>
        <Circle size={iconSizes.sm} color={toneColor} fill={toneColor} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{copy.label}</Text>
        <Text style={styles.helper}>{copy.helper}</Text>
      </View>
      <CalendarClock size={iconSizes.md} color={colors.primary} strokeWidth={2.5} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 74,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  body: {
    flex: 1
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  helper: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  }
});
