import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "../../theme";
import { Text } from "../../i18n/native";

const stepLabels = ["Xizmat", "Muammo", "Manzil", "Ustalar", "Tasdiq"];

export function OrderStepHeader({ step, title, subtitle }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.progressRow}>
        {stepLabels.map((label, index) => {
          const active = index <= step;
          return (
            <View key={label} style={styles.progressItem}>
              <View style={[styles.progressDot, active && styles.progressActive]} />
            </View>
          );
        })}
      </View>
      <Text style={styles.kicker}>
        {step + 1}/5 - {stepLabels[step]}
      </Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 7
  },
  progressRow: {
    flexDirection: "row",
    gap: 6
  },
  progressItem: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: "hidden"
  },
  progressDot: {
    flex: 1,
    backgroundColor: "transparent"
  },
  progressActive: {
    backgroundColor: colors.primary
  },
  kicker: {
    marginTop: 8,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  title: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600"
  }
});
