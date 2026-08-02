import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { colors, iconSizes } from "../../theme";
import { Text } from "../../i18n/native";

export function Header({ title, onBack, right }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.iconButton}>
          <ChevronLeft size={iconSizes.lg} color={colors.text} strokeWidth={2.6} />
        </Pressable>
      ) : (
        <View style={styles.placeholder} />
      )}
      <Text style={styles.title}>{title}</Text>
      {right || <View style={styles.placeholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border
  },
  placeholder: {
    width: 40,
    height: 40
  }
});
