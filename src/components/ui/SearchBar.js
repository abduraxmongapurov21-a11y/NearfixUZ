import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Search, SlidersHorizontal } from "lucide-react-native";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { TextInput } from "../../i18n/native";

export function SearchBar({ onFocus, placeholder = "Qanday yordam kerak?" }) {
  return (
    <Pressable onPress={onFocus} style={styles.shell}>
      <View style={styles.iconWrap}>
        <Search size={iconSizes.md} color={colors.primary} strokeWidth={2.6} />
      </View>
      <TextInput
        editable={false}
        pointerEvents="none"
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        style={styles.input}
      />
      <View style={styles.filter}>
        <SlidersHorizontal size={iconSizes.sm} color={colors.white} strokeWidth={2.6} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 62,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...shadow
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: "#E6F4F8",
    alignItems: "center",
    justifyContent: "center"
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  filter: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  }
});
