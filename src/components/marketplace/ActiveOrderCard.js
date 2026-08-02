import React from "react";
import { StyleSheet, View } from "react-native";
import { Clock3, Navigation } from "lucide-react-native";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function ActiveOrderCard({ order }) {
  if (!order) return null;

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Navigation size={iconSizes.md} color={colors.white} strokeWidth={2.5} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{order.title}</Text>
        <Text style={styles.meta}>
          Buyurtma #{order.id} - {order.status}
        </Text>
      </View>
      <View style={styles.eta}>
        <Clock3 size={iconSizes.sm} color={colors.primary} strokeWidth={2.4} />
        <Text style={styles.etaText}>{order.eta}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 74,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  body: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  meta: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  eta: {
    borderRadius: radius.pill,
    backgroundColor: "#E6F4F8",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  etaText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  }
});
