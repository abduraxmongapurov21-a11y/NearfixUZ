import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Flag, Star } from "lucide-react-native";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function ReviewCard({ review, onReport }) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View>
          <Text style={styles.author}>{review.author}</Text>
          <Text style={styles.date}>{review.date} - yakunlangan buyurtma</Text>
        </View>
        <View style={styles.rating}>
          <Star size={iconSizes.sm} color={colors.warning} fill={colors.warning} />
          <Text style={styles.ratingText}>{review.rating}</Text>
        </View>
      </View>
      <Text style={styles.text}>{review.text}</Text>
      {onReport ? (
        <Pressable onPress={onReport} style={styles.reportButton}>
          <Flag size={14} color={colors.danger} />
          <Text style={styles.reportText}>Sharh haqida shikoyat</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  author: {
    color: colors.text,
    fontWeight: "900"
  },
  date: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  ratingText: {
    color: colors.text,
    fontWeight: "900"
  },
  text: {
    color: colors.muted,
    lineHeight: 20,
    fontWeight: "600"
  },
  reportButton: {
    alignSelf: "flex-start",
    minHeight: 32,
    borderRadius: radius.pill,
    backgroundColor: "rgba(239,68,68,0.08)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  reportText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "900"
  }
});
