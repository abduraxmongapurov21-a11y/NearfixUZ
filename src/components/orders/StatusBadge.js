import React from "react";
import { StyleSheet, View } from "react-native";
import { trackingStatusCopy, TRACKING_STATUSES } from "../../constants/orderTracking";
import { colors, font, radius } from "../../theme/clientTheme";
import { Text } from "../../i18n/native";

const toneStyles = {
  warning: {
    backgroundColor: "#FFF5E7",
    color: colors.warning
  },
  success: {
    backgroundColor: colors.mintSoft,
    color: colors.success
  },
  primary: {
    backgroundColor: colors.primarySoft,
    color: colors.primary
  },
  danger: {
    backgroundColor: "#FFF0F1",
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
    fontFamily: font.semi,
    lineHeight: 16
  }
});
