import React from "react";
import { StyleSheet, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function PricingCard({ services = [], guarantee }) {
  return (
    <View style={styles.card}>
      {services.map(([name, price]) => (
        <View key={name} style={styles.row}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.price}>{price}</Text>
        </View>
      ))}
      <View style={styles.guarantee}>
        <ShieldCheck size={iconSizes.sm} color={colors.success} strokeWidth={2.5} />
        <Text style={styles.guaranteeText}>{guarantee}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    minHeight: 42,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  name: {
    flex: 1,
    color: colors.text,
    fontWeight: "800"
  },
  price: {
    color: colors.primary,
    fontWeight: "900"
  },
  guarantee: {
    minHeight: 44,
    borderRadius: radius.lg,
    backgroundColor: "rgba(22,163,74,0.09)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12
  },
  guaranteeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  }
});
