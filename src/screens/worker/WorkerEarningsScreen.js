import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, DollarSign } from "lucide-react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { env } from "../../constants/env";
import { useWorkerStore } from "../../store/workerStore";
import { radius } from "../../theme";
import { Text } from "../../i18n/native";

const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold"
};

const avatarPalette = [
  { avatarBg: "#D5F9DF", avatarColor: "#159A50" },
  { avatarBg: "#DDEBFF", avatarColor: "#2868D8" },
  { avatarBg: "#EEF2F7", avatarColor: "#667894" }
];

export function WorkerEarningsScreen() {
  const earnings = useWorkerStore((state) => state.earnings);
  const transactions = useWorkerStore((state) => state.transactions);
  const syncWorkerFromApi = useWorkerStore((state) => state.syncWorkerFromApi);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState("week");

  async function handleRefresh() {
    setRefreshing(true);
    await syncWorkerFromApi();
    setRefreshing(false);
  }

  const visibleTransactions = useMemo(() => {
    return transactions.slice(0, 5).map((transaction, index) => {
      const palette = avatarPalette[index % avatarPalette.length];
      return {
        id: transaction.id,
        title: transaction.clientName || transaction.publicCode || "Buyurtma",
        subtitle: `${transaction.service || "Xizmat"} - ${formatDate(transaction.createdAt)}`,
        amount: formatPositiveAmount(transaction.netAmount || transaction.amount),
        positive: true,
        avatar: getInitials(transaction.clientName || transaction.publicCode || "NF"),
        avatarBg: palette.avatarBg,
        avatarColor: palette.avatarColor
      };
    });
  }, [transactions]);

  const selectedTotal =
    range === "today" ? earnings.todayEarnings : range === "month" ? earnings.monthEarnings : earnings.weekEarnings;
  const summaryLabel = range === "today" ? "BUGUNGI DAROMAD" : range === "month" ? "OYLIK DAROMAD" : "HAFTALIK DAROMAD";
  const jobs = earnings.completedJobs || 0;
  const avgDay = earnings.averagePerDay || 0;
  const hasEarningsData = Boolean(selectedTotal || jobs || visibleTransactions.length);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1F1E42" colors={["#1F1E42"]} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Daromad</Text>
        {env.paymentsEnabled ? <Text style={styles.subtitle}>May 2026 - to'lov har dushanba</Text> : null}
      </View>

      <View style={styles.segment}>
        <RangeButton label="Bugun" active={range === "today"} onPress={() => setRange("today")} />
        <RangeButton label="Bu hafta" active={range === "week"} onPress={() => setRange("week")} />
        <RangeButton label="Bu oy" active={range === "month"} onPress={() => setRange("month")} />
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryOrbLarge} />
        <View style={styles.summaryOrbSmall} />
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>{summaryLabel}</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(selectedTotal || 0)}</Text>
          </View>
          <View style={styles.growthPillDark}>
            <ArrowUpRight size={12} color="#49F093" strokeWidth={2.5} />
            <Text style={styles.growthTextDark}>{earnings.growthPercentage || 0}%</Text>
          </View>
        </View>

        <View style={styles.summaryStats}>
          <SummaryMetric icon={DollarSign} label="Ishlar" value={jobs} />
          <View style={styles.summaryDivider} />
          <SummaryMetric icon={CalendarDays} label="Kunlik o'rtacha" value={formatCurrency(avgDay)} />
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.cardTitle}>Daromad dinamikasi</Text>
          <View style={styles.growthPillLight}>
            <ArrowUpRight size={12} color="#18A850" strokeWidth={2.5} />
            <Text style={styles.growthTextLight}>{earnings.growthPercentage || 0}%</Text>
          </View>
        </View>
        <RevenueChart trend={earnings.revenueTrend || []} />
      </View>

      <View style={styles.transactionsHeader}>
        <Text style={styles.transactionsTitle}>Tranzaksiyalar</Text>
        <Pressable style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.viewAll}>Barchasi</Text>
        </Pressable>
      </View>

      <View style={styles.transactionList}>
        {hasEarningsData ? (
          visibleTransactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)
        ) : (
          <EmptyState />
        )}
      </View>
    </ScrollView>
  );
}

function RangeButton({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.rangeButton, active && styles.rangeButtonActive, pressed && styles.pressed]}
    >
      <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SummaryMetric({ icon: Icon, label, value }) {
  return (
    <View style={styles.summaryMetric}>
      <View style={styles.summaryMetricIcon}>
        <Icon size={16} color="#FFFFFF" strokeWidth={2.2} />
      </View>
      <View>
        <Text style={styles.summaryMetricLabel}>{label}</Text>
        <Text style={styles.summaryMetricValue}>{value}</Text>
      </View>
    </View>
  );
}

function RevenueChart({ trend }) {
  const values = trend.map((item) => Number(item.amount || 0));
  const hasData = values.some((value) => value > 0);

  if (!hasData) {
    return <EmptyState />;
  }

  const maxValue = Math.max(...values, 1);
  const points = trend.map((item, index) => {
    const x = 10 + index * (274 / Math.max(1, trend.length - 1));
    const y = 88 - (Number(item.amount || 0) / maxValue) * 78;
    return [x, y];
  });
  const path = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  const areaPath = `${path} L${points[points.length - 1][0]} 88 L${points[0][0]} 88 Z`;
  const labels = trend.map((item) => new Date(item.date).toLocaleDateString("uz-UZ", { weekday: "short" }));

  return (
    <View style={styles.chartBody}>
      <View style={styles.yAxis}>
        <Text style={styles.axisLabel}>240</Text>
        <Text style={styles.axisLabel}>120</Text>
        <Text style={styles.axisLabel}>0</Text>
      </View>
      <View style={styles.chartArea}>
        <Svg width="100%" height="92" viewBox="0 0 284 92">
          <Defs>
            <LinearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FF7A21" stopOpacity="0.26" />
              <Stop offset="1" stopColor="#FF7A21" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill="url(#revenueFill)" />
          <Path d={path} fill="none" stroke="#FF7A21" strokeWidth="3" strokeLinecap="round" />
          {points.map(([cx, cy]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.2" fill="#FF7A21" />
          ))}
        </Svg>
        <View style={styles.xAxis}>
          {labels.map((label) => (
            <Text key={label} style={styles.axisLabel}>
              {label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function TransactionRow({ transaction }) {
  const AmountIcon = transaction.positive ? ArrowUpRight : ArrowDownLeft;

  return (
    <View style={styles.transactionCard}>
      <View style={[styles.transactionAvatar, { backgroundColor: transaction.avatarBg }]}>
        <Text style={[styles.transactionAvatarText, { color: transaction.avatarColor }]}>{transaction.avatar}</Text>
      </View>
      <View style={styles.transactionBody}>
        <Text style={styles.transactionTitle} numberOfLines={1}>
          {transaction.title}
        </Text>
        <Text style={styles.transactionSubtitle} numberOfLines={1}>
          {transaction.subtitle}
        </Text>
      </View>
      <View style={styles.transactionAmountWrap}>
        <AmountIcon size={12} color={transaction.positive ? "#18A850" : "#FF2E55"} strokeWidth={2.4} />
        <Text style={[styles.transactionAmount, transaction.positive ? styles.amountPositive : styles.amountNegative]}>
          {transaction.amount}
        </Text>
      </View>
    </View>
  );
}

function formatPositiveAmount(value) {
  return `+${formatCurrency(value)}`;
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("uz-UZ")} so'm`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("uz-UZ") : "";
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Daromad ma'lumoti yo'q</Text>
      <Text style={styles.emptyText}>Yakunlangan pullik ishlar shu yerda ko'rinadi.</Text>
    </View>
  );
}

function getInitials(name) {
  return String(name || "NF")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F8FC"
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 112
  },
  header: {
    marginBottom: 17
  },
  title: {
    color: "#07122B",
    fontSize: 24,
    lineHeight: 30,
    fontFamily: font.extra
  },
  subtitle: {
    marginTop: 2,
    color: "#667894",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: font.medium
  },
  segment: {
    height: 43,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5EF",
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    shadowColor: "#17213D",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 9,
    elevation: 3
  },
  rangeButton: {
    flex: 1,
    height: 33,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  rangeButtonActive: {
    backgroundColor: "#1F1E42"
  },
  rangeText: {
    color: "#5D708C",
    fontSize: 12,
    fontFamily: font.bold
  },
  rangeTextActive: {
    color: "#FFFFFF"
  },
  summaryCard: {
    marginTop: 17,
    minHeight: 141,
    borderRadius: 13,
    backgroundColor: "#1F1E42",
    paddingHorizontal: 20,
    paddingVertical: 19,
    overflow: "hidden"
  },
  summaryOrbLarge: {
    position: "absolute",
    right: -24,
    bottom: -16,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  summaryOrbSmall: {
    position: "absolute",
    right: -3,
    top: 0,
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "rgba(255,255,255,0.05)"
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  summaryLabel: {
    color: "#A8B3CC",
    fontSize: 11,
    letterSpacing: 0,
    fontFamily: font.extra
  },
  summaryAmount: {
    marginTop: 3,
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 40,
    fontFamily: font.extra
  },
  growthPillDark: {
    minHeight: 27,
    borderRadius: radius.pill,
    backgroundColor: "rgba(73,240,147,0.16)",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  growthTextDark: {
    color: "#49F093",
    fontSize: 12,
    fontFamily: font.extra
  },
  summaryStats: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center"
  },
  summaryMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  summaryMetricIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  summaryMetricLabel: {
    color: "#A8B3CC",
    fontSize: 10,
    fontFamily: font.medium
  },
  summaryMetricValue: {
    marginTop: 1,
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 19,
    fontFamily: font.extra
  },
  summaryDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  chartCard: {
    marginTop: 17,
    minHeight: 178,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5EF",
    padding: 16,
    shadowColor: "#17213D",
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 9,
    elevation: 3
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardTitle: {
    color: "#07122B",
    fontSize: 13,
    fontFamily: font.extra
  },
  growthPillLight: {
    minHeight: 24,
    borderRadius: radius.pill,
    backgroundColor: "#D5F9DF",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  growthTextLight: {
    color: "#18A850",
    fontSize: 11,
    fontFamily: font.extra
  },
  chartBody: {
    marginTop: 14,
    flexDirection: "row"
  },
  yAxis: {
    width: 26,
    height: 103,
    justifyContent: "space-between",
    paddingTop: 2,
    paddingBottom: 17
  },
  axisLabel: {
    color: "#8EA1BA",
    fontSize: 10,
    fontFamily: font.medium
  },
  chartArea: {
    flex: 1
  },
  xAxis: {
    marginTop: 0,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  transactionsHeader: {
    marginTop: 17,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  transactionsTitle: {
    color: "#15213A",
    fontSize: 15,
    fontFamily: font.extra
  },
  viewAll: {
    color: "#246BFF",
    fontSize: 12,
    fontFamily: font.extra
  },
  transactionList: {
    gap: 10
  },
  emptyState: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: {
    color: "#07122B",
    fontSize: 15,
    fontFamily: font.extra
  },
  emptyText: {
    marginTop: 7,
    color: "#667894",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: font.medium
  },
  transactionCard: {
    minHeight: 62,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5EF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#17213D",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3
  },
  transactionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  transactionAvatarText: {
    fontSize: 11,
    fontFamily: font.extra
  },
  transactionBody: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0
  },
  transactionTitle: {
    color: "#15213A",
    fontSize: 13,
    lineHeight: 17,
    fontFamily: font.extra
  },
  transactionSubtitle: {
    marginTop: 2,
    color: "#8EA1BA",
    fontSize: 11,
    lineHeight: 15,
    fontFamily: font.medium
  },
  transactionAmountWrap: {
    marginLeft: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  transactionAmount: {
    fontSize: 14,
    fontFamily: font.extra
  },
  amountPositive: {
    color: "#18A850"
  },
  amountNegative: {
    color: "#FF2E55"
  },
  pressed: {
    opacity: 0.78
  }
});
