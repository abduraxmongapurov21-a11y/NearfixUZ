import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function TrustStat({ icon: Icon, label, value }) {
  return (
    <View style={styles.card}>
      {Icon ? (
        <View style={styles.iconWrap}>
          <Icon size={16} color={colors.primary} strokeWidth={2.5} />
        </View>
      ) : null}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 86,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    justifyContent: "center",
    gap: 4
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: "#E6F4F8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  value: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700"
  }
});
