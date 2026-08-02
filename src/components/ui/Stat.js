import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function Stat({ label, value, highlighted = false }) {
  return (
    <View style={[styles.card, highlighted && styles.highlighted]}>
      <Text style={[styles.label, highlighted && styles.light]}>{label}</Text>
      <Text style={[styles.value, highlighted && styles.light]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    padding: 12
  },
  highlighted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  value: {
    marginTop: 4,
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  light: {
    color: colors.white
  }
});
