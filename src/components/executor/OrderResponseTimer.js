import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Clock3 } from "lucide-react-native";
import { colors, radius } from "../../theme";
import { Text } from "../../i18n/native";

function formatRemaining(deadlineAt, now) {
  const remainingMs = Math.max(0, Number(deadlineAt || 0) - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    expired: remainingMs <= 0,
    urgent: remainingMs > 0 && remainingMs <= 10 * 60 * 1000,
    label: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  };
}

export function OrderResponseTimer({ deadlineAt, compact = false }) {
  const [now, setNow] = useState(Date.now());
  const timer = useMemo(() => formatRemaining(deadlineAt, now), [deadlineAt, now]);

  useEffect(() => {
    if (!deadlineAt) return undefined;

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [deadlineAt]);

  if (!deadlineAt) return null;

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        timer.urgent && styles.wrapUrgent,
        timer.expired && styles.wrapExpired
      ]}
    >
      <Clock3
        size={compact ? 13 : 15}
        color={timer.urgent || timer.expired ? "#EF4444" : "#FB8C00"}
        strokeWidth={2.6}
      />
      <View style={styles.textBlock}>
        <Text style={[styles.time, timer.urgent && styles.timeUrgent, timer.expired && styles.timeUrgent]}>
          {timer.expired ? "Muddati tugadi" : timer.label}
        </Text>
        <Text style={styles.note} numberOfLines={compact ? 1 : 2}>
          1 soatda qabul qilinmasa avtomatik bekor bo'ladi
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(251,140,0,0.22)",
    backgroundColor: "rgba(251,140,0,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  wrapCompact: {
    minHeight: 32,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  wrapUrgent: {
    borderColor: "rgba(239,68,68,0.24)",
    backgroundColor: "rgba(239,68,68,0.08)"
  },
  wrapExpired: {
    borderColor: "rgba(239,68,68,0.2)",
    backgroundColor: "rgba(239,68,68,0.06)"
  },
  textBlock: {
    flex: 1,
    minWidth: 0
  },
  time: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900"
  },
  timeUrgent: {
    color: "#EF4444"
  },
  note: {
    marginTop: 1,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700"
  }
});
