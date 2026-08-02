import React from "react";
import { StyleSheet, View } from "react-native";
import { BadgeCheck, Clock3, MapPin } from "lucide-react-native";
import { urgencyOptions } from "../../constants/orderStates";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

function SummaryRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function OrderSummaryCard({ draft, service, worker }) {
  const urgency = urgencyOptions.find((item) => item.id === draft.urgency);

  return (
    <View style={styles.card}>
      <View style={styles.statusRow}>
        <View style={styles.statusIcon}>
          <BadgeCheck size={iconSizes.md} color={colors.white} strokeWidth={2.6} />
        </View>
        <View style={styles.statusTextBlock}>
          <Text style={styles.title}>Buyurtma tayyor</Text>
          <Text style={styles.subtitle}>Usta va taxminiy narx tanlandi</Text>
        </View>
      </View>

      <View style={styles.summary}>
        <SummaryRow label="Xizmat" value={service?.title || "Xizmat"} />
        <SummaryRow label="Muammo" value={draft.problemTitle || "Joyida aniqlanadi"} />
        <SummaryRow label="Tezlik" value={urgency?.label || "Tez"} />
        <SummaryRow label="Usta" value={worker?.name || "Tanlanmagan"} />
      </View>

      <View style={styles.infoCards}>
        <View style={styles.infoCard}>
          <Clock3 size={iconSizes.sm} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.infoTitle}>Kelish vaqti</Text>
          <Text style={styles.infoValue}>{draft.urgency === "urgent" ? "18 min" : "32 min"}</Text>
        </View>
        <View style={styles.infoCard}>
          <MapPin size={iconSizes.sm} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.infoTitle}>Manzil</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {draft.address}
          </Text>
        </View>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Taxminiy narx</Text>
        <Text style={styles.totalValue}>{worker?.price || "130,000 so'm"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xxl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
    ...shadow
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  statusTextBlock: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  summary: {
    gap: 10
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16
  },
  label: {
    color: colors.muted,
    fontWeight: "700"
  },
  value: {
    flex: 1,
    color: colors.text,
    textAlign: "right",
    fontWeight: "900"
  },
  infoCards: {
    flexDirection: "row",
    gap: 10
  },
  infoCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 4
  },
  infoTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  infoValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  totalLabel: {
    color: colors.text,
    fontWeight: "900"
  },
  totalValue: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900"
  }
});
