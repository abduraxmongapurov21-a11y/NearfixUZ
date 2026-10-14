import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, TextInput } from "../../i18n/native";
import { colors, font, radius } from "../../theme/clientTheme";

export function OrderRatingCard({ review, submitting = false, onSubmit }) {
  const { t } = useTranslation();
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
        {review.text ? <Text translate={false} style={styles.reviewText}>{review.text}</Text> : null}
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
            accessibilityLabel={t("{{value0}} yulduz", { value0: value })}
            accessibilityState={{ selected: value === rating, disabled: submitting }}
            disabled={submitting}
            onPress={() => setRating(value)}
            style={styles.starButton}
          >
            <Star
              size={29}
              strokeWidth={1.7}
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
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !rating || submitting, busy: submitting }}
        style={[styles.submitButton, (!rating || submitting) && styles.disabled]}
        disabled={!rating || submitting}
        onPress={() => onSubmit?.(rating, comment)}
      >
        <Text style={styles.submitText}>{submitting ? "Yuborilmoqda..." : "Bahoni yuborish"}</Text>
      </Pressable>
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
    fontSize: 17,
    fontFamily: font.bold
  },
  copy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: font.regular
  },
  stars: {
    flexDirection: "row",
    gap: 3,
    justifyContent: "space-between"
  },
  starButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  submitButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  submitText: { color: colors.white, fontSize: 13, fontFamily: font.semi },
  disabled: { opacity: 0.45 },
  input: {
    minHeight: 92,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 13,
    textAlignVertical: "top"
  },
  reviewText: {
    color: colors.muted,
    lineHeight: 20,
    fontFamily: font.regular
  }
});
