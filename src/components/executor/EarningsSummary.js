import React from "react";
import { StyleSheet, View } from "react-native";
import { Star } from "lucide-react-native";
import { colors, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function EarningsSummary({ earnings, worker }) {
  const completedJobs = earnings.completedJobs ?? worker?.completedOrders ?? 0;
  const hoursWorked = `${earnings.activeHours ?? 0}h`;
  const rating = worker?.rating ?? "0";
  const today = formatCurrency(earnings.todayEarnings ?? 0);
  const growth = `${earnings.growthPercentage ?? 0}%`;

  return (
    <View style={styles.card}>
      <View style={styles.orbLarge} />
      <View style={styles.orbSmall} />
      <Text style={styles.eyebrow}>BUGUNGI DAROMAD</Text>
      <View style={styles.amountRow}>
        <Text style={styles.amount}>{today}</Text>
        <View style={styles.deltaPill}>
          <Text style={styles.deltaText}>{growth}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <Metric label="Yakunlangan" value={completedJobs} />
        <Metric label="Faol soat" value={hoursWorked} bordered />
        <Metric label="Reyting" value={rating} rating bordered />
      </View>
    </View>
  );
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("uz-UZ")} so'm`;
}

function Metric({ label, value, bordered = false, rating = false }) {
  return (
    <View style={[styles.metric, bordered && styles.metricBorder]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={styles.value}>{value}</Text>
        {rating ? <Star size={10} color={colors.warning} fill={colors.warning} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 133,
    borderRadius: 15,
    backgroundColor: "#1F1E42",
    paddingHorizontal: 17,
    paddingVertical: 16,
    overflow: "hidden"
  },
  orbLarge: {
    position: "absolute",
    right: -16,
    bottom: -18,
    width: 128,
    height: 128,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.05)"
  },
  orbSmall: {
    position: "absolute",
    right: -12,
    top: 20,
    width: 82,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  eyebrow: {
    color: "#AFC6E7",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
  },
  amountRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  amount: {
    color: colors.white,
    fontSize: 31,
    lineHeight: 39,
    fontWeight: "900"
  },
  deltaPill: {
    borderRadius: radius.pill,
    backgroundColor: "rgba(44,216,165,0.18)",
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  deltaText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "900"
  },
  statsRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center"
  },
  metric: {
    flex: 1,
    minHeight: 38,
    justifyContent: "flex-start"
  },
  metricBorder: {
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.09)",
    paddingLeft: 16
  },
  metricValueRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  value: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900"
  },
  label: {
    color: "#AFC6E7",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600"
  }
});
