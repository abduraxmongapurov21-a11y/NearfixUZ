import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";
import { resolveCategoryIcon } from "../../constants/categoryIcons";

export function CategoryCard({ category, onPress }) {
  const Icon = resolveCategoryIcon(category.iconKey || category.icon);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <Icon size={iconSizes.md} color={colors.primary} strokeWidth={2.5} />
      </View>
      <Text translate={false} style={styles.title}>{category.displayName || category.nameUz || category.title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 84,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E6F4F8",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center"
  },
  pressed: {
    opacity: 0.75
  }
});
