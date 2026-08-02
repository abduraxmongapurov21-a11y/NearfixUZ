import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { RotateCcw } from "lucide-react-native";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function RepeatBookingButton({ onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <RotateCcw size={iconSizes.sm} color={colors.white} strokeWidth={2.8} />
      <Text style={styles.text}>Yana shu ustani chaqirish</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12
  },
  text: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.78
  }
});
