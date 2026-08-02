import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

export function PrimaryButton({ title, onPress, style, disabled = false }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      <Text style={styles.primaryText}>{title}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, style, disabled = false }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      <Text style={styles.secondaryText}>{title}</Text>
    </Pressable>
  );
}

const baseButton = {
  minHeight: 54,
  borderRadius: radius.lg,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 18
};

const styles = StyleSheet.create({
  primary: {
    ...baseButton,
    backgroundColor: colors.secondary,
    ...shadow
  },
  primaryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800"
  },
  secondary: {
    ...baseButton,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  secondaryText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800"
  },
  pressed: {
    opacity: 0.75
  },
  disabled: {
    opacity: 0.55
  }
});
