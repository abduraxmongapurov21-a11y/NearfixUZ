import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BadgeCheck, BriefcaseBusiness, Clock3, Star } from "lucide-react-native";
import { FavoriteButton } from "../catalog/FavoriteButton";
import { workerStatusCopy, WORKER_STATUS } from "../../constants/workerStatus";
import { WorkerAvatar } from "../ui/WorkerAvatar";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

const toneColors = {
  success: colors.secondary,
  warning: colors.warning,
  danger: colors.danger
};

export function WorkerCard({ worker, onPress, favorite = false, onToggleFavorite }) {
  const statusCopy = workerStatusCopy[worker.availability] || workerStatusCopy[WORKER_STATUS.OFFLINE];
  const toneColor = toneColors[statusCopy.tone];
  const offline = worker.availability === WORKER_STATUS.OFFLINE;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, offline && styles.offline, pressed && styles.pressed]}
    >
      {Number(worker.rating) >= 4.9 ? (
        <View style={styles.topBadge}>
          <Text style={styles.topBadgeText}>Top Usta</Text>
        </View>
      ) : null}
      <WorkerAvatar worker={worker} size={74} radius={radius.xl} style={styles.image} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.title}>{worker.name}</Text>
              <BadgeCheck size={iconSizes.sm} color={colors.success} strokeWidth={2.5} />
            </View>
            <Text style={styles.specialty}>{worker.specialty}</Text>
          </View>
          <FavoriteButton active={favorite} onPress={onToggleFavorite} />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Star size={iconSizes.sm} color={colors.warning} fill={colors.warning} />
            <Text style={styles.metaText}>{worker.rating}</Text>
          </View>
          <View style={styles.metaItem}>
            <BriefcaseBusiness size={iconSizes.sm} color={colors.primary} />
            <Text style={styles.metaText}>{worker.completedOrders}</Text>
          </View>
          <View style={styles.metaItemWide}>
            <Clock3 size={iconSizes.sm} color={colors.primary} />
            <Text style={styles.responseText} numberOfLines={1}>
              {(worker.responseSpeed || "Javob vaqti ko'rsatilmagan").replace("Odatda ", "")}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: toneColor }]} />
            <Text style={styles.statusText} numberOfLines={1}>
              {statusCopy.label}
            </Text>
          </View>
          <Text style={styles.price}>
            {worker.price} <Text style={styles.priceMuted}>/dan</Text>
          </Text>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Profil</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    flexDirection: "row",
    gap: 14,
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow
  },
  offline: {
    opacity: 0.68
  },
  image: {
    width: 74,
    height: 74,
    borderRadius: radius.xl,
    backgroundColor: colors.surface
  },
  body: {
    flex: 1,
    gap: 7
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  nameBlock: {
    flex: 1
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  specialty: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  metaItemWide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  metaText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  responseText: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  statusRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  price: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  priceMuted: {
    color: colors.subtle,
    fontSize: 10
  },
  cta: {
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  ctaText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "900"
  },
  topBadge: {
    position: "absolute",
    right: 14,
    top: -9,
    zIndex: 2,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  topBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.75
  }
});
