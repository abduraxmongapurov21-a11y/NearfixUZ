import React from "react";
import { StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import { timelineSteps, TRACKING_STATUSES } from "../../constants/orderTracking";
import { colors, font, iconSizes } from "../../theme/clientTheme";
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
                {state === "done" ? <Check size={iconSizes.sm} color={colors.white} strokeWidth={2} /> : null}
              </View>
              {index < timelineSteps.length - 1 ? (
                <View style={[styles.line, state === "done" && styles.lineActive]} />
              ) : null}
            </View>
            <Text style={[styles.label, active && styles.labelActive, state === "current" && styles.labelCurrent]}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  row: {
    flexDirection: "row",
    minHeight: 40,
    gap: 12
  },
  markerColumn: {
    alignItems: "center"
  },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  markerActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  markerCurrent: {
    borderWidth: 4,
    borderColor: colors.primarySoft
  },
  line: {
    flex: 1,
    width: 1,
    backgroundColor: colors.border
  },
  lineActive: {
    backgroundColor: colors.primary
  },
  label: {
    flex: 1,
    color: colors.muted,
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    paddingTop: 2
  },
  labelActive: {
    color: colors.text
  },
  labelCurrent: { fontFamily: font.semi }
});
