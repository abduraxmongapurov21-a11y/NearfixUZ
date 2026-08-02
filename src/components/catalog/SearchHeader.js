import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SlidersHorizontal, Search } from "lucide-react-native";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { TextInput } from "../../i18n/native";

export function SearchHeader({ query, onChangeQuery, onOpenFilters }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.search}>
        <Search size={iconSizes.md} color={colors.primary} strokeWidth={2.5} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Qanday usta kerak?"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          returnKeyType="search"
        />
      </View>
      <Pressable onPress={onOpenFilters} style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
        <SlidersHorizontal size={iconSizes.md} color={colors.white} strokeWidth={2.6} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 10
  },
  search: {
    flex: 1,
    minHeight: 58,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...shadow
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  filterButton: {
    width: 58,
    height: 58,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow
  },
  pressed: {
    opacity: 0.78
  }
});
