import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Heart } from "lucide-react-native";
import { colors, iconSizes, radius } from "../../theme";

export function FavoriteButton({ active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, active && styles.active, pressed && styles.pressed]}
    >
      <Heart
        size={iconSizes.md}
        color={active ? colors.danger : colors.muted}
        fill={active ? colors.danger : "transparent"}
        strokeWidth={2.4}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  active: {
    backgroundColor: "rgba(239,68,68,0.09)"
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.8
  }
});
