import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Clock3 } from "lucide-react-native";
import { urgencyOptions } from "../../constants/orderStates";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function UrgencySelector({ value, onChange }) {
  return (
    <View style={styles.row}>
      {urgencyOptions.map((option) => {
        const selected = value === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}
          >
            <Clock3 size={iconSizes.sm} color={selected ? colors.white : colors.primary} strokeWidth={2.5} />
            <Text style={[styles.label, selected && styles.light]}>{option.label}</Text>
            <Text style={[styles.eta, selected && styles.lightMuted]}>{option.eta}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8
  },
  option: {
    flex: 1,
    minHeight: 86,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 12,
    justifyContent: "center",
    gap: 5
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  label: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 13
  },
  eta: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 11
  },
  light: {
    color: colors.white
  },
  lightMuted: {
    color: "rgba(255,255,255,0.78)"
  },
  pressed: {
    opacity: 0.78
  }
});
