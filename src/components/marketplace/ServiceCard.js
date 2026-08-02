import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ServiceRow({ name, price }) {
  return (
    <View style={styles.serviceRow}>
      <Text style={styles.serviceName}>{name}</Text>
      <Text style={styles.servicePrice}>{price}</Text>
    </View>
  );
}

export function PriceRow({ label, value }) {
  return (
    <View style={styles.priceRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.servicePrice}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    ...shadow
  },
  serviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  serviceName: {
    flex: 1,
    color: colors.text,
    fontWeight: "800"
  },
  servicePrice: {
    color: colors.primary,
    fontWeight: "900"
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600"
  }
});
