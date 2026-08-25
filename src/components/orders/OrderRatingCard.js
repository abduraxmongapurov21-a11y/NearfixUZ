import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Star } from "lucide-react-native";
import { PrimaryButton } from "../ui/Button";
import { Text, TextInput } from "../../i18n/native";
import { colors, radius } from "../../theme";

export function OrderRatingCard({ review, submitting = false, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  if (review) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Sizning bahoyingiz</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Star
              key={value}
              size={25}
              color={colors.warning}
              fill={value <= review.rating ? colors.warning : "transparent"}
            />
          ))}
        </View>
        {review.text ? <Text style={styles.reviewText}>{review.text}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Ustani baholang</Text>
      <Text style={styles.copy}>Baho usta reytingida ko‘rinadi. Izoh ixtiyoriy.</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`${value} yulduz`}
            onPress={() => setRating(value)}
            hitSlop={8}
          >
            <Star
              size={32}
              color={colors.warning}
              fill={value <= rating ? colors.warning : "transparent"}
            />
          </Pressable>
        ))}
      </View>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Izoh (ixtiyoriy)"
        placeholderTextColor={colors.subtle}
        multiline
        maxLength={1200}
        editable={!submitting}
        style={styles.input}
      />
      <PrimaryButton
        title={submitting ? "Yuborilmoqda..." : "Bahoni yuborish"}
        disabled={!rating || submitting}
        onPress={() => onSubmit?.(rating, comment)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 18,
    gap: 12
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600"
  },
  stars: {
    flexDirection: "row",
    gap: 8
  },
  input: {
    minHeight: 92,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    color: colors.text,
    textAlignVertical: "top"
  },
  reviewText: {
    color: colors.muted,
    lineHeight: 20,
    fontWeight: "600"
  }
});
