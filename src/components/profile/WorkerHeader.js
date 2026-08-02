import React from "react";
import { StyleSheet, View } from "react-native";
import { BadgeCheck, Clock3, Star } from "lucide-react-native";
import { WorkerAvatar } from "../ui/WorkerAvatar";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

export function WorkerHeader({ worker }) {
  return (
    <View style={styles.card}>
      <WorkerAvatar worker={worker} size={112} radius={radius.xl} style={styles.image} />
      <View style={styles.body}>
        <View style={styles.badge}>
          <BadgeCheck size={iconSizes.sm} color={colors.success} strokeWidth={2.5} />
          <Text style={styles.badgeText}>{worker.verification}</Text>
        </View>
        <Text style={styles.name}>{worker.name}</Text>
        <Text style={styles.specialty}>{worker.specialty}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Star size={iconSizes.sm} color={colors.warning} fill={colors.warning} />
            <Text style={styles.metaText}>{worker.rating}</Text>
          </View>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.metaText}>{worker.completedOrders} ta buyurtma</Text>
        </View>
        <View style={styles.responseRow}>
          <Clock3 size={iconSizes.sm} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.responseText}>{worker.responseSpeed}</Text>
        </View>
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
    padding: 14,
    flexDirection: "row",
    gap: 14,
    ...shadow
  },
  image: {
    width: 112,
    height: 142,
    borderRadius: radius.xl,
    backgroundColor: colors.surface
  },
  body: {
    flex: 1,
    justifyContent: "center"
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    backgroundColor: "rgba(22,163,74,0.09)",
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  badgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "900"
  },
  name: {
    marginTop: 10,
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900"
  },
  specialty: {
    marginTop: 3,
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900"
  },
  metaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  metaText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  dot: {
    color: colors.subtle,
    fontWeight: "900"
  },
  responseRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  responseText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  }
});
