import React from "react";
import { StyleSheet, View } from "react-native";
import { trackingStatusCopy, TRACKING_STATUSES } from "../../constants/orderTracking";
import { colors, radius } from "../../theme";
import { Text } from "../../i18n/native";

const toneStyles = {
  warning: {
    backgroundColor: "rgba(255,176,32,0.16)",
    color: colors.warning
  },
  success: {
    backgroundColor: "rgba(44,216,165,0.16)",
    color: colors.success
  },
  primary: {
    backgroundColor: "#E6F4F8",
    color: colors.primary
  },
  danger: {
    backgroundColor: "rgba(239,68,68,0.12)",
    color: colors.danger
  }
};

export function StatusBadge({ statusKey }) {
  const copy = trackingStatusCopy[statusKey] || trackingStatusCopy[TRACKING_STATUSES.REQUEST_SENT];
  const tone = toneStyles[copy.tone] || toneStyles.primary;

  return (
    <View style={[styles.badge, { backgroundColor: tone.backgroundColor }]}>
      <Text style={[styles.text, { color: tone.color }]}>{copy.title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  text: {
    fontSize: 11,
    fontWeight: "900"
  }
});
