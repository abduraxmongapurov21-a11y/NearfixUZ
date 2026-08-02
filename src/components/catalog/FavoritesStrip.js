import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Heart } from "lucide-react-native";
import { WorkerAvatar } from "../ui/WorkerAvatar";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function FavoritesStrip({ workers, onOpenWorker }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Heart size={iconSizes.sm} color={colors.danger} fill={colors.danger} />
        <Text style={styles.title}>Mening ustalarim</Text>
      </View>
      {!workers.length ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Sevimlilar yo'q</Text>
          <Text style={styles.emptyText}>Yoqtirgan ustalaringiz shu yerda ko'rinadi.</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        {workers.slice(0, 4).map((worker) => (
          <Pressable key={worker.id} onPress={() => onOpenWorker(worker.id)} style={styles.worker}>
            <WorkerAvatar worker={worker} size={48} radius={radius.lg} style={styles.avatar} />
            <Text style={styles.name} numberOfLines={1}>
              {worker.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  title: {
    color: colors.text,
    fontWeight: "900"
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  emptyBox: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 12
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  emptyText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  worker: {
    width: 64,
    alignItems: "center",
    gap: 5
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.surface
  },
  name: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    maxWidth: 64
  }
});
