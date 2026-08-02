import React from "react";
import { StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import { timelineSteps, TRACKING_STATUSES } from "../../constants/orderTracking";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

function stepState(statusKey, stepIndex) {
  if (statusKey === TRACKING_STATUSES.CANCELLED) return stepIndex === 0 ? "done" : "idle";
  const currentIndex = timelineSteps.findIndex((step) => step.key === statusKey);
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "idle";
}

export function OrderTimeline({ statusKey }) {
  return (
    <View style={styles.card}>
      {timelineSteps.map((step, index) => {
        const state = stepState(statusKey, index);
        const active = state === "done" || state === "current";
        return (
          <View key={step.key} style={styles.row}>
            <View style={styles.markerColumn}>
              <View style={[styles.marker, active && styles.markerActive, state === "current" && styles.markerCurrent]}>
                {state === "done" ? <Check size={iconSizes.sm} color={colors.white} strokeWidth={3} /> : null}
              </View>
              {index < timelineSteps.length - 1 ? <View style={[styles.line, active && styles.lineActive]} /> : null}
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>
              {state === "current" ? `→ ${step.label}` : state === "done" ? `✓ ${step.label}` : `○ ${step.label}`}
            </Text>
          </View>
        );
      })}
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
    gap: 2
  },
  row: {
    flexDirection: "row",
    minHeight: 36,
    gap: 10
  },
  markerColumn: {
    alignItems: "center"
  },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  markerActive: {
    backgroundColor: colors.primary
  },
  markerCurrent: {
    borderWidth: 4,
    borderColor: "#E6F4F8"
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border
  },
  lineActive: {
    backgroundColor: colors.primary
  },
  label: {
    flex: 1,
    color: colors.muted,
    fontWeight: "800",
    paddingTop: 2
  },
  labelActive: {
    color: colors.text
  }
});
