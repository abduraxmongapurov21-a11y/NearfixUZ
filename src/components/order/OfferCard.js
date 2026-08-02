import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BadgeCheck, Clock3, Star } from "lucide-react-native";
import { WorkerAvatar } from "../ui/WorkerAvatar";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

export function OfferCard({ worker, eta, price, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}
    >
      <WorkerAvatar worker={worker} size={58} radius={radius.lg} style={styles.avatar} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{worker.name}</Text>
          <View style={styles.verified}>
            <BadgeCheck size={iconSizes.sm} color={colors.success} strokeWidth={2.5} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        </View>
        <Text style={styles.specialty}>{worker.specialty}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Star size={iconSizes.sm} color={colors.warning} fill={colors.warning} />
            <Text style={styles.metaText}>{worker.rating}</Text>
          </View>
          <View style={styles.metaItem}>
            <Clock3 size={iconSizes.sm} color={colors.primary} />
            <Text style={styles.metaText}>{eta}</Text>
          </View>
          <Text style={styles.jobs}>{worker.reviews}+ ish</Text>
        </View>
      </View>
      <View style={styles.priceBlock}>
        <View style={styles.onlineDot} />
        <Text style={styles.price}>{price}</Text>
        <Text style={styles.priceMeta}>taxminiy</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 104,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadow
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: "#F7FCFD"
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.surface
  },
  body: {
    flex: 1
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  verifiedText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: "900"
  },
  specialty: {
    marginTop: 3,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  metaRow: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  metaText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  jobs: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  priceBlock: {
    alignItems: "flex-end",
    gap: 4
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.secondary
  },
  price: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: 13
  },
  priceMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.78
  }
});
